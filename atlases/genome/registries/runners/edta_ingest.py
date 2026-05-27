"""EDTA ingest runners — point the dispatcher at one of two adapters.

Two actions:
  edta_intact_ingest  → uses extractors.edta_intact_gff.extract
  edta_all_te_ingest  → uses extractors.edta_all_te_gff.extract (streamed)

Both runners are pure file-IO: they resolve the source GFF under
ATLAS_PROJECT_ROOT, copy it into raw_results/genome/<action_id>/ for
provenance, and return {name: path}. The extractor handles the parse +
aggregation.
"""
from __future__ import annotations

import os
import pathlib
import shutil
from typing import Any, Dict


def _project_root() -> pathlib.Path:
    root = os.environ.get('ATLAS_PROJECT_ROOT')
    return pathlib.Path(root) if root else pathlib.Path.cwd()


def _resolve(rel: str) -> pathlib.Path:
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
    return _project_root() / 'raw_results' / 'genome' / manifest['action_id']


def _copy_in(src: pathlib.Path, dst_dir: pathlib.Path) -> pathlib.Path:
    dst_dir.mkdir(parents=True, exist_ok=True)
    dst = dst_dir / src.name
    shutil.copy2(src, dst)
    return dst


def edta_intact_ingest(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    """Resolve + copy a `*.EDTA.intact.gff3` file into raw_results/."""
    src = _resolve(manifest['target']['path'])
    dst = _copy_in(src, _workdir(manifest))
    return {'intact_gff3': str(dst)}


def edta_all_te_ingest(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    """Resolve + copy a `*.EDTA.TEanno.gff3(.gz)` file into raw_results/.

    Note: the file is copied as-is. The aggregation work happens in the
    extractor, which streams the file line-by-line — so the runner's
    job here is purely to stage the input for the extractor.
    """
    src = _resolve(manifest['target']['path'])
    dst = _copy_in(src, _workdir(manifest))
    return {'teanno_gff3': str(dst)}
