"""T-20: SPICE kernel context — verified kernel set, frame chain, process-wide lock."""

from __future__ import annotations

import hashlib
import json
import shutil
import threading
from pathlib import Path

import numpy as np
import pytest
import spiceypy

from lunaris_api.services.ephemeris import (
    KERNEL_DATASET_ID,
    KernelSetUnavailableError,
    load_verified_kernel_set,
)
from lunaris_data.registry import DatasetRegistry
from lunaris_data.store import DataLayout
from lunaris_science.geometry.spice import (
    SPICE_LOCK,
    KernelFile,
    KernelRole,
    KernelSet,
    SpiceContext,
    SpiceKernelError,
)
from lunaris_science.provenance import SourceReference

SHA = "0" * 64
ARCSEC_PER_RAD = 180.0 / np.pi * 3600.0


def _source(name: str, sha256: str | None = SHA) -> SourceReference:
    return SourceReference(source_id=f"test/{name}", title=name, sha256=sha256)


def _kernel(role: KernelRole, name: str, root: Path = Path("/kernels")) -> KernelFile:
    return KernelFile(role=role, path=root / name, source=_source(name))


ALL_ROLES = {
    KernelRole.LSK: "a.tls",
    KernelRole.TEXT_PCK: "b.tpc",
    KernelRole.SPK: "c.bsp",
    KernelRole.BINARY_PCK: "d.bpc",
    KernelRole.FK: "e.tf",
}


# ── Kernel set validation (no kernels needed) ───────────────────────────────


def test_kernel_set_is_ordered_for_furnishing() -> None:
    files = tuple(_kernel(r, n) for r, n in reversed(ALL_ROLES.items()))
    kernel_set = KernelSet("test", files)
    assert [f.role for f in kernel_set.files] == list(KernelRole)
    assert kernel_set.file(KernelRole.SPK).path.name == "c.bsp"
    assert len(kernel_set.sources) == 5


def test_kernel_set_requires_exactly_one_kernel_per_role() -> None:
    files = [_kernel(r, n) for r, n in ALL_ROLES.items() if r is not KernelRole.FK]
    with pytest.raises(SpiceKernelError, match="missing: \\['fk'\\]"):
        KernelSet("test", tuple(files))
    with pytest.raises(SpiceKernelError, match="duplicated: \\['spk'\\]"):
        KernelSet(
            "test", (*files, _kernel(KernelRole.FK, "e.tf"), _kernel(KernelRole.SPK, "x.bsp"))
        )


def test_kernel_file_requires_absolute_path_and_verified_checksum() -> None:
    with pytest.raises(SpiceKernelError, match="absolute"):
        KernelFile(KernelRole.LSK, Path("relative/naif0012.tls"), _source("naif0012.tls"))
    with pytest.raises(SpiceKernelError, match="checksum-verified"):
        KernelFile(KernelRole.LSK, Path("/k/naif0012.tls"), _source("naif0012.tls", None))


@pytest.mark.parametrize(
    ("name", "role"),
    [
        ("naif0012.tls", KernelRole.LSK),
        ("pck00011.tpc", KernelRole.TEXT_PCK),
        ("de440s.bsp", KernelRole.SPK),
        ("moon_pa_de440_200625.bpc", KernelRole.BINARY_PCK),
        ("moon_de440_250416.tf", KernelRole.FK),
    ],
)
def test_kernel_role_from_naif_file_name(name: str, role: KernelRole) -> None:
    assert KernelRole.from_file_name(name) is role


def test_unknown_kernel_extension_is_rejected() -> None:
    with pytest.raises(SpiceKernelError, match="extension"):
        KernelRole.from_file_name("kernels.tm")


# ── Loading from the data store by manifest ────────────────────────────────


def test_missing_kernel_set_is_reported_with_the_acquire_command(tmp_path: Path) -> None:
    manifest = DatasetRegistry.load_builtin().get(KERNEL_DATASET_ID)
    with pytest.raises(KernelSetUnavailableError, match="lunaris-data acquire") as info:
        load_verified_kernel_set(manifest, DataLayout.from_root(tmp_path))
    assert "no acquisition record" in info.value.problems


def _copy_store(spice_context: SpiceContext, tmp_path: Path) -> DataLayout:
    """Mirror the verified store: symlink the large kernels, copy the small ones."""
    source = spice_context.kernel_set.files[0].path.parent
    target = tmp_path / "kernels" / KERNEL_DATASET_ID
    target.mkdir(parents=True)
    for item in source.iterdir():
        if item.stat().st_size > 1_000_000:
            (target / item.name).symlink_to(item)
        else:
            shutil.copy2(item, target / item.name)
    return DataLayout.from_root(tmp_path)


def test_loader_uses_explicit_absolute_paths_and_verified_digests(
    spice_context: SpiceContext,
) -> None:
    manifest = DatasetRegistry.load_builtin().get(KERNEL_DATASET_ID)
    kernel_set = spice_context.kernel_set
    assert kernel_set.dataset_id == KERNEL_DATASET_ID
    pinned = {f.name: f.sha256 for f in manifest.files}
    for kernel in kernel_set.files:
        assert kernel.path.is_absolute()
        assert kernel.source.sha256 == pinned[kernel.path.name]
        assert kernel.source.url is not None
        assert kernel.source.url.startswith("https://naif.jpl.nasa.gov/")


def test_loader_refuses_a_tampered_kernel(spice_context: SpiceContext, tmp_path: Path) -> None:
    layout = _copy_store(spice_context, tmp_path)
    fk = layout.kernels / KERNEL_DATASET_ID / "moon_de440_250416.tf"
    content = bytearray(fk.read_bytes())
    content[100] ^= 0x01  # same size, different digest
    fk.write_bytes(bytes(content))
    manifest = DatasetRegistry.load_builtin().get(KERNEL_DATASET_ID)
    with pytest.raises(
        KernelSetUnavailableError, match=r"moon_de440_250416\.tf: checksum_mismatch"
    ):
        load_verified_kernel_set(manifest, layout)


def test_loader_refuses_a_kernel_matching_its_record_but_not_the_manifest_pin(
    spice_context: SpiceContext, tmp_path: Path
) -> None:
    layout = _copy_store(spice_context, tmp_path)
    directory = layout.kernels / KERNEL_DATASET_ID
    lsk = directory / "naif0012.tls"
    lsk.write_bytes(lsk.read_bytes() + b"\n")
    record_path = directory / "acquisition.json"
    record = json.loads(record_path.read_text())
    for entry in record["files"]:
        if entry["name"] == "naif0012.tls":
            entry["size_bytes"] = lsk.stat().st_size
            entry["sha256"] = hashlib.sha256(lsk.read_bytes()).hexdigest()
    record_path.write_text(json.dumps(record))
    manifest = DatasetRegistry.load_builtin().get(KERNEL_DATASET_ID)
    with pytest.raises(KernelSetUnavailableError, match="pinned_checksum_mismatch"):
        load_verified_kernel_set(manifest, layout)


# ── Frame chain (D2) ────────────────────────────────────────────────────────


def test_moon_me_resolves_to_moon_me_de440_me421(spice_context: SpiceContext) -> None:
    """D2: the generic MOON_ME alias must be the DE440 realization of the DE421 ME frame."""
    resolution = spice_context.frame_resolution
    assert resolution.alias == "MOON_ME"
    assert resolution.resolves_to == "MOON_ME_DE440_ME421"
    assert resolution.max_abs_deviation_from_identity == 0.0
    with spice_context.session():
        for utc in ("2000-01-01T12:00:00", "2026-11-04T00:00:00", "2100-06-30T00:00:00"):
            rotation = spiceypy.pxform("MOON_ME", "MOON_ME_DE440_ME421", spiceypy.str2et(utc))
            assert np.array_equal(np.asarray(rotation), np.eye(3))


def test_me_to_pa_rotation_matches_the_documented_104_arcsec(spice_context: SpiceContext) -> None:
    with spice_context.session():
        et = spiceypy.str2et("2026-11-04T00:00:00")
        rotation = np.asarray(spiceypy.pxform("MOON_ME", "MOON_PA", et))
    angle_rad = np.arccos((np.trace(rotation) - 1.0) / 2.0)
    angle_arcsec = angle_rad * ARCSEC_PER_RAD
    assert angle_arcsec == pytest.approx(103.9, abs=0.1)
    assert angle_rad * 1_737_400.0 == pytest.approx(875.0, abs=1.0)


def test_coverage_spans_the_de440s_window(spice_context: SpiceContext) -> None:
    with spice_context.session():
        inside = spiceypy.str2et("2026-11-04T00:00:00")
        before = spiceypy.str2et("1849-01-01T00:00:00")
        after = spiceypy.str2et("2150-06-01T00:00:00")
    coverage = spice_context.coverage
    assert coverage.contains(inside)
    assert not coverage.contains(before)
    assert not coverage.contains(after)


# ── Process-wide pool and lock ──────────────────────────────────────────────


def test_session_holds_the_process_wide_lock(spice_context: SpiceContext) -> None:
    acquired_elsewhere: list[bool] = []

    def try_acquire() -> None:
        got = SPICE_LOCK.acquire(blocking=False)
        acquired_elsewhere.append(got)
        if got:
            SPICE_LOCK.release()

    with spice_context.session():
        worker = threading.Thread(target=try_acquire)
        worker.start()
        worker.join()
    assert acquired_elsewhere == [False]


def test_a_later_load_invalidates_earlier_contexts(spice_context: SpiceContext) -> None:
    replacement = SpiceContext(spice_context.kernel_set)
    assert replacement.is_active
    assert not spice_context.is_active
    with pytest.raises(SpiceKernelError, match="replaced"), spice_context.session():
        pass


def test_a_failed_load_clears_the_pool_and_invalidates_earlier_contexts(
    spice_context: SpiceContext, tmp_path: Path
) -> None:
    bogus_fk = tmp_path / "bogus.tf"
    bogus_fk.write_text("this is not a SPICE text kernel\n")
    files = tuple(
        KernelFile(KernelRole.FK, bogus_fk, _source("bogus.tf")) if f.role is KernelRole.FK else f
        for f in spice_context.kernel_set.files
    )
    with pytest.raises(SpiceKernelError):
        SpiceContext(KernelSet("bogus", files))
    assert not spice_context.is_active
    assert spiceypy.ktotal("ALL") == 0


def test_a_kernel_set_whose_moon_me_is_not_the_de421_realization_is_refused(
    spice_context: SpiceContext, tmp_path: Path
) -> None:
    fk_path = spice_context.kernel_set.file(KernelRole.FK).path
    altered = tmp_path / "moon_altered.tf"
    altered.write_text(
        fk_path.read_text().replace(
            "TKFRAME_31001_RELATIVE        = 'MOON_ME_DE440_ME421'",
            "TKFRAME_31001_RELATIVE        = 'MOON_PA_DE440'",
        )
    )
    files = tuple(
        KernelFile(KernelRole.FK, altered, _source("moon_altered.tf"))
        if f.role is KernelRole.FK
        else f
        for f in spice_context.kernel_set.files
    )
    with pytest.raises(SpiceKernelError, match="resolves to 'MOON_PA_DE440'"):
        SpiceContext(KernelSet("altered", files))
