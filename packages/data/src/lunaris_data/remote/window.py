"""Windowed reads of remote south polar stereographic GeoTIFF DEMs (GDAL ``/vsicurl/``).

The PGDA LOLA 20 m and 10 m south-pole mosaics are multi-gigabyte tiled BigTIFFs served
with ``Accept-Ranges: bytes``. Instead of downloading them, LUNARIS reads a window around
a site through GDAL's ``/vsicurl/``, which fetches only the tiles the window touches.

Every read carries provenance: the URL, the HTTP validators observed at read time (which
must match the manifest's pins, otherwise the product changed and the read is refused),
the window in pixel and map coordinates, the bytes requested over HTTP and the number of
retried requests.

Network behaviour (observed 2026-11-04 against ``pgda.gsfc.nasa.gov``):

* the server intermittently answers a valid ranged GET with **HTTP 403**; the same request
  succeeds when repeated. GDAL is therefore configured to retry 403/429/5xx a bounded
  number of times (:data:`MAX_RETRIES`, :data:`RETRY_DELAY_S`); each retry is counted and
  logged;
* multi-range requests (one GET carrying several byte ranges) stall behind HTTP proxies,
  so ``GDAL_HTTP_MULTIRANGE=SINGLE_GET`` is used (adjacent ranges are merged).

Fallback (``docs/DECISIONS.md`` D3): a successful window can be written to a local cache
under ``data/processed/<dataset-id>/windows/`` together with its provenance; a later
request for the same window of the same pinned remote version (URL, ETag, size) is
served from that cache **before any network access**, so analysis keeps working when the
server is unreachable. If remote reads are unusable, the per-site PGDA 5 m tiles
(product 78) can be downloaded instead.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import re
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

import httpx
import numpy as np
import rasterio
from rasterio.windows import Window

from lunaris_data import __version__
from lunaris_data.manifest import DatasetManifest, FileRole
from lunaris_science.terrain.dem import PolarDem
from lunaris_science.terrain.polar_stereographic import (
    PolarStereographicGrid,
    SouthPolarStereographic,
)

logger = logging.getLogger("lunaris_data.remote")

MAX_RETRIES = 6
RETRY_DELAY_S = 1.0
RETRY_CODES = "403,429,500,502,503,504"
MAX_WINDOW_SIDE_PX = 4096
"""Largest window side; 4096² float32 is 64 MiB uncompressed."""

_GDAL_ENV = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.TIF,.tiff,.TIFF",
    "GDAL_HTTP_MULTIRANGE": "SINGLE_GET",
    "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
    "GDAL_HTTP_MAX_RETRY": str(MAX_RETRIES),
    "GDAL_HTTP_RETRY_DELAY": str(RETRY_DELAY_S),
    "GDAL_HTTP_RETRY_CODES": RETRY_CODES,
    "GDAL_HTTP_TIMEOUT": "60",
    "VSI_CACHE": "FALSE",
    "CPL_DEBUG": "ON",
}
_DOWNLOAD = re.compile(r"VSICURL: Downloading (\d+)-(\d+) ")
_RESPONSE = re.compile(r"Got response_code=(\d+)")
_READ_LOCK = threading.Lock()
"""GDAL debug output is process-global; reads are serialized so byte accounting is exact."""


class RemoteWindowError(RuntimeError):
    """A remote windowed read failed or was refused."""


@dataclass(frozen=True, slots=True)
class RemoteSource:
    """A remote GeoTIFF and the HTTP validators pinned in its manifest."""

    dataset_id: str
    url: str
    size_bytes: int
    etag: str | None
    last_modified: str | None
    reference_radius_m: float = 1_737_400.0


@dataclass(frozen=True, slots=True)
class WindowProvenance:
    dataset_id: str
    url: str
    etag: str | None
    last_modified: str | None
    content_length: int
    window_col_row_width_height: tuple[int, int, int, int]
    window_map_bounds_m: tuple[float, float, float, float]
    """(x_min, x_max, y_min, y_max) of the window's outer pixel edges, map metres."""
    resolution_m: float
    geotransform_a_c_f: tuple[float, float, float]
    """Pixel size and upper-left corner (x, y) of the full raster, map metres."""
    http_requests: int
    http_retries: int
    bytes_requested: int
    """Sum of the HTTP byte ranges GDAL requested, including retried requests."""
    read_at_utc: str
    served_from_cache: bool
    tool: str

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2) + "\n"


@dataclass(frozen=True, slots=True)
class DemWindow:
    dem: PolarDem
    provenance: WindowProvenance


class _GdalNetworkLog(logging.Handler):
    def __init__(self) -> None:
        super().__init__(level=logging.DEBUG)
        self.bytes_requested = 0
        self.requests = 0
        self.failed = 0

    def emit(self, record: logging.LogRecord) -> None:
        message = record.getMessage()
        if match := _DOWNLOAD.search(message):
            self.requests += 1
            self.bytes_requested += int(match.group(2)) - int(match.group(1)) + 1
        elif (match := _RESPONSE.search(message)) and int(match.group(1)) >= 400:  # noqa: PLR2004
            self.failed += 1


def check_validators(source: RemoteSource, client: httpx.Client) -> httpx.Headers:
    """HEAD the URL and compare size and validators with the manifest pins.

    Raises:
        RemoteWindowError: unreachable, or the remote file differs from the pinned version.
    """
    try:
        response = client.head(source.url, follow_redirects=True)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise RemoteWindowError(f"HEAD {source.url} failed: {exc}") from exc
    headers = response.headers
    length = int(headers.get("content-length", "-1"))
    if length != source.size_bytes:
        raise RemoteWindowError(
            f"{source.url} is {length} B, the manifest pins {source.size_bytes} B; "
            "the remote product changed"
        )
    if source.etag is not None and headers.get("etag") != source.etag:
        raise RemoteWindowError(
            f"{source.url} ETag {headers.get('etag')!r} differs from the pinned {source.etag!r}"
        )
    if source.last_modified is not None and headers.get("last-modified") != source.last_modified:
        raise RemoteWindowError(
            f"{source.url} Last-Modified {headers.get('last-modified')!r} differs from the "
            f"pinned {source.last_modified!r}"
        )
    if headers.get("accept-ranges", "").lower() != "bytes":
        raise RemoteWindowError(f"{source.url} does not advertise byte-range support")
    return headers


def _check_crs(dataset: rasterio.DatasetReader, radius_m: float) -> None:
    params = dataset.crs.to_dict() if dataset.crs else {}
    expected = {"proj": "stere", "lat_0": -90.0, "lon_0": 0.0, "x_0": 0.0, "y_0": 0.0}
    for key, value in expected.items():
        got = params.get(key)
        if got != value:
            raise RemoteWindowError(f"CRS parameter {key}={got!r}, expected {value!r}")
    if params.get("lat_ts", -90.0) != -90.0:  # noqa: PLR2004
        raise RemoteWindowError("CRS must be true scale at the pole (lat_ts = -90)")
    if params.get("R") != radius_m:
        raise RemoteWindowError(f"CRS sphere radius {params.get('R')!r}, expected {radius_m}")
    t = dataset.transform
    if t.b != 0.0 or t.d != 0.0 or t.a <= 0.0 or t.e != -t.a:
        raise RemoteWindowError(f"unsupported geotransform {tuple(t)[:6]}")
    if dataset.count != 1 or dataset.dtypes[0] != "float32":
        raise RemoteWindowError("expected a single float32 band")


def _cache_path(cache_dir: Path, source: RemoteSource, request: tuple[float, float, int]) -> Path:
    key = f"{source.url}|{source.etag}|{source.last_modified}|{source.size_bytes}|{request}"
    return cache_dir / hashlib.sha256(key.encode()).hexdigest()[:24]


def _window_dem(
    heights: np.ndarray,
    geotransform_a_c_f: tuple[float, float, float],
    window: tuple[int, int, int, int],
    source: RemoteSource,
) -> PolarDem:
    col0, row0, width, height = window
    scale, transform_c, transform_f = geotransform_a_c_f
    # Pixel-centre convention: x = c + a (col + 0.5) = (sample - s0) * a with
    # s0 = -c/a - 0.5; y = f - a (row + 0.5) = -(line - l0) * a with l0 = f/a - 0.5.
    s0 = -transform_c / scale - 0.5 - col0
    l0 = transform_f / scale - 0.5 - row0
    grid = PolarStereographicGrid(
        lines=height,
        samples=width,
        line_projection_offset_px=l0,
        sample_projection_offset_px=s0,
        map_scale_m=scale,
        projection=SouthPolarStereographic(source.reference_radius_m),
    )
    data = np.ascontiguousarray(heights, dtype=np.float32)
    return PolarDem(
        heights_m=data,
        grid=grid,
        reference_radius_m=source.reference_radius_m,
        dataset_id=source.dataset_id,
        file_name=f"{source.url.rsplit('/', 1)[-1]}[window {col0},{row0},{width},{height}]",
        # A window has no file of its own: this is the SHA-256 of its float32 values.
        sha256=hashlib.sha256(data.tobytes()).hexdigest(),
        frame="MEAN EARTH/POLAR AXIS OF DE421",
    )


@contextmanager
def _capture_gdal_network(handler: _GdalNetworkLog) -> Iterator[None]:
    """Route GDAL's /vsicurl/ debug messages to ``handler`` (serialized: GDAL logs globally)."""
    gdal_loggers = [logging.getLogger(name) for name in ("rasterio._env", "rasterio._err")]
    with _READ_LOCK:
        previous = [(lg, lg.level) for lg in gdal_loggers]
        for lg in gdal_loggers:
            lg.addHandler(handler)
            lg.setLevel(logging.DEBUG)
        try:
            yield
        finally:
            for lg, level in previous:
                lg.removeHandler(handler)
                lg.setLevel(level)


def _locate_window(
    dataset: rasterio.DatasetReader,
    source: RemoteSource,
    latitude_deg: float,
    longitude_deg: float,
    side_px: int,
) -> tuple[int, int, int, int]:
    """Window (col, row, width, height) centred on the site, clipped to the raster."""
    t = dataset.transform
    x, y = SouthPolarStereographic(source.reference_radius_m).forward(latitude_deg, longitude_deg)
    col_c = (float(x) - t.c) / t.a
    row_c = (float(y) - t.f) / t.e
    col0 = max(0, math.floor(col_c - side_px / 2))
    row0 = max(0, math.floor(row_c - side_px / 2))
    col1 = min(dataset.width, math.floor(col_c - side_px / 2) + side_px)
    row1 = min(dataset.height, math.floor(row_c - side_px / 2) + side_px)
    if col1 <= col0 or row1 <= row0:
        raise RemoteWindowError("the window lies outside the raster")
    return (col0, row0, col1 - col0, row1 - row0)


def read_window(
    source: RemoteSource,
    *,
    latitude_deg: float,
    longitude_deg: float,
    side_px: int,
    client: httpx.Client | None = None,
    cache_dir: Path | None = None,
) -> DemWindow:
    """Read a ``side_px × side_px`` window centred on a site from a remote GeoTIFF.

    The window is clipped to the raster. Heights are float32 metres above the reference
    sphere; the product's nodata (NaN) stays NaN.

    Raises:
        RemoteWindowError: on validator mismatch, unsupported CRS, a window outside the
            raster, or a read that fails after the bounded retries.
    """
    if not 1 <= side_px <= MAX_WINDOW_SIDE_PX:
        raise RemoteWindowError(f"side_px must be within [1, {MAX_WINDOW_SIDE_PX}]")
    request = (float(latitude_deg), float(longitude_deg), int(side_px))
    cached = _read_cache(cache_dir, source, request)
    if cached is not None:
        heights, provenance = cached
        dem = _window_dem(
            heights, provenance.geotransform_a_c_f, provenance.window_col_row_width_height, source
        )
        return DemWindow(dem, provenance)

    own_client = client is None
    http = client or httpx.Client(
        timeout=30.0, headers={"User-Agent": f"lunaris-data/{__version__}"}
    )
    try:
        headers = check_validators(source, http)
    finally:
        if own_client:
            http.close()

    handler = _GdalNetworkLog()
    with (
        _capture_gdal_network(handler),
        rasterio.Env(**_GDAL_ENV),
        rasterio.open(f"/vsicurl/{source.url}") as dataset,
    ):
        _check_crs(dataset, source.reference_radius_m)
        t = dataset.transform
        window = _locate_window(dataset, source, latitude_deg, longitude_deg, side_px)
        try:
            heights = dataset.read(1, window=Window(*window), masked=False)
        except rasterio.errors.RasterioIOError as exc:
            raise RemoteWindowError(
                f"windowed read of {source.url} failed (GDAL retries up to {MAX_RETRIES} "
                f"times on {RETRY_CODES}): {exc}"
            ) from exc

    x_min = t.c + t.a * window[0]
    y_max = t.f + t.e * window[1]
    provenance = WindowProvenance(
        dataset_id=source.dataset_id,
        url=source.url,
        etag=headers.get("etag"),
        last_modified=headers.get("last-modified"),
        content_length=int(headers["content-length"]),
        window_col_row_width_height=window,
        window_map_bounds_m=(x_min, x_min + t.a * window[2], y_max + t.e * window[3], y_max),
        resolution_m=t.a,
        geotransform_a_c_f=(t.a, t.c, t.f),
        http_requests=handler.requests,
        http_retries=handler.failed,
        bytes_requested=handler.bytes_requested,
        read_at_utc=datetime.now(UTC).isoformat(timespec="seconds"),
        served_from_cache=False,
        tool=f"lunaris-data {__version__}, GDAL {rasterio.__gdal_version__} /vsicurl/",
    )
    logger.info(
        "remote window %s %s: %d requests, %d retried, %d B requested",
        source.dataset_id,
        window,
        provenance.http_requests,
        provenance.http_retries,
        provenance.bytes_requested,
    )
    if cache_dir is not None:
        _write_cache(cache_dir, source, request, heights, provenance)
    return DemWindow(_window_dem(heights, (t.a, t.c, t.f), window, source), provenance)


def _read_cache(
    cache_dir: Path | None, source: RemoteSource, request: tuple[float, float, int]
) -> tuple[np.ndarray, WindowProvenance] | None:
    if cache_dir is None:
        return None
    base = _cache_path(cache_dir, source, request)
    data_path, meta_path = base.with_suffix(".f32"), base.with_suffix(".json")
    if not (data_path.is_file() and meta_path.is_file()):
        return None
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    meta["window_col_row_width_height"] = tuple(meta["window_col_row_width_height"])
    meta["window_map_bounds_m"] = tuple(meta["window_map_bounds_m"])
    meta["geotransform_a_c_f"] = tuple(meta["geotransform_a_c_f"])
    window = meta["window_col_row_width_height"]
    meta["served_from_cache"] = True
    provenance = WindowProvenance(**meta)
    heights = np.fromfile(data_path, dtype="<f4").reshape(window[3], window[2])
    return heights, provenance


def _write_cache(
    cache_dir: Path,
    source: RemoteSource,
    request: tuple[float, float, int],
    heights: np.ndarray,
    provenance: WindowProvenance,
) -> None:
    cache_dir.mkdir(parents=True, exist_ok=True)
    base = _cache_path(cache_dir, source, request)
    np.ascontiguousarray(heights, dtype="<f4").tofile(base.with_suffix(".f32"))
    base.with_suffix(".json").write_text(provenance.to_json(), encoding="utf-8")


def remote_source(
    manifest: DatasetManifest, reference_radius_m: float = 1_737_400.0
) -> RemoteSource:
    """Build a :class:`RemoteSource` from a remote-window manifest (single data file)."""
    if not manifest.is_remote_window:
        raise RemoteWindowError(f"{manifest.id!r} is not a remote windowed source")
    data = [f for f in manifest.files if f.role is FileRole.DATA]
    if len(data) != 1 or data[0].size_bytes is None:
        raise RemoteWindowError(f"{manifest.id!r} must list one data file with size_bytes")
    spec = data[0]
    assert spec.size_bytes is not None  # noqa: S101 - checked above
    return RemoteSource(
        dataset_id=manifest.id,
        url=str(spec.url),
        size_bytes=spec.size_bytes,
        etag=spec.etag,
        last_modified=spec.last_modified,
        reference_radius_m=reference_radius_m,
    )


__all__ = [
    "MAX_RETRIES",
    "MAX_WINDOW_SIDE_PX",
    "DemWindow",
    "RemoteSource",
    "RemoteWindowError",
    "WindowProvenance",
    "check_validators",
    "read_window",
    "remote_source",
]
