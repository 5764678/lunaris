"""Mission intelligence scoring — planned for Milestone 05. Not implemented.

Responsibility (when implemented):
    Hard operational constraints (pass/fail) and configurable weighted scoring
    criteria for comparing candidate sites, with a full explanation of each
    score in terms of the underlying evidence.

Planned method notes (see docs/SCIENCE.md § Mission intelligence):
    * Constraints are evaluated before scoring; a site that violates a hard
      constraint is reported as excluded, never silently down-weighted.
    * Normalization and weights are user-visible configuration (assumptions),
      recorded with every result.
    * Placeholder evidence can never contribute to a score.

This module deliberately exposes no functions until those computations are
implemented and validated.
"""
