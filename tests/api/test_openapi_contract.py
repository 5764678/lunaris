"""The committed OpenAPI document is the contract the TypeScript client is generated from.
It must match the application exactly; regenerate with `npm run contracts:generate`."""

from __future__ import annotations

import json
from pathlib import Path

from lunaris_api.openapi import DEFAULT_OUTPUT, build_openapi_document, render

REPO_ROOT = Path(__file__).resolve().parents[2]
CONTRACT = REPO_ROOT / DEFAULT_OUTPUT


def test_committed_contract_matches_application() -> None:
    assert CONTRACT.is_file(), "missing contract; run `npm run contracts:generate`"
    assert CONTRACT.read_text(encoding="utf-8") == render(build_openapi_document()), (
        "OpenAPI contract drift: run `npm run contracts:generate` and commit the result"
    )


# Their 503 carries the health report itself, not the error envelope.
HEALTH_PATHS = ("/health", "/health/ready")


def test_every_error_response_uses_the_envelope() -> None:
    document = json.loads(CONTRACT.read_text(encoding="utf-8"))
    assert "HTTPValidationError" not in document["components"]["schemas"]
    for path, operations in document["paths"].items():
        for method, operation in operations.items():
            for code, response in operation["responses"].items():
                if int(code) >= 400 and path not in HEALTH_PATHS:
                    ref = response["content"]["application/json"]["schema"]["$ref"]
                    assert ref.endswith("/ErrorResponse"), (method, path, code)
