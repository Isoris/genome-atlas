"""Shared file-import helper for genome-atlas runners.

Every genome-atlas layer ships from an external cluster-side pipeline
(BUSCO + asmstats, BRAKER, EDTA, OrthoFinder, Cactus, SnpEff/VEP, …).
The atlas's job is to *register* those outputs, not produce them. So
each per-layer runner is just:

    1. resolve target.path under ATLAS_PROJECT_ROOT (reject traversal)
    2. copy the file under raw_results/genome/<action_id>/ for
       provenance
    3. return {layer_key_path, source_rel, subject?}

This module centralises that boilerplate so per-layer runners stay tiny
(~10 lines each). It does NOT invoke any server engines — genome-atlas
pipelines are all external. The mirror of inversion-atlas's
runners/popstats.py (which POSTs to an internal endpoint) is not used
here; the genome atlas's IN side is pure file-ingest.
"""
from __future__ import annotations

import os
import pathlib
import shutil
from typing import Any, Dict, Optional


def project_root() -> pathlib.Path:
    root = os.environ.get("ATLAS_PROJECT_ROOT")
    return pathlib.Path(root) if root else pathlib.Path.cwd()


def resolve_target(rel: str) -> pathlib.Path:
    """Resolve `rel` under the project root and reject path-traversal."""
    root = project_root().resolve()
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


def workdir(manifest: Dict[str, Any]) -> pathlib.Path:
    return project_root() / "raw_results" / "genome" / manifest["action_id"]


def import_file(manifest: Dict[str, Any], output_key: str = "file_path",
                extras: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """Resolve target.path, copy under raw_results/genome/<action_id>/,
    return {output_key: <copy_path>, source_rel, subject?, **extras}."""
    target = manifest["target"]
    src = resolve_target(target["path"])
    out_dir = workdir(manifest)
    out_dir.mkdir(parents=True, exist_ok=True)
    copy_path = out_dir / src.name
    shutil.copyfile(src, copy_path)
    out: Dict[str, str] = {
        output_key:   str(copy_path),
        "source_rel": target["path"],
    }
    subj = target.get("subject")
    if subj:
        out["subject"] = subj
    if extras:
        out.update(extras)
    return out
