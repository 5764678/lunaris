"""Celestial geometry — planned for Milestone 03. Not implemented.

Responsibility (when implemented):
    Time-dependent positions of the Sun and the Earth as seen from a lunar
    surface point: topocentric azimuth (clockwise from local north) and
    elevation above the local horizontal plane, in a consistent body-fixed
    frame (MOON_ME), using NAIF SPICE kernels via SpiceyPy.

Planned method notes (see docs/SCIENCE.md § Celestial geometry):
    * Kernel set: leap seconds (LSK), planetary/lunar ephemeris (SPK, e.g.
      DE440), lunar orientation (binary PCK) and lunar frames (FK).
    * Aberration corrections are explicit parameters and recorded in outputs.
    * Validation against JPL Horizons topocentric ephemerides for reference
      sites and epochs, with stated tolerances.

This module deliberately exposes no functions until those computations are
implemented and validated.
"""
