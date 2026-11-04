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
