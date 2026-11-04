"""Earth visibility — planned for Milestone 04. Not implemented.

Responsibility (when implemented):
    Geometric Earth visibility (Earth above the local horizontal plane) and
    terrain-obstructed line of sight to the Earth from a surface point, and the
    resulting direct-to-Earth (DTE) visibility windows.

Scope limitation:
    Geometric line of sight is a necessary but NOT a sufficient condition for
    radio communication. Link budgets, antenna patterns, ground-station
    availability and multipath are outside the scope of this module and must
    not be inferred from its outputs.

This module deliberately exposes no functions until those computations are
implemented and validated.
"""
