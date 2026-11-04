"""The shipped dataset manifests must be complete, cited and internally consistent."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from lunaris_data.manifest import DatasetManifest, UrlVerificationStatus
from lunaris_data.registry import DatasetRegistry, UnknownDatasetError

EXPECTED_IDS = {"lola-ldem-75s-240m", "naif-generic-kernels-lunar", "nasa-svs-cgi-moon-kit"}


@pytest.fixture(scope="module")
def registry() -> DatasetRegistry:
    return DatasetRegistry.load_builtin()


def test_builtin_registry_loads_expected_datasets(registry: DatasetRegistry) -> None:
    assert set(registry.ids()) == EXPECTED_IDS
    assert len(registry) == len(EXPECTED_IDS)


def test_every_manifest_is_cited_and_sourced(registry: DatasetRegistry) -> None:
    for manifest in registry:
        assert manifest.citation.strip()
        assert manifest.usage.strip()
        assert str(manifest.source_page).startswith("https://")
        for entry in manifest.files:
            assert str(entry.url).startswith("https://"), entry.name


def test_verified_manifests_pin_every_checksum(registry: DatasetRegistry) -> None:
    for manifest in registry:
        if manifest.verification.status is UrlVerificationStatus.VERIFIED:
            assert manifest.verification.checked_on is not None
            assert all(f.sha256 and f.size_bytes for f in manifest.files), manifest.id


def test_lola_label_and_image_use_label_pointer_case(registry: DatasetRegistry) -> None:
    lola = registry.get("lola-ldem-75s-240m")
    names = {f.name for f in lola.files}
    assert names == {"LDEM_75S_240M.LBL", "LDEM_75S_240M.IMG"}
    # Archive serves lower-case names; local names follow the label's ^IMAGE pointer.
    assert all(str(f.url).endswith(f.name.lower()) for f in lola.files)
    # 3812 × 3812 int16 samples, as recorded in the verified label.
    assert lola.file("LDEM_75S_240M.IMG").size_bytes == 3812 * 3812 * 2


def test_visualization_dataset_is_marked_visualization_only(registry: DatasetRegistry) -> None:
    kit = registry.get("nasa-svs-cgi-moon-kit")
    assert kit.category.value == "visualization"
    assert "not an analysis input" in kit.usage.lower()


def test_unknown_dataset(registry: DatasetRegistry) -> None:
    with pytest.raises(UnknownDatasetError):
        registry.get("does-not-exist")


def test_fingerprint_changes_with_content(registry: DatasetRegistry) -> None:
    manifest = registry.get("lola-ldem-75s-240m")
    edited = manifest.model_copy(update={"notes": (*manifest.notes, "edited")})
    assert manifest.fingerprint() != edited.fingerprint()
    assert manifest.fingerprint() == registry.get("lola-ldem-75s-240m").fingerprint()


def _base_payload() -> dict[str, object]:
    return {
        "schema_version": 1,
        "id": "bad-manifest",
        "title": "t",
        "summary": "s",
        "category": "terrain",
        "evidence_kind": "derived_product",
        "provider": "p",
        "source_page": "https://example.org/",
        "storage_area": "raw",
        "files": [{"name": "a.img", "url": "https://example.org/a.img", "role": "data"}],
        "citation": "c",
        "usage": "u",
        "verification": {"status": "unverified", "note": "n"},
    }


def test_verified_manifest_without_pins_is_rejected() -> None:
    payload = _base_payload()
    payload["verification"] = {"status": "verified", "checked_on": "2026-11-04", "note": "n"}
    with pytest.raises(ValidationError, match="pin"):
        DatasetManifest.model_validate(payload)


def test_verified_without_date_is_rejected() -> None:
    payload = _base_payload()
    payload["verification"] = {"status": "verified", "note": "n"}
    with pytest.raises(ValidationError, match="date"):
        DatasetManifest.model_validate(payload)


@pytest.mark.parametrize("kind", ["placeholder", "assumption"])
def test_external_dataset_cannot_be_placeholder(kind: str) -> None:
    payload = _base_payload()
    payload["evidence_kind"] = kind
    with pytest.raises(ValidationError):
        DatasetManifest.model_validate(payload)


def test_unsafe_file_names_rejected() -> None:
    payload = _base_payload()
    payload["files"] = [{"name": "../escape", "url": "https://example.org/x", "role": "data"}]
    with pytest.raises(ValidationError):
        DatasetManifest.model_validate(payload)


def test_duplicate_ids_rejected(registry: DatasetRegistry) -> None:
    manifest = registry.get("lola-ldem-75s-240m")
    with pytest.raises(ValueError, match="duplicate"):
        DatasetRegistry([manifest, manifest])
