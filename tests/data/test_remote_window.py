"""Remote windowed reads of polar stereographic GeoTIFFs (task T-13).

A loopback server with byte-range support serves a SYNTHETIC tiled, deflate-compressed
GeoTIFF in the PGDA layout (same CRS, 512² tiles, float32). An optional live test reads
the real PGDA 20 m mosaic when LUNARIS_NETWORK_TESTS=1.
"""

from __future__ import annotations

import os
import re
import threading
from collections.abc import Iterator
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import httpx
import numpy as np
import pytest
import rasterio
from rasterio.transform import Affine

from lunaris_data.ingestion.acquire import AcquisitionError, acquire_dataset
from lunaris_data.registry import DatasetRegistry
from lunaris_data.remote.window import (
    RemoteSource,
    RemoteWindowError,
    read_window,
    remote_source,
)
from lunaris_data.store import DataLayout
from lunaris_science.terrain.polar_stereographic import SouthPolarStereographic

R = 1_737_400.0
N, SCALE = 2048, 20.0
HALF = N * SCALE / 2  # ±20.48 km
CRS = "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
ETAG = '"synthetic-v1"'
LAST_MODIFIED = "Wed, 04 Nov 2026 00:00:00 GMT"


def planar(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    return 0.01 * x - 0.02 * y + 100.0


def write_geotiff(path: Path, crs: str = CRS) -> None:
    cols = np.arange(N)
    x = -HALF + SCALE * (cols + 0.5)
    y = HALF - SCALE * (cols + 0.5)
    data = planar(x[np.newaxis, :], y[:, np.newaxis]).astype(np.float32)
    data[100:110, 200:210] = np.nan
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=N,
        height=N,
        count=1,
        dtype="float32",
        crs=crs,
        transform=Affine(SCALE, 0, -HALF, 0, -SCALE, HALF),
        nodata=np.nan,
        tiled=True,
        blockxsize=512,
        blockysize=512,
        compress="deflate",
        BIGTIFF="YES",
    ) as dst:
        dst.write(data, 1)


@dataclass
class RangeServer:
    path: Path
    url: str
    fail_next_gets: int = 0
    gets: int = 0
    lock: threading.Lock = field(default_factory=threading.Lock)


def _handler(state: RangeServer) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: object) -> None:
            return

        def _headers(self, length: int, status: int = 200) -> None:
            self.send_response(status)
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("ETag", ETAG)
            self.send_header("Last-Modified", LAST_MODIFIED)
            self.send_header("Content-Type", "image/tiff")
            self.send_header("Content-Length", str(length))

        def do_HEAD(self) -> None:
            self._headers(state.path.stat().st_size)
            self.end_headers()

        def do_GET(self) -> None:
            with state.lock:
                state.gets += 1
                fail = state.fail_next_gets > 0
                if fail:
                    state.fail_next_gets -= 1
            if fail:
                body = b"<html>403 Forbidden</html>"
                self.send_response(403)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            payload = state.path.read_bytes()
            match = re.fullmatch(r"bytes=(\d+)-(\d*)", self.headers.get("Range", ""))
            if match is None:
                self._headers(len(payload))
                self.end_headers()
                self.wfile.write(payload)
                return
            start = int(match.group(1))
            end = min(int(match.group(2) or len(payload) - 1), len(payload) - 1)
            chunk = payload[start : end + 1]
            self._headers(len(chunk), status=206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{len(payload)}")
            self.end_headers()
            self.wfile.write(chunk)

    return Handler


@pytest.fixture
def range_server(tmp_path: Path) -> Iterator[RangeServer]:
    path = tmp_path / "remote" / "SYNTH_20MPP.TIF"
    path.parent.mkdir()
    write_geotiff(path)
    state = RangeServer(path=path, url="")
    server = ThreadingHTTPServer(("127.0.0.1", 0), _handler(state))
    state.url = f"http://127.0.0.1:{server.server_address[1]}/SYNTH_20MPP.TIF"
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield state
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


@pytest.fixture
def client() -> Iterator[httpx.Client]:
    with httpx.Client(trust_env=False, timeout=10.0) as http:
        yield http


@pytest.fixture(autouse=True)
def _no_proxy_for_loopback(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"):
        monkeypatch.delenv(name, raising=False)


def _source(server: RangeServer, **overrides: object) -> RemoteSource:
    values: dict[str, object] = {
        "dataset_id": "synthetic",
        "url": server.url,
        "size_bytes": server.path.stat().st_size,
        "etag": ETAG,
        "last_modified": LAST_MODIFIED,
    }
    values.update(overrides)
    return RemoteSource(**values)  # type: ignore[arg-type]


def _site(x: float, y: float) -> tuple[float, float]:
    lat, lon = SouthPolarStereographic(R).inverse(x, y)
    return float(lat), float(lon)


def test_window_values_geometry_and_provenance(
    range_server: RangeServer, client: httpx.Client
) -> None:
    lat, lon = _site(3000.0, -5000.0)
    window = read_window(
        _source(range_server), latitude_deg=lat, longitude_deg=lon, side_px=300, client=client
    )
    dem = window.dem
    assert dem.heights_m.shape == (300, 300)
    # Bilinear sampling of the plane at the site reproduces the analytic height.
    assert float(dem.height_at(lat, lon)) == pytest.approx(
        float(planar(np.float64(3000.0), np.float64(-5000.0))), abs=1e-3
    )
    p = window.provenance
    assert p.url == range_server.url
    assert p.etag == ETAG
    assert p.last_modified == LAST_MODIFIED
    assert p.window_col_row_width_height[2:] == (300, 300)
    x_min, x_max, y_min, y_max = p.window_map_bounds_m
    assert x_min < 3000.0 < x_max
    assert y_min < -5000.0 < y_max
    assert x_max - x_min == 300 * SCALE
    assert not p.served_from_cache
    assert p.http_retries == 0
    # Only the touched tiles were requested: far less than the file.
    assert 0 < p.bytes_requested < 0.5 * range_server.path.stat().st_size


def test_nodata_stays_nan(range_server: RangeServer, client: httpx.Client) -> None:
    x = -HALF + SCALE * 205
    y = HALF - SCALE * 105
    lat, lon = _site(x, y)
    window = read_window(
        _source(range_server), latitude_deg=lat, longitude_deg=lon, side_px=64, client=client
    )
    assert np.isnan(window.dem.heights_m).sum() == 100
    assert np.isnan(window.dem.height_at(lat, lon))


def test_window_is_clipped_at_the_raster_edge(
    range_server: RangeServer, client: httpx.Client
) -> None:
    lat, lon = _site(-HALF + 100.0, HALF - 100.0)
    window = read_window(
        _source(range_server), latitude_deg=lat, longitude_deg=lon, side_px=200, client=client
    )
    col, row, width, height = window.provenance.window_col_row_width_height
    assert (col, row) == (0, 0)
    assert width < 200
    assert height < 200


def test_transient_403_is_retried_and_counted(
    range_server: RangeServer, client: httpx.Client
) -> None:
    lat, lon = _site(0.0, 0.0)
    range_server.fail_next_gets = 2
    window = read_window(
        _source(range_server), latitude_deg=lat, longitude_deg=lon, side_px=100, client=client
    )
    assert window.provenance.http_retries == 2
    assert np.isfinite(window.dem.heights_m).all()


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"etag": '"other"'}, "ETag"),
        ({"last_modified": "Thu, 01 Jan 1970 00:00:00 GMT"}, "Last-Modified"),
        ({"size_bytes": 12345}, "remote product changed"),
    ],
)
def test_validator_mismatch_is_refused(
    range_server: RangeServer, client: httpx.Client, overrides: dict[str, object], message: str
) -> None:
    lat, lon = _site(0.0, 0.0)
    with pytest.raises(RemoteWindowError, match=message):
        read_window(
            _source(range_server, **overrides),
            latitude_deg=lat,
            longitude_deg=lon,
            side_px=10,
            client=client,
        )


def test_wrong_crs_is_refused(range_server: RangeServer, client: httpx.Client) -> None:
    write_geotiff(range_server.path, crs=CRS.replace("+lon_0=0", "+lon_0=180"))
    lat, lon = _site(0.0, 0.0)
    with pytest.raises(RemoteWindowError, match="lon_0"):
        read_window(
            _source(range_server), latitude_deg=lat, longitude_deg=lon, side_px=10, client=client
        )


def test_window_outside_raster_and_bad_size(
    range_server: RangeServer, client: httpx.Client
) -> None:
    with pytest.raises(RemoteWindowError, match="outside"):
        read_window(
            _source(range_server), latitude_deg=-85.0, longitude_deg=0.0, side_px=10, client=client
        )
    with pytest.raises(RemoteWindowError, match="side_px"):
        read_window(
            _source(range_server), latitude_deg=-89.9, longitude_deg=0.0, side_px=0, client=client
        )


def test_cache_fallback_serves_without_network(
    range_server: RangeServer, client: httpx.Client, tmp_path: Path
) -> None:
    lat, lon = _site(1000.0, 1000.0)
    cache = tmp_path / "processed" / "synthetic" / "windows"
    first = read_window(
        _source(range_server),
        latitude_deg=lat,
        longitude_deg=lon,
        side_px=128,
        client=client,
        cache_dir=cache,
    )
    range_server.fail_next_gets = 10_000  # the server is now unusable
    gets_before = range_server.gets
    second = read_window(
        _source(range_server),
        latitude_deg=lat,
        longitude_deg=lon,
        side_px=128,
        client=client,
        cache_dir=cache,
    )
    assert range_server.gets == gets_before  # no network access at all
    assert second.provenance.served_from_cache
    np.testing.assert_array_equal(second.dem.heights_m, first.dem.heights_m)
    assert (
        second.provenance.window_col_row_width_height
        == first.provenance.window_col_row_width_height
    )
    assert float(second.dem.height_at(lat, lon)) == pytest.approx(
        float(first.dem.height_at(lat, lon))
    )


def test_pgda_manifest_is_remote_and_never_acquired(tmp_path: Path) -> None:
    manifest = DatasetRegistry.load_builtin().get("pgda-lola-20mpp-80s")
    source = remote_source(manifest)
    assert source.size_bytes == 2_696_082_051
    assert source.etag is not None
    with pytest.raises(AcquisitionError, match="remote windowed source"):
        acquire_dataset(manifest, DataLayout.from_root(tmp_path / "data"))
    with pytest.raises(RemoteWindowError):
        remote_source(DatasetRegistry.load_builtin().get("lola-ldem-75s-240m"))


@pytest.mark.skipif(
    os.environ.get("LUNARIS_NETWORK_TESTS") != "1", reason="set LUNARIS_NETWORK_TESTS=1"
)
def test_live_pgda_window_1000px(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.undo()  # restore proxy settings for real network access
    source = remote_source(DatasetRegistry.load_builtin().get("pgda-lola-20mpp-80s"))
    window = read_window(source, latitude_deg=-89.45, longitude_deg=222.69, side_px=1000)
    p = window.provenance
    assert window.dem.heights_m.shape == (1000, 1000)
    assert p.bytes_requested < 100 * 1024 * 1024
    assert p.etag == source.etag
    print(
        f"\nPGDA window {p.window_col_row_width_height}: {p.http_requests} requests, "
        f"{p.http_retries} retried, {p.bytes_requested} B requested"
    )
