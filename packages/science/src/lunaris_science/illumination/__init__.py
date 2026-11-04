"""Illumination analysis — planned for Milestone 04. Not implemented.

Responsibility (when implemented):
    Geometric solar illumination (Sun above the local horizontal plane) and
    terrain-aware illumination (Sun above the terrain horizon derived from a
    DEM), including the finite angular size of the solar disk, as time series
    and summary statistics over an analysis window.

Planned method notes (see docs/SCIENCE.md § Illumination):
    * Horizon-elevation profiles per azimuth computed from the DEM around the
      site, with the DEM extent and resolution recorded as limitations.
    * Illuminated solar-disk fraction from the solar elevation relative to the
      horizon and the solar angular radius at the epoch.

This module deliberately exposes no functions until those computations are
implemented and validated.
"""
