"""Reproducible acquisition of external datasets (download + provenance record)."""

from lunaris_data.ingestion.acquire import AcquisitionError, acquire_dataset
from lunaris_data.ingestion.download import DownloadError, IntegrityError, download_file

__all__ = [
    "AcquisitionError",
    "DownloadError",
    "IntegrityError",
    "acquire_dataset",
    "download_file",
]
