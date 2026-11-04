"""Verified SPICE kernel sets from the data store.

The kernel set is resolved by manifest: every file of the dataset is re-hashed against
its acquisition record and the SHA-256 pinned in the manifest before anything is
furnished. Only then is a :class:`~lunaris_science.geometry.spice.KernelSet` built,
from explicit absolute paths, for the science core to load.

CSPICE has one kernel pool per process, so :func:`get_spice_context` keeps one
:class:`~lunaris_science.geometry.spice.SpiceContext` per process and reuses it. The
API, the CLI and later analysis modules all go through it.
"""

from __future__ import annotations

import threading

from lunaris_data.manifest import DatasetManifest
from lunaris_data.store import DataLayout, read_record
from lunaris_data.validation.integrity import FileCheckResult, verify_dataset
from lunaris_science.geometry.spice import KernelFile, KernelRole, KernelSet, SpiceContext
from lunaris_science.provenance import SourceReference

KERNEL_DATASET_ID = "naif-generic-kernels-lunar"


class KernelSetUnavailableError(RuntimeError):
    """The kernel set is missing, incomplete or fails checksum verification."""

    def __init__(self, dataset_id: str, problems: list[str]) -> None:
        self.dataset_id = dataset_id
        self.problems = problems
        super().__init__(
            f"kernel set {dataset_id!r} is not usable ({'; '.join(problems)}); "
            f"run `uv run lunaris-data acquire {dataset_id}`"
        )


def load_verified_kernel_set(manifest: DatasetManifest, layout: DataLayout) -> KernelSet:
    """Verify every kernel's SHA-256 and return the set with explicit absolute paths.

    Raises:
        KernelSetUnavailableError: if any file is missing, unrecorded or fails its checksum.
    """
    report = verify_dataset(manifest, layout)
    if not report.ok:
        problems = [
            f"{c.name}: {c.result.value}"
            for c in report.checks
            if c.result is not FileCheckResult.OK
        ]
        if not report.has_record:
            problems.insert(0, "no acquisition record")
        raise KernelSetUnavailableError(manifest.id, problems)

    directory = layout.dataset_dir(manifest)
    record = read_record(directory)
    files = []
    for spec in manifest.files:
        acquired = record.file(spec.name) if record else None
        if acquired is None:  # pragma: no cover - excluded by report.ok
            raise KernelSetUnavailableError(manifest.id, [f"{spec.name}: unrecorded"])
        files.append(
            KernelFile(
                role=KernelRole.from_file_name(spec.name),
                path=(directory / spec.name).resolve(),
                source=SourceReference(
                    source_id=f"{manifest.id}/{spec.name}",
                    title=spec.description or spec.name,
                    url=str(spec.url),
                    sha256=acquired.sha256,
                    citation=manifest.citation,
                ),
            )
        )
    return KernelSet(dataset_id=manifest.id, files=tuple(files))


_context_lock = threading.Lock()
_context_cache: dict[tuple[str, str], SpiceContext] = {}


def get_spice_context(manifest: DatasetManifest, layout: DataLayout) -> SpiceContext:
    """Return the process-wide context for this data root and manifest, loading it once."""
    key = (str(layout.root), manifest.fingerprint())
    with _context_lock:
        context = _context_cache.get(key)
        if context is not None and context.is_active:
            return context
        context = SpiceContext(load_verified_kernel_set(manifest, layout))
        _context_cache.clear()
        _context_cache[key] = context
        return context


__all__ = [
    "KERNEL_DATASET_ID",
    "KernelSetUnavailableError",
    "get_spice_context",
    "load_verified_kernel_set",
]
