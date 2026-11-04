"""Build the web visualization texture for the 3D globe from an acquired color map.

Input: an acquired, global, equirectangular 8-bit RGB color map (by default the NASA
SVS CGI Moon Kit). Output, in ``output_dir``:

* ``moon-color.jpg`` — the color map, optionally downsampled, JPEG-encoded;
* ``manifest.json`` — provenance of the texture (source dataset, file checksum,
  retrieval time, credit, projection assumptions, generator version).

The web client reads ``manifest.json`` to decide whether a real texture is available
and displays its provenance; without it the client shows a labeled procedural
placeholder. This artefact is for **visualization only** and is never an analysis input.
"""

from __future__ import annotations

import json
import warnings
from datetime import datetime
from pathlib import Path
from typing import Literal

import numpy as np
import rasterio
from pydantic import BaseModel, ConfigDict
from rasterio.enums import Resampling
from rasterio.errors import NotGeoreferencedWarning

from lunaris_data import __version__
from lunaris_data.manifest import FileRole
from lunaris_data.registry import DatasetRegistry
from lunaris_data.store import DataLayout, DatasetStatus, inspect_dataset, utc_now

DEFAULT_DATASET_ID = "nasa-svs-cgi-moon-kit"
TEXTURE_FILE_NAME = "moon-color.jpg"
MANIFEST_FILE_NAME = "manifest.json"
RGB_BANDS = 3


class PreprocessingError(RuntimeError):
    """The texture could not be built from the available inputs."""


class TextureSource(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    dataset_id: str
    dataset_title: str
    file: str
    source_url: str
    sha256: str
    retrieved_at_utc: datetime


class WebTextureManifest(BaseModel):
    """Schema of ``manifest.json`` consumed by the web client."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    schema_version: Literal[1] = 1
    kind: Literal["lunar-color-equirectangular"] = "lunar-color-equirectangular"
    file: str
    width: int
    height: int
    projection: Literal["equirectangular"] = "equirectangular"
    longitude_min_deg: float = -180.0
    longitude_max_deg: float = 180.0
    latitude_max_deg: float = 90.0
    latitude_min_deg: float = -90.0
    source: TextureSource
    credit: str
    usage: str
    assumptions: tuple[str, ...]
    generated_at_utc: datetime
    generator: str


def _output_size(width: int, height: int, max_width: int) -> tuple[int, int]:
    if width <= max_width:
        return width, height
    scale = max_width / width
    return max_width, max(1, round(height * scale))


def build_web_texture(
    layout: DataLayout,
    registry: DatasetRegistry,
    output_dir: Path,
    *,
    dataset_id: str = DEFAULT_DATASET_ID,
    source_file: str | None = None,
    quality: int = 88,
    max_width: int = 4096,
) -> WebTextureManifest:
    """Create the web texture and its provenance manifest. See module docstring."""
    if not 1 <= quality <= 100:  # noqa: PLR2004 - JPEG quality domain
        raise PreprocessingError("JPEG quality must be within 1..100")
    manifest = registry.get(dataset_id)
    state = inspect_dataset(manifest, layout)
    if state.status is not DatasetStatus.ACQUIRED or state.record is None:
        raise PreprocessingError(
            f"dataset {dataset_id!r} is {state.status.value}; run "
            f"`uv run lunaris-data acquire {dataset_id}` first"
        )

    if source_file is None:
        visual = [f for f in manifest.files if f.role is FileRole.VISUAL]
        if not visual:
            raise PreprocessingError(f"dataset {dataset_id!r} has no file with role 'visual'")
        source_file = visual[0].name
    recorded = state.record.file(source_file)
    if recorded is None:
        raise PreprocessingError(f"{source_file!r} is not part of the acquisition record")
    source_path = state.directory / source_file

    with warnings.catch_warnings():
        # Visualization maps are typically distributed without georeferencing.
        warnings.simplefilter("ignore", NotGeoreferencedWarning)
        with rasterio.open(source_path) as src:
            if src.count < RGB_BANDS:
                raise PreprocessingError(f"{source_file}: expected ≥3 bands, found {src.count}")
            if any(dtype != "uint8" for dtype in src.dtypes[:RGB_BANDS]):
                raise PreprocessingError(f"{source_file}: expected 8-bit bands, got {src.dtypes}")
            if abs(src.width - 2 * src.height) > 1:
                raise PreprocessingError(
                    f"{source_file}: {src.width}×{src.height} is not a 2:1 global "
                    "equirectangular map"
                )
            out_width, out_height = _output_size(src.width, src.height, max_width)
            rgb = src.read(
                indexes=[1, 2, 3],
                out_shape=(RGB_BANDS, out_height, out_width),
                resampling=Resampling.average,
            ).astype(np.uint8, copy=False)

    output_dir.mkdir(parents=True, exist_ok=True)
    texture_path = output_dir / TEXTURE_FILE_NAME
    with (
        rasterio.Env(GDAL_PAM_ENABLED="NO"),
        warnings.catch_warnings(),
    ):
        warnings.simplefilter("ignore", NotGeoreferencedWarning)
        with rasterio.open(
            texture_path,
            "w",
            driver="JPEG",
            width=out_width,
            height=out_height,
            count=RGB_BANDS,
            dtype="uint8",
            QUALITY=str(quality),
        ) as dst:
            dst.write(rgb)

    projection_note = (manifest.spatial.projection if manifest.spatial else None) or (
        "equirectangular, longitude −180..180 centred on 0°, north up"
    )
    texture_manifest = WebTextureManifest(
        file=TEXTURE_FILE_NAME,
        width=out_width,
        height=out_height,
        source=TextureSource(
            dataset_id=manifest.id,
            dataset_title=manifest.title,
            file=source_file,
            source_url=recorded.source_url,
            sha256=recorded.sha256,
            retrieved_at_utc=recorded.retrieved_at_utc,
        ),
        credit=manifest.citation,
        usage="Visualization only — not an analysis input.",
        assumptions=(f"Projection: {projection_note}",),
        generated_at_utc=utc_now(),
        generator=f"lunaris-data {__version__}",
    )
    (output_dir / MANIFEST_FILE_NAME).write_text(
        json.dumps(texture_manifest.model_dump(mode="json"), indent=2) + "\n", encoding="utf-8"
    )
    return texture_manifest


__all__ = [
    "DEFAULT_DATASET_ID",
    "MANIFEST_FILE_NAME",
    "TEXTURE_FILE_NAME",
    "PreprocessingError",
    "WebTextureManifest",
    "build_web_texture",
]
