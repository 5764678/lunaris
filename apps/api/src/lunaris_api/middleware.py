"""Request context middleware: request ids, access logging, last-resort error handling.

Implemented as pure ASGI middleware (not ``BaseHTTPMiddleware``) to avoid buffering
responses. It sits *inside* the CORS middleware so that even unexpected 500 responses
carry CORS headers and remain readable by the browser client.
"""

from __future__ import annotations

import re
import time
import uuid

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from lunaris_api.errors import internal_error_response
from lunaris_api.logging import get_logger, request_id_var

REQUEST_ID_HEADER = "x-request-id"
_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,128}$")

logger = get_logger("http")


def _incoming_request_id(scope: Scope) -> str | None:
    for name, value in scope.get("headers", ()):
        if name == REQUEST_ID_HEADER.encode("latin-1"):
            candidate = value.decode("latin-1")
            return candidate if _VALID_REQUEST_ID.match(candidate) else None
    return None


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _incoming_request_id(scope) or uuid.uuid4().hex
        token = request_id_var.set(request_id)
        started = time.perf_counter()
        status_holder = {"status": 500, "started": False}

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                status_holder["started"] = True
                headers = MutableHeaders(scope=message)
                headers[REQUEST_ID_HEADER] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            logger.exception("unhandled error on %s %s", scope.get("method"), scope.get("path"))
            if status_holder["started"]:
                raise
            response = internal_error_response()
            response.headers[REQUEST_ID_HEADER] = request_id
            await response(scope, receive, send)
            status_holder["status"] = 500
        finally:
            duration_ms = (time.perf_counter() - started) * 1000.0
            logger.info(
                "%s %s -> %s (%.1f ms)",
                scope.get("method"),
                scope.get("path"),
                status_holder["status"],
                duration_ms,
            )
            request_id_var.reset(token)


__all__ = ["REQUEST_ID_HEADER", "RequestContextMiddleware"]
