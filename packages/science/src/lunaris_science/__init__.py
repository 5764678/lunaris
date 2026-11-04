"""LUNARIS scientific core.

Pure, deterministic scientific code: reference constants, coordinate primitives,
provenance/evidence models and, in later milestones, terrain, celestial-geometry,
illumination, visibility, energy and scoring computations.

Package rules (see ``docs/ARCHITECTURE.md``):

* no web-framework imports, no network access, no implicit file I/O;
* every public function documents its units and reference frame;
* every result that leaves the package carries an
  :class:`lunaris_science.provenance.Evidence` record.
"""

from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("lunaris-science")
except PackageNotFoundError:  # pragma: no cover - source tree without installation
    __version__ = "0.0.0+unknown"

__all__ = ["__version__"]
