"""ASGI entry point: ``uvicorn lunaris_api.main:app``."""

from lunaris_api.app import create_app

app = create_app()
