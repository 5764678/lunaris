"""Terrain intelligence — planned for Milestone 02. Not implemented.

Responsibility (when implemented):
    Elevation, slope and roughness analysis of LOLA digital elevation models
    (DEMs) in the south-polar region, and terrain-hazard indicators for
    candidate landing sites.

Planned method notes (see docs/SCIENCE.md § Terrain):
    * DEM heights are read with the scaling factor, offset and reference radius
      stated in each product's PDS label (never assumed).
    * Slopes are computed on the projected grid with Horn's (1981) finite
      difference method, corrected for the polar-stereographic scale factor.
    * Roughness is reported as an explicitly defined statistic over a stated
      baseline (e.g. RMS height deviation from a local plane).
    * Every output carries its DEM source, resolution and evidence kind.

This module deliberately exposes no functions until those computations are
implemented and validated against reference data.
"""
