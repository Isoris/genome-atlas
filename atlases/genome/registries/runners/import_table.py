"""Genome-atlas runners — file-only imports.

`import_table` resolves `target.path` against ATLAS_PROJECT_ROOT, copies
the file under raw_results/genome/<action_id>/ for provenance, and
returns the path so the extractor can parse it. No server endpoints are
invoked — the runner is a pure file-IO step.
"""
from __future__ import annotations

import os
import pathlib
import shutil
from typing import Any, Dict


def _project_root() -> pathlib.Path:
    root = os.environ.get("ATLAS_PROJECT_ROOT")
    return pathlib.Path(root) if root else pathlib.Path.cwd()


def _resolve_target(rel: str) -> pathlib.Path:
    """Resolve `rel` under the project root and reject path-traversal."""
    root = _project_root().resolve()
    target = (root / rel).resolve()
    try:
        target.relative_to(root)
    except ValueError:
        raise ValueError(f"target.path escapes project root: {rel!r}")
    if not target.exists():
        raise FileNotFoundError(f"target.path does not exist: {rel}")
    if not target.is_file():
        raise IsADirectoryError(f"target.path is not a file: {rel}")
    return target


def _workdir(manifest: Dict[str, Any]) -> pathlib.Path:
    return _project_root() / "raw_results" / "genome" / manifest["action_id"]


def import_table(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    target = manifest["target"]
    src = _resolve_target(target["path"])
    out_dir = _workdir(manifest)
    out_dir.mkdir(parents=True, exist_ok=True)
    copy_path = out_dir / src.name
    shutil.copyfile(src, copy_path)
    return {
        "table_path":   str(copy_path),
        "source_rel":   target["path"],
        "subject":      target.get("subject", ""),
    }
