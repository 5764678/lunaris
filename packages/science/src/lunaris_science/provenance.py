"""Evidence and provenance model.

LUNARIS distinguishes, for every value it reports, *what kind of knowledge it is*:

``observation``
    Measured data as distributed by the instrument team (for example LOLA altimetry
    shots in the Reduced Data Record).
``derived_product``
    Archived products derived from observations by the producing team (for example
    LOLA Gridded Data Record DEMs).
``model``
    Output of a physical or ephemeris model distributed by an authority (for example
    JPL DE440 via SPICE kernels).
``calculation``
    A value computed by LUNARIS from other evidence. Must name its method.
``assumption``
    A value adopted by configuration or convention without observational support in
    the current analysis. Must state the assumption.
``placeholder``
    Stand-in content (for example a procedural visual surface). Never valid evidence
    for a mission decision.

The rules in :meth:`Evidence.__post_init__` make it impossible to construct an
evidence record that claims observational backing without citing a source.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

SHA256_HEX_LENGTH = 64
_HEX_DIGITS = frozenset("0123456789abcdef")


def _is_sha256_hex(value: str) -> bool:
    return len(value) == SHA256_HEX_LENGTH and set(value) <= _HEX_DIGITS


class ProvenanceError(ValueError):
    """Raised when an evidence record violates the provenance rules."""


class EvidenceKind(StrEnum):
    """Epistemic category of a reported value."""

    OBSERVATION = "observation"
    DERIVED_PRODUCT = "derived_product"
    MODEL = "model"
    CALCULATION = "calculation"
    ASSUMPTION = "assumption"
    PLACEHOLDER = "placeholder"


SOURCE_BACKED_KINDS = frozenset(
    {EvidenceKind.OBSERVATION, EvidenceKind.DERIVED_PRODUCT, EvidenceKind.MODEL}
)
"""Kinds that are only meaningful with at least one cited source."""


@dataclass(frozen=True, slots=True)
class SourceReference:
    """Pointer to an external source: dataset, kernel, constant table or publication."""

    source_id: str
    title: str
    url: str | None = None
    version: str | None = None
    sha256: str | None = None
    citation: str | None = None

    def __post_init__(self) -> None:
        if not self.source_id.strip():
            raise ProvenanceError("source_id must not be empty")
        if not self.title.strip():
            raise ProvenanceError("title must not be empty")
        if self.sha256 is not None and (
            len(self.sha256) != SHA256_HEX_LENGTH
            or any(c not in "0123456789abcdef" for c in self.sha256)
        ):
            raise ProvenanceError("sha256 must be 64 lowercase hexadecimal characters")


@dataclass(frozen=True, slots=True)
class Evidence:
    """Statement of what a reported value is and where it comes from."""

    kind: EvidenceKind
    statement: str
    sources: tuple[SourceReference, ...] = ()
    method: str | None = None
    assumptions: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "kind", EvidenceKind(self.kind))
        if not self.statement.strip():
            raise ProvenanceError("evidence statement must not be empty")
        if self.kind in SOURCE_BACKED_KINDS and not self.sources:
            raise ProvenanceError(f"{self.kind.value} evidence must cite at least one source")
        if self.kind is EvidenceKind.CALCULATION and not (self.method and self.method.strip()):
            raise ProvenanceError("calculation evidence must name its method")
        if self.kind is EvidenceKind.ASSUMPTION and not self.assumptions:
            raise ProvenanceError("assumption evidence must state at least one assumption")
        if any(not a.strip() for a in self.assumptions):
            raise ProvenanceError("assumptions must not be empty strings")

    @property
    def is_decision_grade(self) -> bool:
        """Whether this evidence may inform a mission decision (placeholders may not)."""
        return self.kind is not EvidenceKind.PLACEHOLDER


__all__ = [
    "SOURCE_BACKED_KINDS",
    "Evidence",
    "EvidenceKind",
    "ProvenanceError",
    "SourceReference",
]
