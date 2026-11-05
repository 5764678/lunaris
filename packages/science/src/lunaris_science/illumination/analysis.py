"""Illumination and Earth-visibility timelines for one site (D4, C4, T-24).

Combines the apparent geometry of a body (:mod:`lunaris_science.geometry.bodies`) with
visible disk fractions (:mod:`~lunaris_science.illumination.disk_fraction`) against:

* the **astronomical horizon** (the local horizontal plane of the reference sphere), and
* the **terrain horizon** from a C1 :class:`~lunaris_science.horizon_mask.HorizonMask`,
  when one is available.

The two are always reported separately (C4). Summaries and windows come from
:mod:`~lunaris_science.illumination.timeline`.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from lunaris_science.geometry.bodies import Body, BodyGeometrySeries
from lunaris_science.horizon_mask import HorizonMask
from lunaris_science.illumination.disk_fraction import (
    ASTRONOMICAL_HORIZON,
    DEFAULT_NODES,
    DiskFractionResult,
    HorizonLike,
    visible_disk_fraction,
)
from lunaris_science.illumination.timeline import FractionSummary, summarize
from lunaris_science.provenance import Evidence, EvidenceKind, SourceReference
from lunaris_science.visibility import RADIO_LINK_DISCLAIMER


class HorizonKind(StrEnum):
    ASTRONOMICAL = "astronomical"
    TERRAIN = "terrain"


@dataclass(frozen=True, slots=True)
class HorizonTimeline:
    """Disk fractions and their summary against one horizon."""

    horizon: HorizonKind
    disk: DiskFractionResult
    summary: FractionSummary


@dataclass(frozen=True, slots=True)
class BodyTimeline:
    body: Body
    geometry: BodyGeometrySeries
    astronomical: HorizonTimeline
    terrain: HorizonTimeline | None
    """``None`` when no horizon mask is available for the site."""
    evidence: Evidence
    limitations: tuple[str, ...]


COMMON_LIMITATIONS = (
    "Visible fraction is a fraction of the disk's area: limb darkening is neglected.",
    "Out of scope: earthshine, light scattered from nearby terrain, regional illumination "
    "maps (D4).",
)


def _horizon_timeline(
    kind: HorizonKind,
    horizon: HorizonLike,
    geometry: BodyGeometrySeries,
    nodes: int,
    window_end_et_s: float | None,
) -> HorizonTimeline:
    disk = visible_disk_fraction(
        geometry.azimuth_deg,
        geometry.elevation_deg,
        geometry.angular_radius_deg,
        horizon,
        nodes=nodes,
    )
    summary = summarize(
        geometry.epochs_et_s, disk.visible_fraction, disk.truncated, window_end_s=window_end_et_s
    )
    return HorizonTimeline(horizon=kind, disk=disk, summary=summary)


def _mask_source(mask: HorizonMask) -> SourceReference:
    """Fallback DEM source when the caller cannot resolve the mask's DEM to a URL."""
    return SourceReference(
        source_id=f"{mask.dem_source_id}/horizon-mask-dem",
        title=(
            f"Terrain horizon mask from {mask.dem_source_id} "
            f"({mask.dem_resolution_m:g} m, {mask.size} azimuths, range "
            f"{mask.max_range_m / 1000:g} km)"
        ),
        sha256=mask.dem_sha256,
    )


def body_timeline(
    geometry: BodyGeometrySeries,
    terrain: HorizonMask | None = None,
    *,
    dem_source: SourceReference | None = None,
    window_end_et_s: float | None = None,
    terrain_unavailable_reason: str | None = None,
    nodes: int = DEFAULT_NODES,
) -> BodyTimeline:
    """Astronomical and (optionally) terrain timelines for one body's geometry series.

    ``dem_source`` is the provenance of the DEM the mask came from (dataset id, URL and
    SHA-256), resolved by the caller from the dataset registry; without it, the source is
    built from the mask's own dataset id and checksum (no URL). ``window_end_et_s`` is the
    end of the analysis window (ET); it defaults to the last epoch (end-inclusive grid).
    """
    astronomical = _horizon_timeline(
        HorizonKind.ASTRONOMICAL, ASTRONOMICAL_HORIZON, geometry, nodes, window_end_et_s
    )
    terrain_timeline = (
        _horizon_timeline(HorizonKind.TERRAIN, terrain, geometry, nodes, window_end_et_s)
        if terrain is not None
        else None
    )

    limitations = list(COMMON_LIMITATIONS)
    if geometry.body is Body.EARTH:
        limitations.insert(0, RADIO_LINK_DISCLAIMER)
    if terrain is None:
        reason = f" ({terrain_unavailable_reason})" if terrain_unavailable_reason else ""
        limitations.append(
            f"Terrain horizon not available for this site{reason}: only the astronomical "
            "horizon is reported. Terrain can hide a body that is above 0°."
        )
    elif terrain_timeline is not None and terrain_timeline.summary.any_truncated:
        count = int(terrain_timeline.disk.truncated.sum())
        limitations.append(
            f"{count} of {len(geometry)} samples depend on horizon azimuths where the ray "
            "left DEM coverage: the terrain horizon there is a lower bound, so the visible "
            "fraction is an upper bound."
        )

    sources = list(geometry.evidence.sources)
    method = (
        "Visible disk fraction by chord integration in the tangent plane at the disk "
        f"centre ({nodes} chords), horizon sampled per chord (docs/SCIENCE.md §5.3); "
        "windows are maximal runs of samples, each standing for one step."
    )
    assumptions = list(geometry.evidence.assumptions)
    if terrain is not None:
        sources.append(dem_source if dem_source is not None else _mask_source(terrain))
        method += f" Terrain horizon: {terrain.method}."
        assumptions.append(
            f"Eye point {terrain.observer_height_m:g} m above the DEM surface "
            f"({terrain.surface_height_m:g} m above the 1 737 400 m sphere)."
        )
    evidence = Evidence(
        kind=EvidenceKind.CALCULATION,
        statement=(
            f"Visible fraction of the {geometry.body.value.capitalize()}'s disk above the "
            "astronomical horizon"
            + (" and the terrain horizon" if terrain is not None else "")
            + ", with summaries and windows, computed by LUNARIS."
        ),
        sources=tuple(sources),
        method=method,
        assumptions=tuple(assumptions),
    )
    return BodyTimeline(
        body=geometry.body,
        geometry=geometry,
        astronomical=astronomical,
        terrain=terrain_timeline,
        evidence=evidence,
        limitations=tuple(limitations),
    )


__all__ = ["BodyTimeline", "HorizonKind", "HorizonTimeline", "body_timeline"]
