"""Kimura-landscape / TE-abundance / centromere-table ingest runners.

Three actions, all sharing the same shape as edta_ingest.py: resolve a
workspace-relative input, copy it under raw_results/genome/<action_id>/
for provenance, return {key: path} for the extractor.

  kimura_distance_ingest   → extractors.kimura_distance.extract
  te_abundance_ingest      → extractors.te_abundance_table.extract
  centromere_table_ingest  → extractors.centromere_table.extract

The keys returned match `raw_outputs.get(<key>)` in each extractor.
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


def kimura_distance_ingest(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    """Resolve + copy a RepeatMasker `.distance` (divsum) file."""
    src = _resolve(manifest['target']['path'])
    dst = _copy_in(src, _workdir(manifest))
    return {'kimura_distance': str(dst)}


def te_abundance_ingest(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    """Resolve + copy a long-format TE-abundance TSV."""
    src = _resolve(manifest['target']['path'])
    dst = _copy_in(src, _workdir(manifest))
    return {'te_abundance_tsv': str(dst)}


def centromere_table_ingest(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    """Resolve + copy a quarTeT / centromics centromere TSV."""
    src = _resolve(manifest['target']['path'])
    dst = _copy_in(src, _workdir(manifest))
    return {'centromere_tsv': str(dst)}
