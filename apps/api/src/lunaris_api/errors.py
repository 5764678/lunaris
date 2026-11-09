"""Uniform error envelope for every non-2xx response.

All errors share the shape ``{"error": {"code", "message", "details", "request_id"}}``.
Internal exception details are logged server-side and never returned to clients.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, cast

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from lunaris_api.logging import get_logger, request_id_var
from lunaris_api.schemas.common import ErrorBody, ErrorDetail, ErrorResponse

logger = get_logger("errors")

_HTTP_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    413: "payload_too_large",
    415: "unsupported_media_type",
    422: "validation_error",
    429: "too_many_requests",
}


class ApiError(Exception):
    """Domain error raised by services and translated into the error envelope."""

    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, details: Sequence[ErrorDetail] = ()) -> None:
        super().__init__(message)
        self.message = message
        self.details = list(details)


class ForbiddenError(ApiError):
    status_code = 403
    code = "forbidden"


class NotFoundError(ApiError):
    status_code = 404
    code = "not_found"


class ConflictError(ApiError):
    status_code = 409
    code = "conflict"


def error_response(
    status_code: int,
    code: str,
    message: str,
    details: Sequence[ErrorDetail] = (),
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    payload = ErrorResponse(
        error=ErrorBody(
            code=code, message=message, details=list(details), request_id=request_id_var.get()
        )
    )
    return JSONResponse(
        status_code=status_code,
        content=payload.model_dump(mode="json"),
        headers=dict(headers) if headers else None,
    )


def _validation_details(errors: Sequence[Any]) -> list[ErrorDetail]:
    details = []
    for err in errors:
        location = [part if isinstance(part, int) else str(part) for part in err.get("loc", ())]
        details.append(
            ErrorDetail(
                location=location,
                message=str(err.get("msg", "invalid value")),
                type=str(err.get("type", "value_error")),
            )
        )
    return details


async def _handle_api_error(_: Request, exc: Exception) -> JSONResponse:
    error = cast(ApiError, exc)  # registered for ApiError only
    return error_response(error.status_code, error.code, error.message, error.details)


async def _handle_validation_error(_: Request, exc: Exception) -> JSONResponse:
    errors = cast(RequestValidationError, exc).errors()  # registered for this type only
    return error_response(
        422, "validation_error", "Request validation failed.", _validation_details(errors)
    )


async def _handle_http_exception(_: Request, exc: Exception) -> JSONResponse:
    http_exc = cast(StarletteHTTPException, exc)  # registered for this type only
    code = _HTTP_CODES.get(http_exc.status_code, "http_error")
    message = http_exc.detail if isinstance(http_exc.detail, str) else "HTTP error."
    return error_response(http_exc.status_code, code, message, headers=http_exc.headers)


def internal_error_response() -> JSONResponse:
    return error_response(500, "internal_error", "An unexpected error occurred.")


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _handle_api_error)
    app.add_exception_handler(RequestValidationError, _handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, _handle_http_exception)


__all__ = [
    "ApiError",
    "ConflictError",
    "NotFoundError",
    "error_response",
    "internal_error_response",
    "register_exception_handlers",
]
