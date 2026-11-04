"""Acquisition, local status and integrity verification against a loopback server."""

from __future__ import annotations

import json

import httpx
import pytest

from lunaris_data.ingestion import AcquisitionError, acquire_dataset
from lunaris_data.store import ACQUISITION_RECORD_NAME, DataLayout, DatasetStatus, inspect_dataset
from lunaris_data.validation import verify_dataset
from lunaris_data.validation.integrity import FileCheckResult
from tests.data.helpers import FileServer, ManifestFactory, sha256

LABEL = b"PDS_VERSION_ID = PDS3\r\n/* synthetic label for tests */\r\nEND\r\n"
IMAGE = bytes(range(256)) * 64  # 16 KiB synthetic payload


def _publish(file_server: FileServer) -> list[dict[str, object]]:
    return [
        {"name": "SYNTH.LBL", "url": file_server.publish("synth.lbl", LABEL), "role": "label"},
        {"name": "SYNTH.IMG", "url": file_server.publish("synth.img", IMAGE), "role": "data"},
    ]


def test_missing_before_acquisition(make_manifest: ManifestFactory, layout: DataLayout) -> None:
    manifest = make_manifest([{"name": "A.IMG", "url": "http://127.0.0.1:9/a.img", "role": "data"}])
    state = inspect_dataset(manifest, layout)
    assert state.status is DatasetStatus.MISSING
    assert state.files_present == 0


def test_acquire_records_provenance(
    file_server: FileServer,
    make_manifest: ManifestFactory,
    layout: DataLayout,
    http_client: httpx.Client,
) -> None:
    manifest = make_manifest(_publish(file_server))
    outcome = acquire_dataset(manifest, layout, client=http_client)
    assert not outcome.skipped

    directory = layout.dataset_dir(manifest)
    # Local name follows the manifest (upper case), not the remote (lower case) name.
    assert (directory / "SYNTH.IMG").read_bytes() == IMAGE
    assert not list(directory.glob("*.part"))

    record = json.loads((directory / ACQUISITION_RECORD_NAME).read_text())
    assert record["dataset_id"] == manifest.id
    assert record["manifest_fingerprint"] == manifest.fingerprint()
    files = {f["name"]: f for f in record["files"]}
    assert files["SYNTH.IMG"]["sha256"] == sha256(IMAGE)
    assert files["SYNTH.IMG"]["size_bytes"] == len(IMAGE)
    assert files["SYNTH.IMG"]["source_url"].endswith("/synth.img")
    assert record["tool"]["name"] == "lunaris-data"

    state = inspect_dataset(manifest, layout)
    assert state.status is DatasetStatus.ACQUIRED
    assert state.bytes_on_disk == len(LABEL) + len(IMAGE)
    assert not state.manifest_changed

    # Idempotent: already acquired → skipped unless forced.
    assert acquire_dataset(manifest, layout, client=http_client).skipped
    assert not acquire_dataset(manifest, layout, client=http_client, force=True).skipped


def test_pinned_checksum_mismatch_leaves_nothing(
    file_server: FileServer,
    make_manifest: ManifestFactory,
    layout: DataLayout,
    http_client: httpx.Client,
) -> None:
    url = file_server.publish("synth.img", IMAGE)
    manifest = make_manifest(
        [{"name": "SYNTH.IMG", "url": url, "role": "data", "sha256": "0" * 64}]
    )
    with pytest.raises(AcquisitionError, match="SHA-256 mismatch"):
        acquire_dataset(manifest, layout, client=http_client)
    directory = layout.dataset_dir(manifest)
    assert not (directory / "SYNTH.IMG").exists()
    assert not (directory / ACQUISITION_RECORD_NAME).exists()
    assert inspect_dataset(manifest, layout).status is DatasetStatus.MISSING


def test_http_error_is_reported_with_manifest_hint(
    file_server: FileServer,
    make_manifest: ManifestFactory,
    layout: DataLayout,
    http_client: httpx.Client,
) -> None:
    manifest = make_manifest(
        [{"name": "GONE.IMG", "url": f"{file_server.base_url}/gone.img", "role": "data"}]
    )
    with pytest.raises(AcquisitionError, match=r"HTTP 404.*unverified"):
        acquire_dataset(manifest, layout, client=http_client)
    assert not (layout.dataset_dir(manifest) / ACQUISITION_RECORD_NAME).exists()


def test_untracked_files_are_not_acquired(
    make_manifest: ManifestFactory, layout: DataLayout
) -> None:
    manifest = make_manifest([{"name": "A.IMG", "url": "http://127.0.0.1:9/a", "role": "data"}])
    directory = layout.dataset_dir(manifest)
    directory.mkdir(parents=True)
    (directory / "A.IMG").write_bytes(b"copied by hand")
    assert inspect_dataset(manifest, layout).status is DatasetStatus.UNTRACKED


def test_verify_detects_tampering_truncation_and_loss(
    file_server: FileServer,
    make_manifest: ManifestFactory,
    layout: DataLayout,
    http_client: httpx.Client,
) -> None:
    manifest = make_manifest(_publish(file_server))
    acquire_dataset(manifest, layout, client=http_client)
    directory = layout.dataset_dir(manifest)
    assert verify_dataset(manifest, layout).ok

    image = directory / "SYNTH.IMG"
    tampered = bytearray(IMAGE)
    tampered[100] ^= 0xFF  # same size, different content
    image.write_bytes(bytes(tampered))
    checks = {c.name: c.result for c in verify_dataset(manifest, layout).checks}
    assert checks["SYNTH.IMG"] is FileCheckResult.CHECKSUM_MISMATCH
    assert checks["SYNTH.LBL"] is FileCheckResult.OK

    image.write_bytes(IMAGE[:10])
    report = verify_dataset(manifest, layout)
    assert not report.ok
    assert {c.name: c.result for c in report.checks}["SYNTH.IMG"] is FileCheckResult.SIZE_MISMATCH
    assert inspect_dataset(manifest, layout).status is DatasetStatus.INCOMPLETE

    image.unlink()
    checks = {c.name: c.result for c in verify_dataset(manifest, layout).checks}
    assert checks["SYNTH.IMG"] is FileCheckResult.MISSING


def test_manifest_edit_after_acquisition_is_flagged(
    file_server: FileServer,
    make_manifest: ManifestFactory,
    layout: DataLayout,
    http_client: httpx.Client,
) -> None:
    files = _publish(file_server)
    acquire_dataset(make_manifest(files), layout, client=http_client)
    edited = make_manifest(files, note="corrected after acquisition")
    state = inspect_dataset(edited, layout)
    assert state.status is DatasetStatus.ACQUIRED
    assert state.manifest_changed
