"""Dataset registry use-cases: manifests joined with local acquisition status."""

from __future__ import annotations

from lunaris_api.errors import NotFoundError
from lunaris_api.schemas.datasets import (
    DatasetFileSchema,
    DatasetListResponse,
    DatasetLocalSchema,
    DatasetSummary,
    SpatialMetadataSchema,
    UrlVerificationSchema,
)
from lunaris_data.manifest import DatasetManifest
from lunaris_data.registry import DatasetRegistry, UnknownDatasetError
from lunaris_data.store import DataLayout, DatasetLocalState, inspect_dataset


def summarize(manifest: DatasetManifest, state: DatasetLocalState) -> DatasetSummary:
    file_states = {f.name: f for f in state.files}
    files = []
    for spec in manifest.files:
        local = file_states[spec.name]
        files.append(
            DatasetFileSchema(
                name=spec.name,
                role=spec.role.value,
                url=str(spec.url),
                present=local.present,
                size_bytes=local.size_bytes if local.present else spec.size_bytes,
                sha256=local.recorded_sha256 or spec.sha256,
            )
        )
    spatial = (
        SpatialMetadataSchema.model_validate(manifest.spatial.model_dump())
        if manifest.spatial
        else None
    )
    return DatasetSummary(
        id=manifest.id,
        title=manifest.title,
        summary=manifest.summary,
        category=manifest.category.value,
        evidence_kind=manifest.evidence_kind.value,
        provider=manifest.provider,
        mission=manifest.mission,
        instrument=manifest.instrument,
        product_family=manifest.product_family,
        source_page=str(manifest.source_page),
        spatial=spatial,
        units=manifest.units,
        citation=manifest.citation,
        usage=manifest.usage,
        url_verification=UrlVerificationSchema(
            status=manifest.verification.status.value,
            checked_on=manifest.verification.checked_on,
            note=manifest.verification.note,
        ),
        required_by=list(manifest.required_by),
        notes=list(manifest.notes),
        files=files,
        local=DatasetLocalSchema(
            status="remote_window" if manifest.is_remote_window else state.status.value,
            files_present=state.files_present,
            files_expected=len(manifest.files),
            bytes_on_disk=state.bytes_on_disk,
            acquired_at_utc=state.record.acquired_at_utc if state.record else None,
            manifest_changed=state.manifest_changed,
        ),
        acquire_command=None
        if manifest.is_remote_window
        else f"uv run lunaris-data acquire {manifest.id}",
    )


class DatasetService:
    def __init__(self, registry: DatasetRegistry, layout: DataLayout) -> None:
        self._registry = registry
        self._layout = layout

    def list_datasets(self) -> DatasetListResponse:
        datasets = [summarize(m, inspect_dataset(m, self._layout)) for m in self._registry]
        return DatasetListResponse(datasets=datasets, count=len(datasets))

    def get_dataset(self, dataset_id: str) -> DatasetSummary:
        try:
            manifest = self._registry.get(dataset_id)
        except UnknownDatasetError:
            raise NotFoundError(f"Dataset {dataset_id!r} is not registered.") from None
        return summarize(manifest, inspect_dataset(manifest, self._layout))


__all__ = ["DatasetService", "summarize"]
