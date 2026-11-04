"""Logging configuration with request-id correlation."""

from __future__ import annotations

import logging
from contextvars import ContextVar

request_id_var: ContextVar[str | None] = ContextVar("lunaris_request_id", default=None)

LOGGER_NAME = "lunaris"
_FORMAT = "%(asctime)s %(levelname)-7s %(name)s [req=%(request_id)s] %(message)s"


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get() or "-"
        return True


def configure_logging(level: str) -> logging.Logger:
    """Configure the ``lunaris`` logger tree (idempotent)."""
    logger = logging.getLogger(LOGGER_NAME)
    logger.setLevel(level)
    if not any(getattr(h, "_lunaris", False) for h in logger.handlers):
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(_FORMAT))
        handler.addFilter(RequestIdFilter())
        handler._lunaris = True  # type: ignore[attr-defined]
        logger.addHandler(handler)
        logger.propagate = False
    return logger


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"{LOGGER_NAME}.{name}")


__all__ = ["configure_logging", "get_logger", "request_id_var"]
