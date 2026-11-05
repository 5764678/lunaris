"""Terrain scene use-cases (contract C3).

The DEM is read once per process (label-driven reader, checksum compared to the
manifest pin) and scenes are cached in memory per (DEM checksum, scene, grid size).
"""

from __future__ import annotations

import hashlib
import threading
from dataclasses import dataclass
from pathlib import Path

from lunaris_api.errors import ApiError, NotFoundError
from lunaris_api.schemas.common import EvidenceSchema, SourceReferenceSchema
from lunaris_api.schemas.terrain import (
    DemProvenanceSchema,
    SceneBinaryLayoutSchema,
    TerrainSceneListResponse,
    TerrainSceneMetadata,
    TerrainSceneSummary,
)
from lunaris_data.manifest import DatasetManifest, FileRole
from lunaris_data.readers.ldem import read_ldem_polar
from lunaris_data.registry import DatasetRegistry
from lunaris_data.store import DataLayout, DatasetStatus, inspect_dataset
from lunaris_science.terrain.dem import PolarDem
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

    def load_dem(self, manifest: DatasetManifest) -> PolarDem:
        """The verified, process-cached DEM of ``manifest`` (raises DatasetUnavailableError)."""
        return self._load_dem(manifest)

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


__all__ = [
    "CACHE",
    "DEFAULT_GRID_SIZE",
    "SCENES",
    "DatasetUnavailableError",
    "SceneResult",
    "TerrainSceneService",
    "scene_etag",
]
