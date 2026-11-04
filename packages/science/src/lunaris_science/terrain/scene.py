"""Terrain scene export: a regular vertex grid with body-fixed positions (contract C3).

A scene is a square of the south polar stereographic map plane, centred on a map point
(the pole for ``south-pole``), sampled on a regular ``width × height`` vertex grid. For
each vertex:

1. its map coordinates ``(x, y)`` are converted to planetocentric (φ, λ) with the inverse
   projection (so the web never re-implements it);
2. the DEM height h is sampled bilinearly at that map point (NaN where the DEM has no
   value or the vertex is outside the DEM);
3. its position is the ``MOON_ME`` point at radius R + h on the reference sphere
   (``spherical_to_cartesian``), stored relative to ``origin_moon_me_m`` so float32
   keeps centimetre precision.

Vertex order is row-major: row 0 is the map's top edge (largest y, toward 0° E), rows
advance toward −y, columns advance toward +x. Vertices with no DEM value are NaN in all
four components and must not be drawn. NaN is never replaced by zero.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from lunaris_science.coordinates import spherical_to_cartesian
from lunaris_science.terrain.dem import PolarDem

MAX_SCENE_VERTICES_PER_SIDE = 1024
"""Contract C3 cap on the vertex grid (1024 × 1024)."""

VALUES_PER_VERTEX = 4
"""x, y, z (m, relative to the origin, MOON_ME) and height_m."""

SCENE_METHOD = (
    "Regular vertex grid in the south polar stereographic map plane; map → planetocentric "
    "by the spherical inverse (Snyder 1987); height by bilinear interpolation of the DEM "
    "at the vertex map position (NaN if any neighbouring cell is missing or the vertex "
    "is outside the DEM); MOON_ME position at radius R_ref + height."
)
SCENE_RESAMPLING = "bilinear"
SCENE_ALGORITHM_VERSION = "1"
"""Bump when the vertex computation changes, so cached scenes and ETags are invalidated."""


class SceneError(ValueError):
    """Raised for invalid scene parameters."""


@dataclass(frozen=True, slots=True)
class TerrainScene:
    """A computed terrain scene.

    Attributes:
        vertices: float32 array of shape ``(height, width, 4)``: x, y, z relative to
            ``origin_moon_me_m`` (m, MOON_ME) and height above the sphere (m).
        origin_moon_me_m: origin of the relative positions, m, MOON_ME.
        center_map_m: map-plane centre of the scene, m.
        half_extent_m: half side length of the square in the map plane, m.
        vertex_spacing_m: map-plane spacing between adjacent vertices, m (true scale at
            the pole; ground spacing is this divided by the point scale factor).
        reference_radius_m: sphere radius the heights refer to, m.
        height_min_m, height_max_m: range over drawable vertices (NaN-free), m.
        nodata_vertex_count: number of NaN vertices.
    """

    vertices: NDArray[np.float32]
    origin_moon_me_m: tuple[float, float, float]
    center_map_m: tuple[float, float]
    half_extent_m: float
    vertex_spacing_m: float
    reference_radius_m: float
    height_min_m: float
    height_max_m: float
    nodata_vertex_count: int

    @property
    def width(self) -> int:
        return int(self.vertices.shape[1])

    @property
    def height(self) -> int:
        return int(self.vertices.shape[0])

    def to_bytes(self) -> bytes:
        """Little-endian float32, row-major, 4 values per vertex (contract C3)."""
        return np.ascontiguousarray(self.vertices, dtype="<f4").tobytes()


def build_terrain_scene(
    dem: PolarDem,
    *,
    grid_size: int,
    half_extent_m: float,
    center_map_m: tuple[float, float] = (0.0, 0.0),
) -> TerrainScene:
    """Build a square ``grid_size × grid_size`` scene over ``[c − e, c + e]²`` of the map.

    Args:
        dem: source DEM.
        grid_size: vertices per side, 2 … :data:`MAX_SCENE_VERTICES_PER_SIDE`.
        half_extent_m: half side length in the map plane, m (> 0).
        center_map_m: map-plane centre ``(x, y)``, m.

    Raises:
        SceneError: on invalid parameters or if no vertex has a DEM value.
    """
    if not 2 <= grid_size <= MAX_SCENE_VERTICES_PER_SIDE:  # noqa: PLR2004
        raise SceneError(f"grid_size must be within [2, {MAX_SCENE_VERTICES_PER_SIDE}]")
    if not math.isfinite(half_extent_m) or half_extent_m <= 0.0:
        raise SceneError("half_extent_m must be positive and finite")
    cx, cy = (float(v) for v in center_map_m)
    if not (math.isfinite(cx) and math.isfinite(cy)):
        raise SceneError("center_map_m must be finite")

    offsets = np.linspace(-half_extent_m, half_extent_m, grid_size)
    x = cx + offsets[np.newaxis, :]
    y = cy - offsets[:, np.newaxis]  # row 0 at the top (largest y)
    x, y = np.broadcast_arrays(x, y)

    projection = dem.grid.projection
    latitude, longitude = projection.inverse(x, y)
    line, sample = dem.grid.map_to_pixel(x, y)
    height = dem.sample_bilinear(line, sample)

    radius = dem.reference_radius_m
    valid = np.isfinite(height)
    if not np.any(valid):
        raise SceneError("the scene does not overlap any DEM value")

    origin_lat, origin_lon = projection.inverse(cx, cy)
    origin = spherical_to_cartesian(float(origin_lat), float(origin_lon), radius)

    position = spherical_to_cartesian(latitude, longitude, radius + np.where(valid, height, 0.0))
    relative = position - origin
    vertices = np.empty((grid_size, grid_size, VALUES_PER_VERTEX), dtype=np.float32)
    vertices[..., :3] = relative
    vertices[..., 3] = height
    vertices[~valid] = np.nan

    return TerrainScene(
        vertices=vertices,
        origin_moon_me_m=(float(origin[0]), float(origin[1]), float(origin[2])),
        center_map_m=(cx, cy),
        half_extent_m=float(half_extent_m),
        vertex_spacing_m=float(2.0 * half_extent_m / (grid_size - 1)),
        reference_radius_m=radius,
        height_min_m=float(np.min(height[valid])),
        height_max_m=float(np.max(height[valid])),
        nodata_vertex_count=int(np.count_nonzero(~valid)),
    )


__all__ = [
    "MAX_SCENE_VERTICES_PER_SIDE",
    "SCENE_ALGORITHM_VERSION",
    "SCENE_METHOD",
    "SCENE_RESAMPLING",
    "VALUES_PER_VERTEX",
    "SceneError",
    "TerrainScene",
    "build_terrain_scene",
]
