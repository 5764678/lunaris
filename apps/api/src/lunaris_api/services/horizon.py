"""Horizon masks for sites (T-16): computed once from LDEM_75S_240M, cached as files.

Cache (docs/DECISIONS.md D1): ``data/processed/lola-ldem-75s-240m/horizon-masks/<key>``
``.npz`` (azimuth, elevation, truncated) + ``.json`` (scalars and provenance), where the
key hashes the DEM SHA-256, the site reference point, the observer height, the azimuth
step, the range and the method version. A cache hit never recomputes.
"""

from __future__ import annotations

import hashlib
import json
import math
import threading
from pathlib import Path

import numpy as np

from lunaris_api.errors import ApiError
from lunaris_api.services.sites import SiteService
from lunaris_api.services.terrain import TerrainSceneService
from lunaris_data.manifest import DatasetManifest
from lunaris_data.registry import DatasetRegistry
from lunaris_data.store import DataLayout
from lunaris_science.coordinates import SelenographicCoordinate
from lunaris_science.horizon_mask import HorizonMask
from lunaris_science.terrain.horizon import (
    DEFAULT_AZIMUTH_STEP_DEG,
    DEFAULT_MAX_RANGE_M,
    HorizonError,
    compute_horizon_mask,
)

HORIZON_DATASET = "lola-ldem-75s-240m"
DEFAULT_OBSERVER_HEIGHT_M = 2.0
HORIZON_METHOD_VERSION = "1"
"""Bump when compute_horizon_mask changes results, so cached masks are not reused."""

_LOCK = threading.Lock()


class OutOfCoverageError(ApiError):
    status_code = 422
    code = "out_of_coverage"


def mask_cache_key(
    dem_sha256: str, latitude_deg: float, longitude_deg: float, observer_height_m: float
) -> str:
    key = "|".join(
        [
            dem_sha256,
            repr(float(latitude_deg)),
            repr(float(longitude_deg)),
            repr(float(observer_height_m)),
            repr(DEFAULT_AZIMUTH_STEP_DEG),
            repr(DEFAULT_MAX_RANGE_M),
            HORIZON_METHOD_VERSION,
        ]
    )
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:32]


def _write(base: Path, mask: HorizonMask) -> None:
    base.parent.mkdir(parents=True, exist_ok=True)
    tmp = base.with_suffix(".tmp.npz")
    np.savez(tmp, azimuth=mask.azimuth_deg, elevation=mask.elevation_deg, truncated=mask.truncated)
    meta = {
        "latitude_deg": mask.site.latitude_deg,
        "longitude_deg": mask.site.longitude_deg,
        "observer_height_m": mask.observer_height_m,
        "surface_height_m": mask.surface_height_m,
        "max_range_m": mask.max_range_m,
        "dem_source_id": mask.dem_source_id,
        "dem_sha256": mask.dem_sha256,
        "dem_resolution_m": mask.dem_resolution_m,
        "method": mask.method,
        "method_version": HORIZON_METHOD_VERSION,
    }
    base.with_suffix(".json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    tmp.replace(base.with_suffix(".npz"))  # data file last: its presence marks completion


def _read(base: Path) -> HorizonMask | None:
    data_path, meta_path = base.with_suffix(".npz"), base.with_suffix(".json")
    if not (data_path.is_file() and meta_path.is_file()):
        return None
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    with np.load(data_path) as arrays:
        azimuth, elevation, truncated = (
            arrays["azimuth"],
            arrays["elevation"],
            arrays["truncated"],
        )
    return HorizonMask(
        site=SelenographicCoordinate(
            meta["latitude_deg"], meta["longitude_deg"], meta["surface_height_m"]
        ),
        observer_height_m=meta["observer_height_m"],
        surface_height_m=meta["surface_height_m"],
        azimuth_deg=azimuth,
        elevation_deg=elevation,
        truncated=truncated,
        max_range_m=meta["max_range_m"],
        dem_source_id=meta["dem_source_id"],
        dem_sha256=meta["dem_sha256"],
        dem_resolution_m=meta["dem_resolution_m"],
        method=meta["method"],
    )


class HorizonMaskService:
    """Terrain horizon masks (contract C1) for registered sites or coordinates."""

    def __init__(self, registry: DatasetRegistry, layout: DataLayout, sites: SiteService) -> None:
        self._registry = registry
        self._layout = layout
        self._sites = sites
        self.computed = 0
        """Masks computed (not served from the cache) by this instance; for tests."""

    @property
    def manifest(self) -> DatasetManifest:
        return self._registry.get(HORIZON_DATASET)

    @property
    def cache_dir(self) -> Path:
        return self._layout.processed / HORIZON_DATASET / "horizon-masks"

    def get_site_mask(
        self, site_id: str, *, observer_height_m: float = DEFAULT_OBSERVER_HEIGHT_M
    ) -> HorizonMask:
        site = self._sites.get_site(site_id)  # NotFoundError for an unknown id
        return self.get_mask(
            latitude_deg=site.coordinate.latitude_deg,
            longitude_deg=site.coordinate.longitude_deg,
            observer_height_m=observer_height_m,
        )

    def get_mask(
        self,
        *,
        latitude_deg: float,
        longitude_deg: float,
        observer_height_m: float = DEFAULT_OBSERVER_HEIGHT_M,
    ) -> HorizonMask:
        if not math.isfinite(observer_height_m) or observer_height_m < 0.0:
            raise OutOfCoverageError("observer_height_m must be finite and non-negative")
        manifest = self._registry.get(HORIZON_DATASET)
        pinned = next(f.sha256 for f in manifest.files if f.role.value == "data")
        if pinned is not None:
            base = self.cache_dir / mask_cache_key(
                pinned, latitude_deg, longitude_deg, observer_height_m
            )
            with _LOCK:
                cached = _read(base)
            if cached is not None:
                return cached
        dem = TerrainSceneService(self._registry, self._layout).load_dem(manifest)
        try:
            mask = compute_horizon_mask(
                dem, latitude_deg, longitude_deg, observer_height_m=observer_height_m
            )
        except HorizonError as exc:
            raise OutOfCoverageError(
                f"No horizon mask at ({latitude_deg}, {longitude_deg}): {exc}. "
                f"{HORIZON_DATASET} covers about 75°S–90°S."
            ) from None
        self.computed += 1
        base = self.cache_dir / mask_cache_key(
            dem.sha256, latitude_deg, longitude_deg, observer_height_m
        )
        with _LOCK:
            _write(base, mask)
        return mask


__all__ = [
    "DEFAULT_OBSERVER_HEIGHT_M",
    "HORIZON_DATASET",
    "HORIZON_METHOD_VERSION",
    "HorizonMaskService",
    "OutOfCoverageError",
    "mask_cache_key",
]
