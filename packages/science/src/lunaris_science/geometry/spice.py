"""SPICE kernel context: one verified kernel set, one process-wide lock.

CSPICE keeps a single global kernel pool and is not thread-safe. FastAPI runs sync
endpoints in a thread pool, so every SPICE call in LUNARIS goes through
:data:`SPICE_LOCK` (contract C2 in ``docs/TASKS.md``).

The science core performs no implicit I/O: a :class:`KernelSet` names each kernel by
an explicit absolute path and carries the SHA-256 that the data layer verified before
building it (``lunaris_data`` owns acquisition and integrity checks). This module only
furnishes those exact files.

On load, :class:`SpiceContext` checks the frame chain that D2 requires: the generic
``MOON_ME`` alias must resolve to ``MOON_ME_DE440_ME421`` through an identity rotation.
Frames are looked up by name; no frame ID integer is hard-coded.
"""

from __future__ import annotations

import threading
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path

import numpy as np
import spiceypy
from spiceypy.utils.exceptions import SpiceyError

from lunaris_science.provenance import SourceReference

SPICE_LOCK = threading.RLock()
"""Process-wide lock around every CSPICE call (CSPICE is not thread-safe)."""

CANONICAL_FRAME_NAME = "MOON_ME"
EXPECTED_ME_REALIZATION = "MOON_ME_DE440_ME421"
"""Frame that ``MOON_ME`` must resolve to: the DE440 realization of the DE421 mean-Earth
frame that LOLA products are registered to (D2)."""

IDENTITY_TOLERANCE = 1e-15
"""Maximum element-wise deviation from the identity matrix for MOON_ME → MOON_ME_DE440_ME421."""

EPHEMERIS_BODIES = ("SUN", "EARTH", "MOON")
"""Bodies whose SPK coverage bounds the usable time span."""

MOON_PA_REALIZATION = "MOON_PA_DE440"
"""Frame whose binary-PCK coverage bounds the usable time span."""

COVERAGE_MARGIN_S = 3600.0
"""Margin kept inside the kernel coverage so light-time iterations stay in range."""


class SpiceKernelError(RuntimeError):
    """Raised when a kernel set is malformed, fails to load, or fails the frame checks."""


class KernelRole(StrEnum):
    """What each kernel contributes. Furnish order follows the declaration order."""

    LSK = "lsk"
    TEXT_PCK = "text_pck"
    SPK = "spk"
    BINARY_PCK = "binary_pck"
    FK = "fk"

    @classmethod
    def from_file_name(cls, name: str) -> KernelRole:
        """Role from the NAIF file-name extension convention (.tls, .tpc, .bsp, .bpc, .tf)."""
        suffix = Path(name).suffix.lower()
        try:
            return _ROLE_BY_SUFFIX[suffix]
        except KeyError:
            raise SpiceKernelError(f"unrecognised kernel file extension in {name!r}") from None


_ROLE_BY_SUFFIX = {
    ".tls": KernelRole.LSK,
    ".tpc": KernelRole.TEXT_PCK,
    ".bsp": KernelRole.SPK,
    ".bpc": KernelRole.BINARY_PCK,
    ".tf": KernelRole.FK,
}

FURNISH_ORDER: tuple[KernelRole, ...] = tuple(KernelRole)


@dataclass(frozen=True, slots=True)
class KernelFile:
    """One kernel: its role, explicit absolute path and verified provenance."""

    role: KernelRole
    path: Path
    source: SourceReference

    def __post_init__(self) -> None:
        object.__setattr__(self, "role", KernelRole(self.role))
        if not self.path.is_absolute():
            raise SpiceKernelError(f"kernel path must be absolute, got {self.path}")
        if self.source.sha256 is None:
            raise SpiceKernelError(
                f"kernel {self.path.name} has no verified SHA-256; only checksum-verified "
                "kernels may be loaded"
            )


@dataclass(frozen=True, slots=True)
class KernelSet:
    """A complete, checksum-verified kernel set: exactly one file per :class:`KernelRole`."""

    dataset_id: str
    files: tuple[KernelFile, ...]

    def __post_init__(self) -> None:
        if not self.dataset_id.strip():
            raise SpiceKernelError("dataset_id must not be empty")
        roles = [f.role for f in self.files]
        missing = [r.value for r in KernelRole if r not in roles]
        duplicated = sorted({r.value for r in roles if roles.count(r) > 1})
        if missing or duplicated:
            raise SpiceKernelError(
                f"kernel set {self.dataset_id!r} needs exactly one kernel per role "
                f"(missing: {missing}, duplicated: {duplicated})"
            )
        ordered = tuple(sorted(self.files, key=lambda f: FURNISH_ORDER.index(f.role)))
        object.__setattr__(self, "files", ordered)

    def file(self, role: KernelRole) -> KernelFile:
        return next(f for f in self.files if f.role is role)

    @property
    def sources(self) -> tuple[SourceReference, ...]:
        """One source reference per kernel, in furnish order (for evidence records)."""
        return tuple(f.source for f in self.files)


@dataclass(frozen=True, slots=True)
class FrameResolution:
    """Result of the MOON_ME frame-chain check performed at load time."""

    alias: str
    resolves_to: str
    max_abs_deviation_from_identity: float


@dataclass(frozen=True, slots=True)
class TimeCoverage:
    """ET interval (TDB seconds past J2000) in which every required kernel has data."""

    start_et_s: float
    end_et_s: float

    def contains(self, et_s: float) -> bool:
        return self.start_et_s <= et_s <= self.end_et_s


_active_generation = 0
"""Incremented on every load; a context is usable only while its generation is active."""


class SpiceContext:
    """The process-wide SPICE kernel pool, loaded with exactly one :class:`KernelSet`.

    Creating a context clears the kernel pool and furnishes the set. Creating another
    context later replaces the pool; the earlier context then refuses further use
    instead of silently computing with the wrong kernels.

    Use :meth:`session` around every SPICE call::

        with context.session():
            state, _ = spiceypy.spkcpo(...)
    """

    def __init__(self, kernel_set: KernelSet) -> None:
        global _active_generation  # noqa: PLW0603 - the CSPICE pool is process-global
        with SPICE_LOCK:
            # Invalidate every earlier context before touching the pool, so a failed load
            # cannot leave an earlier context believing its kernels are still loaded.
            _active_generation += 1
            generation = _active_generation
            spiceypy.kclear()
            try:
                for kernel in kernel_set.files:
                    if not kernel.path.is_file():
                        raise SpiceKernelError(f"kernel file not found: {kernel.path}")
                    spiceypy.furnsh(str(kernel.path))
                self._frame_resolution = _check_moon_me_resolution()
                self._coverage = _time_coverage(kernel_set)
            except SpiceyError as exc:
                spiceypy.kclear()
                raise SpiceKernelError(f"failed to load kernel set: {exc.short}") from exc
            except SpiceKernelError:
                spiceypy.kclear()
                raise
            self._generation = generation
        self._kernel_set = kernel_set

    @property
    def kernel_set(self) -> KernelSet:
        return self._kernel_set

    @property
    def frame_resolution(self) -> FrameResolution:
        return self._frame_resolution

    @property
    def coverage(self) -> TimeCoverage:
        return self._coverage

    @property
    def is_active(self) -> bool:
        return self._generation == _active_generation

    @contextmanager
    def session(self) -> Iterator[None]:
        """Hold :data:`SPICE_LOCK` and guarantee that this context's kernels are loaded."""
        with SPICE_LOCK:
            if not self.is_active:
                raise SpiceKernelError(
                    "this SPICE context was replaced by a later kernel load; create a new context"
                )
            yield


def _check_moon_me_resolution() -> FrameResolution:
    """Verify that ``MOON_ME`` is a fixed alias of ``MOON_ME_DE440_ME421`` (D2)."""
    frame_id = spiceypy.namfrm(CANONICAL_FRAME_NAME)
    if frame_id == 0:
        raise SpiceKernelError(f"frame {CANONICAL_FRAME_NAME} is not defined by the kernels")
    try:
        relative = spiceypy.gcpool(f"TKFRAME_{frame_id}_RELATIVE", 0, 1)
    except SpiceyError as exc:
        raise SpiceKernelError(
            f"{CANONICAL_FRAME_NAME} is not defined as a TK frame: {exc.short}"
        ) from exc
    resolves_to = str(relative[0]).strip() if len(relative) else ""
    if resolves_to != EXPECTED_ME_REALIZATION:
        raise SpiceKernelError(
            f"{CANONICAL_FRAME_NAME} resolves to {resolves_to!r}, expected "
            f"{EXPECTED_ME_REALIZATION!r}"
        )
    # A TK frame is time-independent; checking one epoch exercises the whole chain.
    rotation = np.asarray(spiceypy.pxform(CANONICAL_FRAME_NAME, resolves_to, 0.0))
    deviation = float(np.max(np.abs(rotation - np.eye(3))))
    if deviation > IDENTITY_TOLERANCE:
        raise SpiceKernelError(
            f"{CANONICAL_FRAME_NAME} → {resolves_to} is not the identity "
            f"(max deviation {deviation:.3e})"
        )
    return FrameResolution(
        alias=CANONICAL_FRAME_NAME,
        resolves_to=resolves_to,
        max_abs_deviation_from_identity=deviation,
    )


def _single_interval(window: object, what: str) -> tuple[float, float]:
    count = spiceypy.wncard(window)
    if count < 1:
        raise SpiceKernelError(f"{what} has no coverage")
    starts, ends = zip(*(spiceypy.wnfetd(window, i) for i in range(count)), strict=True)
    if count > 1:
        # Gaps would need per-epoch checks; the generic DE440 kernels have none.
        raise SpiceKernelError(f"{what} coverage has {count} disjoint intervals")
    return float(starts[0]), float(ends[0])


def _time_coverage(kernel_set: KernelSet) -> TimeCoverage:
    spk = str(kernel_set.file(KernelRole.SPK).path)
    bpc = str(kernel_set.file(KernelRole.BINARY_PCK).path)
    intervals = []
    for body in EPHEMERIS_BODIES:
        window = spiceypy.spkcov(spk, spiceypy.bodn2c(body))
        intervals.append(_single_interval(window, f"SPK {body}"))
    pa_class_id = spiceypy.frinfo(spiceypy.namfrm(MOON_PA_REALIZATION))[2]
    intervals.append(
        _single_interval(spiceypy.pckcov(bpc, pa_class_id), f"binary PCK {MOON_PA_REALIZATION}")
    )
    # Apparent positions need the target state one light time earlier (~500 s for the Sun).
    return TimeCoverage(
        start_et_s=max(start for start, _ in intervals) + COVERAGE_MARGIN_S,
        end_et_s=min(end for _, end in intervals) - COVERAGE_MARGIN_S,
    )


__all__ = [
    "CANONICAL_FRAME_NAME",
    "EXPECTED_ME_REALIZATION",
    "FURNISH_ORDER",
    "SPICE_LOCK",
    "FrameResolution",
    "KernelFile",
    "KernelRole",
    "KernelSet",
    "SpiceContext",
    "SpiceKernelError",
    "TimeCoverage",
]
