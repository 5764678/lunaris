"""Dataset registry: the validated set of manifests known to LUNARIS."""

from __future__ import annotations

import json
from collections.abc import Iterable, Iterator
from importlib import resources

from lunaris_data.manifest import DatasetManifest


class UnknownDatasetError(KeyError):
    """Raised when a dataset id is not present in the registry."""

    def __init__(self, dataset_id: str) -> None:
        super().__init__(dataset_id)
        self.dataset_id = dataset_id

    def __str__(self) -> str:
        return f"unknown dataset id {self.dataset_id!r}"


class DatasetRegistry:
    """Immutable, ordered collection of dataset manifests keyed by id."""

    def __init__(self, manifests: Iterable[DatasetManifest]) -> None:
        by_id: dict[str, DatasetManifest] = {}
        for manifest in manifests:
            if manifest.id in by_id:
                raise ValueError(f"duplicate dataset id {manifest.id!r}")
            by_id[manifest.id] = manifest
        self._by_id = dict(sorted(by_id.items()))

    @classmethod
    def load_builtin(cls) -> DatasetRegistry:
        """Load the manifests shipped in :mod:`lunaris_data.manifests`."""
        package = resources.files("lunaris_data.manifests")
        manifests = []
        for entry in sorted(package.iterdir(), key=lambda e: e.name):
            if entry.name.endswith(".json"):
                payload = json.loads(entry.read_text(encoding="utf-8"))
                manifest = DatasetManifest.model_validate(payload)
                expected_name = f"{manifest.id}.json"
                if entry.name != expected_name:
                    raise ValueError(
                        f"manifest file {entry.name!r} must be named {expected_name!r}"
                    )
                manifests.append(manifest)
        return cls(manifests)

    def get(self, dataset_id: str) -> DatasetManifest:
        try:
            return self._by_id[dataset_id]
        except KeyError:
            raise UnknownDatasetError(dataset_id) from None

    def ids(self) -> tuple[str, ...]:
        return tuple(self._by_id)

    def __iter__(self) -> Iterator[DatasetManifest]:
        return iter(self._by_id.values())

    def __len__(self) -> int:
        return len(self._by_id)

    def __contains__(self, dataset_id: object) -> bool:
        return dataset_id in self._by_id


__all__ = ["DatasetRegistry", "UnknownDatasetError"]
