"""runner: import_ortholog_pairs — ingests an OrthoFinder per-pair gene table.

One JSON per (focal × non-focal) pair: gene-level rows for the
page_orthologues View 3 explorer. Lazy-loaded on column reveal. File-
import only.
"""
from __future__ import annotations
from typing import Any, Dict
from . import _file_import as _fi


def run(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    return _fi.import_file(manifest, output_key="pairs_path")
