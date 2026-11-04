"""The evidence model must make unsourced claims unrepresentable."""

from __future__ import annotations

import pytest

from lunaris_science.provenance import (
    Evidence,
    EvidenceKind,
    ProvenanceError,
    SourceReference,
)

SOURCE = SourceReference(source_id="lola-ldem-75s-240m", title="LOLA GDR 240 m south pole")


@pytest.mark.parametrize(
    "kind", [EvidenceKind.OBSERVATION, EvidenceKind.DERIVED_PRODUCT, EvidenceKind.MODEL]
)
def test_source_backed_kinds_require_sources(kind: EvidenceKind) -> None:
    with pytest.raises(ProvenanceError, match="cite at least one source"):
        Evidence(kind=kind, statement="slope at site")
    assert Evidence(kind=kind, statement="slope at site", sources=(SOURCE,)).sources


def test_calculation_requires_method() -> None:
    with pytest.raises(ProvenanceError, match="method"):
        Evidence(kind=EvidenceKind.CALCULATION, statement="x")
    evidence = Evidence(kind=EvidenceKind.CALCULATION, statement="x", method="Horn (1981)")
    assert evidence.is_decision_grade


def test_assumption_requires_statement_of_assumption() -> None:
    with pytest.raises(ProvenanceError):
        Evidence(kind=EvidenceKind.ASSUMPTION, statement="panel efficiency")
    with pytest.raises(ProvenanceError):
        Evidence(kind=EvidenceKind.ASSUMPTION, statement="panel efficiency", assumptions=(" ",))


def test_placeholder_is_never_decision_grade() -> None:
    evidence = Evidence(kind=EvidenceKind.PLACEHOLDER, statement="procedural surface")
    assert not evidence.is_decision_grade


def test_kind_accepts_string_values() -> None:
    evidence = Evidence(kind="placeholder", statement="x")  # type: ignore[arg-type]
    assert evidence.kind is EvidenceKind.PLACEHOLDER


def test_empty_statement_rejected() -> None:
    with pytest.raises(ProvenanceError):
        Evidence(kind=EvidenceKind.PLACEHOLDER, statement="  ")


@pytest.mark.parametrize("bad", ["abc", "A" * 64, "g" * 64])
def test_source_reference_sha256_format(bad: str) -> None:
    with pytest.raises(ProvenanceError):
        SourceReference(source_id="x", title="y", sha256=bad)
