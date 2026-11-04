"""Export the OpenAPI document (the source of truth for the TypeScript contract types).

    uv run lunaris-api-openapi --output packages/shared-types/openapi/lunaris-api.openapi.json

The document is generated from the application factory without starting a server and
without touching the configured data directory.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from lunaris_api.app import create_app
from lunaris_api.settings import Settings

DEFAULT_OUTPUT = Path("packages/shared-types/openapi/lunaris-api.openapi.json")


def build_openapi_document() -> dict[str, Any]:
    # Fixed settings so the document does not depend on the developer's environment.
    settings = Settings(environment="development", docs_enabled=True, cors_origins=[])
    return create_app(settings).openapi()


def render(document: dict[str, Any]) -> str:
    return json.dumps(document, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="lunaris-api-openapi", description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--check", action="store_true", help="exit 1 if the file on disk is out of date"
    )
    args = parser.parse_args(argv)
    rendered = render(build_openapi_document())
    if args.check:
        current = args.output.read_text(encoding="utf-8") if args.output.is_file() else ""
        if current != rendered:
            sys.stderr.write(f"{args.output} is out of date; run `npm run contracts:generate`\n")
            return 1
        return 0
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(rendered, encoding="utf-8")
    sys.stdout.write(f"wrote {args.output}\n")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
