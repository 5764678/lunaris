"""LUNARIS data layer.

Dataset manifests with provenance, reproducible acquisition, integrity verification
and preprocessing. This package performs I/O on behalf of the pure scientific core
(:mod:`lunaris_science`), which never touches the network or the file system itself.
"""

from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("lunaris-data")
except PackageNotFoundError:  # pragma: no cover - source tree without installation
    __version__ = "0.0.0+unknown"

__all__ = ["__version__"]
