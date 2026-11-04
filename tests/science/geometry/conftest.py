"""Shared fixtures for geometry tests.

Tests that need the NAIF kernel set use the real, checksum-verified kernels from the data
store (``LUNARIS_DATA_DIR`` or the repository's ``data/``). Without them those tests are
skipped with the acquisition command as the reason; set ``LUNARIS_REQUIRE_KERNELS=1`` to
turn the skip into a failure (for CI jobs that acquire the kernels).
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from lunaris_api.services.ephemeris import (
    KERNEL_DATASET_ID,
    KernelSetUnavailableError,
    get_spice_context,
)
from lunaris_data.registry import DatasetRegistry
from lunaris_data.store import DataLayout
from lunaris_science.geometry.spice import SpiceContext

REPO_ROOT = Path(__file__).resolve().parents[3]


def data_layout() -> DataLayout:
    return DataLayout.from_root(os.environ.get("LUNARIS_DATA_DIR", REPO_ROOT / "data"))


@pytest.fixture
def spice_context() -> SpiceContext:
    manifest = DatasetRegistry.load_builtin().get(KERNEL_DATASET_ID)
    try:
        return get_spice_context(manifest, data_layout())
    except KernelSetUnavailableError as exc:
        if os.environ.get("LUNARIS_REQUIRE_KERNELS") == "1":
            pytest.fail(str(exc))
        pytest.skip(str(exc))
