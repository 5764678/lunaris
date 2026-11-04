from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path

from lunaris_api.dependencies import DatasetServiceDep
from lunaris_api.schemas.common import ERROR_RESPONSES, SERVER_ERROR, ErrorResponse
from lunaris_api.schemas.datasets import DatasetListResponse, DatasetSummary

router = APIRouter(prefix="/datasets", tags=["datasets"])

DatasetIdPath = Annotated[str, Path(pattern=r"^[a-z0-9][a-z0-9-]{2,63}$")]


@router.get(
    "",
    response_model=DatasetListResponse,
    summary="Registered datasets and their local acquisition status",
    responses=SERVER_ERROR,
)
def list_datasets(service: DatasetServiceDep) -> DatasetListResponse:
    """Every dataset LUNARIS knows about, with provenance metadata, URL verification
    status and whether it is present in the local data store. Status is computed from
    file presence and sizes; full checksum verification is done with
    ``lunaris-data verify``."""
    return service.list_datasets()


@router.get(
    "/{dataset_id}",
    response_model=DatasetSummary,
    summary="One registered dataset",
    responses={404: {"model": ErrorResponse, "description": "Unknown dataset."}, **ERROR_RESPONSES},
)
def get_dataset(dataset_id: DatasetIdPath, service: DatasetServiceDep) -> DatasetSummary:
    return service.get_dataset(dataset_id)
