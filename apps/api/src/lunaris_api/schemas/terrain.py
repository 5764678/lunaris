"""Wire schemas for terrain scenes (contract C3, docs/TASKS.md)."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from lunaris_api.schemas.common import EvidenceSchema, Schema


class DemProvenanceSchema(Schema):
    """The DEM file a scene was computed from."""

    dataset_id: str
    title: str
    file_name: str
    sha256: str = Field(description="SHA-256 of the DEM data file actually read.")
    source_url: str
    resolution_m: float = Field(description="Nominal DEM grid spacing (true at the pole), m.")
    frame: str = Field(description="Frame named by the product label.")
    citation: str


class SceneBinaryLayoutSchema(Schema):
    """How to decode the bytes returned by ``data_url``."""

    dtype: Literal["float32"] = "float32"
    byte_order: Literal["little"] = "little"
    order: Literal["row-major"] = "row-major"
    values_per_vertex: Literal[4] = 4
    components: list[str] = Field(
        default_factory=lambda: ["x_m", "y_m", "z_m", "height_m"],
        description="x, y, z relative to origin_moon_me_m (MOON_ME, m), then height above "
        "the reference sphere (m).",
    )
    row_direction: str = Field(
        default="row 0 is the map's top edge (toward 0° E); rows advance toward 180° E; "
        "columns advance toward 90° E",
    )
    byte_length: int = Field(description="Total body length in bytes.")


class TerrainSceneSummary(Schema):
    scene_id: str
    title: str
    description: str
    dataset_id: str
    available: bool = Field(description="Whether the source DEM is acquired locally.")
    acquire_command: str | None = Field(
        default=None, description="Command that acquires the source DEM when unavailable."
    )
    metadata_url: str


class TerrainSceneListResponse(Schema):
    scenes: list[TerrainSceneSummary]
    count: int


class TerrainSceneMetadata(Schema):
    """Metadata of one terrain scene; vertex data is served separately at ``data_url``."""

    scene_id: str
    title: str
    frame: Literal["MOON_ME"] = "MOON_ME"
    width: int = Field(description="Vertices per row (cap 1024).")
    height: int = Field(description="Rows of vertices (cap 1024).")
    origin_moon_me_m: list[float] = Field(
        description="[x, y, z] in MOON_ME, m. Vertex positions are relative to this point."
    )
    height_reference_radius_m: float
    height_min_m: float
    height_max_m: float
    vertex_spacing_m: float = Field(
        description="Nominal spacing in the polar stereographic map plane (true at the "
        "pole), m. Ground spacing is this divided by the point scale factor k = 1 + "
        "(ρ/2R)²; about 0.26% smaller at the corners of the ±125 km south-pole scene.",
    )
    half_extent_m: float = Field(description="Half side length of the square in the map plane.")
    center_latitude_deg: float
    center_longitude_deg: float
    resampling: str
    method: str
    nodata: str
    nodata_vertex_count: int
    layout: SceneBinaryLayoutSchema
    dem: DemProvenanceSchema
    evidence: EvidenceSchema
    etag: str
    data_url: str


__all__ = [
    "DemProvenanceSchema",
    "SceneBinaryLayoutSchema",
    "TerrainSceneListResponse",
    "TerrainSceneMetadata",
    "TerrainSceneSummary",
]


class SlopeValueSchema(Schema):
    slope_deg: float | None = Field(description="Horn slope; null where the DEM has no value.")
    baseline_m: float = Field(
        description="Ground distance between the pixel centres Horn's operator differences."
    )


class FootprintSchema(Schema):
    radius_m: float
    cell_count: int
    missing_cell_count: int = Field(description="Cells with no DEM value (never treated as 0).")
    height_min_m: float
    height_max_m: float
    height_mean_m: float
    slope_mean_deg: float | None
    slope_p95_deg: float | None
    slope_max_deg: float | None
    slope_baseline_m: float
    roughness_rms_m: float | None
    roughness_baseline_m: float = Field(description="Diameter of the plane-fit window, m.")


class HazardSchema(Schema):
    max_slope_deg: float | None = Field(description="Assumption supplied by the caller.")
    max_roughness_m: float | None = Field(description="Assumption supplied by the caller.")
    slope_fraction_above: float | None
    slope_p95_exceeds: bool | None
    roughness_exceeds: bool | None
    evidence: EvidenceSchema


class DemWindowSchema(Schema):
    dataset_id: str
    title: str
    url: str
    etag: str | None
    last_modified: str | None
    resolution_m: float
    window_col_row_width_height: list[int]
    window_map_bounds_m: list[float]
    bytes_requested: int
    http_retries: int
    served_from_cache: bool
    read_at_utc: str
    citation: str


class SiteTerrainResponse(Schema):
    site_id: str
    latitude_deg: float
    longitude_deg: float
    height_m: float = Field(description="Bilinear DEM height above the 1 737 400 m sphere.")
    scale_factor: float = Field(description="Polar stereographic point scale factor k at the site.")
    slope_at_site: SlopeValueSchema
    footprint: FootprintSchema
    hazard: HazardSchema | None = Field(
        description="Present only when thresholds were supplied; LUNARIS ships no default."
    )
    dem: DemWindowSchema
    evidence: EvidenceSchema
    limitations: list[str]
