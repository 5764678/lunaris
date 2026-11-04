"""``lunaris-data`` command-line interface.

Exit codes: 0 success, 1 operation failed (download, integrity, preprocessing),
2 usage error (unknown dataset id, invalid arguments).
"""

from __future__ import annotations

import argparse
import os
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import TextIO

from lunaris_data import __version__
from lunaris_data.ingestion import AcquisitionError, acquire_dataset
from lunaris_data.ingestion.download import ProgressCallback
from lunaris_data.preprocessing import PreprocessingError, build_web_texture
from lunaris_data.registry import DatasetRegistry, UnknownDatasetError
from lunaris_data.store import DataLayout, inspect_dataset
from lunaris_data.validation import verify_dataset

EXIT_OK = 0
EXIT_FAILED = 1
EXIT_USAGE = 2
DEFAULT_TEXTURE_DIR = Path("apps/web/public/textures/moon")
_BINARY_STEP = 1024


def resolve_data_root(explicit: Path | None) -> Path:
    """``--data-dir`` > ``$LUNARIS_DATA_DIR`` > ``./data``."""
    if explicit is not None:
        return explicit
    env = os.environ.get("LUNARIS_DATA_DIR")
    return Path(env) if env else Path("data")


def _human_bytes(size: float) -> str:
    for unit in ("B", "KiB", "MiB", "GiB"):
        if size < _BINARY_STEP or unit == "GiB":
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= _BINARY_STEP
    raise AssertionError("unreachable")  # pragma: no cover


def _progress_printer(stream: TextIO) -> ProgressCallback | None:
    if not stream.isatty():
        return None

    def report(received: int, total: int | None) -> None:
        total_text = f" / {_human_bytes(total)}" if total else ""
        stream.write(f"\r    {_human_bytes(received)}{total_text}   ")
        stream.flush()

    return report


def _cmd_list(registry: DatasetRegistry, layout: DataLayout, out: TextIO) -> int:
    out.write(f"data root: {layout.root}\n\n")
    out.write(f"{'DATASET':<30} {'CATEGORY':<14} {'URLS':<11} {'LOCAL':<11} FILES\n")
    for manifest in registry:
        state = inspect_dataset(manifest, layout)
        out.write(
            f"{manifest.id:<30} {manifest.category.value:<14} "
            f"{manifest.verification.status.value:<11} {state.status.value:<11} "
            f"{state.files_present}/{len(manifest.files)}\n"
        )
    return EXIT_OK


def _cmd_show(registry: DatasetRegistry, dataset_id: str, out: TextIO) -> int:
    out.write(registry.get(dataset_id).model_dump_json(indent=2) + "\n")
    return EXIT_OK


def _cmd_acquire(
    registry: DatasetRegistry, layout: DataLayout, dataset_id: str, *, force: bool
) -> int:
    manifest = registry.get(dataset_id)
    err = sys.stderr
    err.write(f"acquiring {manifest.id} → {layout.dataset_dir(manifest)}\n")

    def progress_for(name: str) -> ProgressCallback | None:
        err.write(f"  {name}\n")
        return _progress_printer(err)

    try:
        outcome = acquire_dataset(manifest, layout, force=force, progress_for=progress_for)
    except AcquisitionError as exc:
        err.write(f"\nerror: {exc}\n")
        return EXIT_FAILED
    if outcome.skipped:
        err.write("already acquired (use --force to re-download)\n")
    else:
        err.write("\n")
        for entry in outcome.record.files:
            err.write(
                f"  ✓ {entry.name}  {_human_bytes(entry.size_bytes)}  sha256={entry.sha256}\n"
            )
    return EXIT_OK


def _cmd_verify(registry: DatasetRegistry, layout: DataLayout, dataset_id: str, out: TextIO) -> int:
    report = verify_dataset(registry.get(dataset_id), layout)
    if not report.has_record:
        out.write(f"{dataset_id}: no acquisition record — not acquired with lunaris-data\n")
    for check in report.checks:
        detail = f"  ({check.detail})" if check.detail else ""
        out.write(f"  {check.result.value:<26} {check.name}{detail}\n")
    out.write(f"{dataset_id}: {'OK' if report.ok else 'FAILED'}\n")
    return EXIT_OK if report.ok else EXIT_FAILED


def _cmd_build_texture(
    registry: DatasetRegistry, layout: DataLayout, args: argparse.Namespace, out: TextIO
) -> int:
    try:
        manifest = build_web_texture(
            layout,
            registry,
            args.output_dir,
            source_file=args.source_file,
            quality=args.quality,
            max_width=args.max_width,
        )
    except PreprocessingError as exc:
        sys.stderr.write(f"error: {exc}\n")
        return EXIT_FAILED
    out.write(
        f"wrote {args.output_dir / manifest.file} ({manifest.width}×{manifest.height}) "
        f"and {args.output_dir / 'manifest.json'}\n"
    )
    return EXIT_OK


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lunaris-data",
        description="Acquire, verify and preprocess the NASA datasets used by LUNARIS.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=None,
        help="data store root (default: $LUNARIS_DATA_DIR or ./data)",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list", help="list registered datasets and their local status")
    show = sub.add_parser("show", help="print a dataset manifest")
    show.add_argument("dataset_id")
    acquire = sub.add_parser("acquire", help="download a dataset and record its provenance")
    acquire.add_argument("dataset_id")
    acquire.add_argument("--force", action="store_true", help="re-download even if acquired")
    verify = sub.add_parser("verify", help="re-hash an acquired dataset against its record")
    verify.add_argument("dataset_id")
    texture = sub.add_parser(
        "build-web-texture", help="build the globe texture from the acquired CGI Moon Kit"
    )
    texture.add_argument("--output-dir", type=Path, default=DEFAULT_TEXTURE_DIR)
    texture.add_argument("--source-file", default=None)
    texture.add_argument("--quality", type=int, default=88)
    texture.add_argument("--max-width", type=int, default=4096)
    return parser


def main(argv: Sequence[str] | None = None, *, out: TextIO | None = None) -> int:
    stream = out or sys.stdout
    args = build_parser().parse_args(argv)
    layout = DataLayout.from_root(resolve_data_root(args.data_dir))
    registry = DatasetRegistry.load_builtin()
    try:
        match args.command:
            case "list":
                return _cmd_list(registry, layout, stream)
            case "show":
                return _cmd_show(registry, args.dataset_id, stream)
            case "acquire":
                return _cmd_acquire(registry, layout, args.dataset_id, force=args.force)
            case "verify":
                return _cmd_verify(registry, layout, args.dataset_id, stream)
            case "build-web-texture":
                return _cmd_build_texture(registry, layout, args, stream)
    except UnknownDatasetError as exc:
        sys.stderr.write(f"error: {exc}; known ids: {', '.join(registry.ids())}\n")
        return EXIT_USAGE
    raise AssertionError(f"unhandled command {args.command!r}")  # pragma: no cover


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
