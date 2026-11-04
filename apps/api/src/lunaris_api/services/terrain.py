"""Terrain scene use-cases (contract C3).

The DEM is read once per process (label-driven reader, checksum compared to the
manifest pin) and scenes are cached in memory per (DEM checksum, scene, grid size).
"""

from __future__ import annotations

import hashlib
import math
import threading
from dataclasses import dataclass
from pathlib import Path

from lunaris_api.errors import ApiError, NotFoundError
from lunaris_api.schemas.common import EvidenceSchema, SourceReferenceSchema
from lunaris_api.schemas.sites import CandidateSite
from lunaris_api.schemas.terrain import (
    DemProvenanceSchema,
    DemWindowSchema,
    FootprintSchema,
    HazardSchema,
    SceneBinaryLayoutSchema,
    SiteTerrainResponse,
    SlopeValueSchema,
    TerrainSceneListResponse,
    TerrainSceneMetadata,
    TerrainSceneSummary,
)
from lunaris_data.manifest import DatasetManifest, FileRole
from lunaris_data.readers.ldem import read_ldem_polar
from lunaris_data.registry import DatasetRegistry
from lunaris_data.remote.window import DemWindow, RemoteWindowError, read_window, remote_source
from lunaris_data.store import DataLayout, DatasetStatus, inspect_dataset
from lunaris_science.terrain.analysis import (
    ROUGHNESS_METHOD,
    SLOPE_METHOD,
    HazardThresholds,
    SiteTerrain,
    TerrainAnalysisError,
    analyze_site,
)
from lunaris_science.terrain.dem import PolarDem
from lunaris_science.terrain.polar_stereographic import SouthPolarStereographic
from lunaris_science.terrain.scene import (
    SCENE_ALGORITHM_VERSION,
    SCENE_METHOD,
    SCENE_RESAMPLING,
    TerrainScene,
    build_terrain_scene,
)

DEFAULT_GRID_SIZE = 512
API_PREFIX = "/api/v1/terrain/scenes"


class DatasetUnavailableError(ApiError):
    """The scene's source DEM is not acquired (or does not match its manifest)."""

    status_code = 503
    code = "dataset_unavailable"


@dataclass(frozen=True, slots=True)
class SceneDefinition:
    scene_id: str
    title: str
    description: str
    dataset_id: str
    half_extent_m: float
    center_map_m: tuple[float, float] = (0.0, 0.0)


SCENES: dict[str, SceneDefinition] = {
    "south-pole": SceneDefinition(
        scene_id="south-pole",
        title="Lunar south pole, ±125 km (LOLA 240 m)",
        description=(
            "Square of the south polar stereographic plane centred on the pole, 250 km on "
            "a side, from LOLA LDEM_75S_240M."
        ),
        dataset_id="lola-ldem-75s-240m",
        half_extent_m=125_000.0,
    ),
}


@dataclass(frozen=True, slots=True)
class SceneResult:
    definition: SceneDefinition
    scene: TerrainScene
    dem: PolarDem
    manifest: DatasetManifest
    etag: str
    grid_size: int


class _Cache:
    """Process-wide caches; endpoints run in a thread pool, so access is locked."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.dems: dict[tuple[str, int, int], PolarDem] = {}
        self.scenes: dict[tuple[str, str, int], SceneResult] = {}

    def clear(self) -> None:
        with self.lock:
            self.dems.clear()
            self.scenes.clear()


CACHE = _Cache()


def scene_etag(dem_sha256: str, scene_id: str, grid_size: int) -> str:
    """Strong ETag from the DEM checksum, scene parameters and algorithm version."""
    key = f"{dem_sha256}|{scene_id}|{grid_size}|v{SCENE_ALGORITHM_VERSION}"
    return '"' + hashlib.sha256(key.encode("ascii")).hexdigest()[:32] + '"'


class TerrainSceneService:
    def __init__(self, registry: DatasetRegistry, layout: DataLayout) -> None:
        self._registry = registry
        self._layout = layout

    def _definition(self, scene_id: str) -> SceneDefinition:
        try:
            return SCENES[scene_id]
        except KeyError:
            raise NotFoundError(f"Terrain scene {scene_id!r} does not exist.") from None

    def _available(self, definition: SceneDefinition) -> bool:
        manifest = self._registry.get(definition.dataset_id)
        return inspect_dataset(manifest, self._layout).status is DatasetStatus.ACQUIRED

    def list_scenes(self) -> TerrainSceneListResponse:
        scenes = []
        for definition in SCENES.values():
            available = self._available(definition)
            scenes.append(
                TerrainSceneSummary(
                    scene_id=definition.scene_id,
                    title=definition.title,
                    description=definition.description,
                    dataset_id=definition.dataset_id,
                    available=available,
                    acquire_command=None
                    if available
                    else f"uv run lunaris-data acquire {definition.dataset_id}",
                    metadata_url=f"{API_PREFIX}/{definition.scene_id}",
                )
            )
        return TerrainSceneListResponse(scenes=scenes, count=len(scenes))

    def _load_dem(self, manifest: DatasetManifest) -> PolarDem:
        state = inspect_dataset(manifest, self._layout)
        if state.status is not DatasetStatus.ACQUIRED:
            raise DatasetUnavailableError(
                f"Dataset {manifest.id!r} is {state.status.value}; acquire it with "
                f"'uv run lunaris-data acquire {manifest.id}'."
            )
        directory = self._layout.dataset_dir(manifest)
        label = next(f for f in manifest.files if f.role is FileRole.LABEL)
        data = next(f for f in manifest.files if f.role is FileRole.DATA)
        data_path: Path = directory / data.name
        stat = data_path.stat()
        key = (str(data_path), stat.st_size, stat.st_mtime_ns)
        with CACHE.lock:
            cached = CACHE.dems.get(key)
        if cached is not None:
            return cached
        dem = read_ldem_polar(directory / label.name, manifest.id)
        if data.sha256 is not None and dem.sha256 != data.sha256:
            raise DatasetUnavailableError(
                f"{data.name} does not match the SHA-256 pinned in the {manifest.id!r} "
                f"manifest; re-acquire it with 'uv run lunaris-data acquire {manifest.id}'."
            )
        with CACHE.lock:
            CACHE.dems[key] = dem
        return dem

    def get_scene(self, scene_id: str, grid_size: int) -> SceneResult:
        definition = self._definition(scene_id)
        manifest = self._registry.get(definition.dataset_id)
        dem = self._load_dem(manifest)
        key = (dem.sha256, scene_id, grid_size)
        with CACHE.lock:
            cached = CACHE.scenes.get(key)
        if cached is not None:
            return cached
        scene = build_terrain_scene(
            dem,
            grid_size=grid_size,
            half_extent_m=definition.half_extent_m,
            center_map_m=definition.center_map_m,
        )
        result = SceneResult(
            definition=definition,
            scene=scene,
            dem=dem,
            manifest=manifest,
            etag=scene_etag(dem.sha256, scene_id, grid_size),
            grid_size=grid_size,
        )
        with CACHE.lock:
            CACHE.scenes[key] = result
        return result

    def metadata(self, result: SceneResult) -> TerrainSceneMetadata:
        scene, dem, manifest, definition = (
            result.scene,
            result.dem,
            result.manifest,
            result.definition,
        )
        data_file = next(f for f in manifest.files if f.role is FileRole.DATA)
        center_lat, center_lon = dem.grid.projection.inverse(*scene.center_map_m)
        dem_schema = DemProvenanceSchema(
            dataset_id=manifest.id,
            title=manifest.title,
            file_name=dem.file_name,
            sha256=dem.sha256,
            source_url=str(data_file.url),
            resolution_m=dem.resolution_m,
            frame=dem.frame,
            citation=manifest.citation,
        )
        evidence = EvidenceSchema(
            kind="derived_product",
            statement=(
                f"Vertex positions and heights resampled from {manifest.title} for 3D "
                "display. Heights are the LOLA product's, not LUNARIS measurements."
            ),
            sources=[
                SourceReferenceSchema(
                    source_id=manifest.id,
                    title=manifest.title,
                    url=str(data_file.url),
                    sha256=dem.sha256,
                    citation=manifest.citation,
                )
            ],
            method=SCENE_METHOD,
            assumptions=[
                "Heights are relative to the 1 737 400 m reference sphere of the product label.",
                f"{dem.frame} (LOLA label) is treated as MOON_ME (docs/DECISIONS.md D2).",
            ],
        )
        query = f"?grid_size={result.grid_size}"
        return TerrainSceneMetadata(
            scene_id=definition.scene_id,
            title=definition.title,
            width=scene.width,
            height=scene.height,
            origin_moon_me_m=list(scene.origin_moon_me_m),
            height_reference_radius_m=scene.reference_radius_m,
            height_min_m=scene.height_min_m,
            height_max_m=scene.height_max_m,
            vertex_spacing_m=scene.vertex_spacing_m,
            half_extent_m=scene.half_extent_m,
            center_latitude_deg=float(center_lat),
            center_longitude_deg=float(center_lon),
            resampling=SCENE_RESAMPLING,
            method=SCENE_METHOD,
            nodata=(
                "Vertices with no DEM value have NaN in all four components and must not "
                "be drawn; missing coverage is never zero elevation."
            ),
            nodata_vertex_count=scene.nodata_vertex_count,
            layout=SceneBinaryLayoutSchema(byte_length=scene.vertices.nbytes),
            dem=dem_schema,
            evidence=evidence,
            etag=result.etag,
            data_url=f"{API_PREFIX}/{definition.scene_id}/data{query}",
        )


# ── Site terrain analysis (T-14) ────────────────────────────────────────────

ANALYSIS_DATASET = "pgda-lola-20mpp-80s"
MAX_FOOTPRINT_RADIUS_M = 2000.0
TERRAIN_LIMITATIONS = [
    "DEM resolution bounds what is detectable: boulders and craters smaller than a few "
    "grid cells (20 m) are invisible to slope and roughness.",
    "Polar LOLA products interpolate between altimetry tracks; values there are less "
    "constrained than on tracks.",
    "Slope and roughness depend on their baseline; compare values only at equal baselines.",
]


class OutOfCoverageError(ApiError):
    status_code = 422
    code = "out_of_coverage"


def _finite_or_none(value: float) -> float | None:
    return value if math.isfinite(value) else None


class SiteTerrainService:
    """Terrain values for a registered site from a PGDA 20 m window."""

    def __init__(self, registry: DatasetRegistry, layout: DataLayout) -> None:
        self._registry = registry
        self._layout = layout

    def analyze(
        self,
        site: CandidateSite,
        *,
        footprint_radius_m: float,
        thresholds: HazardThresholds | None,
    ) -> SiteTerrainResponse:
        manifest = self._registry.get(ANALYSIS_DATASET)
        source = remote_source(manifest)
        lat, lon = site.coordinate.latitude_deg, site.coordinate.longitude_deg
        k = (
            float(SouthPolarStereographic(source.reference_radius_m).scale_factor(lat))
            if lat < 0
            else 1.0
        )
        cell_m = manifest.spatial.nominal_resolution_m if manifest.spatial else 20.0
        side_px = math.ceil(2.0 * footprint_radius_m * k / (cell_m or 20.0)) + 8
        cache_dir = self._layout.processed / ANALYSIS_DATASET / "windows"
        try:
            window = read_window(
                source, latitude_deg=lat, longitude_deg=lon, side_px=side_px, cache_dir=cache_dir
            )
        except RemoteWindowError as exc:
            if "outside the raster" in str(exc):
                raise OutOfCoverageError(
                    f"Site {site.id!r} is outside the {ANALYSIS_DATASET} coverage "
                    "(about 80°S–90°S)."
                ) from None
            raise DatasetUnavailableError(f"Could not read {ANALYSIS_DATASET}: {exc}") from None
        try:
            result = analyze_site(
                window.dem, lat, lon, footprint_radius_m=footprint_radius_m, thresholds=thresholds
            )
        except TerrainAnalysisError as exc:
            raise OutOfCoverageError(
                f"Terrain analysis not possible at {site.id!r}: {exc}"
            ) from None
        return self._response(site, result, window, manifest)

    def _response(
        self,
        site: CandidateSite,
        result: SiteTerrain,
        window: DemWindow,
        manifest: DatasetManifest,
    ) -> SiteTerrainResponse:
        p = window.provenance
        source_ref = SourceReferenceSchema(
            source_id=manifest.id,
            title=manifest.title,
            url=p.url,
            version=f"ETag {p.etag}; Last-Modified {p.last_modified}",
            citation=manifest.citation,
        )
        fp = result.footprint
        hazard = None
        if result.hazard is not None:
            t = result.hazard.thresholds
            hazard = HazardSchema(
                max_slope_deg=t.max_slope_deg,
                max_roughness_m=t.max_roughness_m,
                slope_fraction_above=result.hazard.slope_fraction_above,
                slope_p95_exceeds=result.hazard.slope_exceeds,
                roughness_exceeds=result.hazard.roughness_exceeds,
                evidence=EvidenceSchema(
                    kind="assumption",
                    statement=(
                        "Hazard flags compare computed values with caller-supplied thresholds."
                    ),
                    assumptions=[
                        f"{name} = {value}"
                        for name, value in (
                            ("max_slope_deg", t.max_slope_deg),
                            ("max_roughness_m", t.max_roughness_m),
                        )
                        if value is not None
                    ],
                ),
            )
        return SiteTerrainResponse(
            site_id=site.id,
            latitude_deg=result.latitude_deg,
            longitude_deg=result.longitude_deg,
            height_m=result.height_m,
            scale_factor=result.scale_factor,
            slope_at_site=SlopeValueSchema(
                slope_deg=_finite_or_none(result.slope_at_site.slope_deg),
                baseline_m=result.slope_at_site.baseline_m,
            ),
            footprint=FootprintSchema(
                radius_m=fp.radius_m,
                cell_count=fp.cell_count,
                missing_cell_count=fp.missing_cell_count,
                height_min_m=fp.height_min_m,
                height_max_m=fp.height_max_m,
                height_mean_m=fp.height_mean_m,
                slope_mean_deg=_finite_or_none(fp.slope_mean_deg),
                slope_p95_deg=_finite_or_none(fp.slope_p95_deg),
                slope_max_deg=_finite_or_none(fp.slope_max_deg),
                slope_baseline_m=fp.slope_baseline_m,
                roughness_rms_m=_finite_or_none(fp.roughness_rms_m),
                roughness_baseline_m=fp.roughness_baseline_m,
            ),
            hazard=hazard,
            dem=DemWindowSchema(
                dataset_id=manifest.id,
                title=manifest.title,
                url=p.url,
                etag=p.etag,
                last_modified=p.last_modified,
                resolution_m=p.resolution_m,
                window_col_row_width_height=list(p.window_col_row_width_height),
                window_map_bounds_m=list(p.window_map_bounds_m),
                bytes_requested=p.bytes_requested,
                http_retries=p.http_retries,
                served_from_cache=p.served_from_cache,
                read_at_utc=p.read_at_utc,
                citation=manifest.citation,
            ),
            evidence=EvidenceSchema(
                kind="calculation",
                statement=(
                    "Height, slope, roughness and footprint statistics computed by LUNARIS "
                    f"from a window of {manifest.title}."
                ),
                sources=[source_ref],
                method=f"Height: bilinear. Slope: {SLOPE_METHOD} Roughness: {ROUGHNESS_METHOD}",
                assumptions=[
                    f"Footprint radius {result.footprint.radius_m} m (request parameter).",
                    "Heights are relative to the 1 737 400 m reference sphere.",
                ],
            ),
            limitations=list(TERRAIN_LIMITATIONS),
        )


__all__ = [
    "CACHE",
    "DEFAULT_GRID_SIZE",
    "SCENES",
    "DatasetUnavailableError",
    "OutOfCoverageError",
    "SceneResult",
    "SiteTerrainService",
    "TerrainSceneService",
    "scene_etag",
]
