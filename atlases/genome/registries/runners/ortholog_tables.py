"""runner: import_ortholog_tables — ingests an OrthoFinder summary JSON.

One JSON per focal genome: focal × non-focal counts (1:1, 1:n, m:1, m:n,
orphans) + per-focal-chrom %1:1 breakdown. Powers page_orthologues
Views 1 + 2. File-import only.
"""
from __future__ import annotations
from typing import Any, Dict
from . import _file_import as _fi


def run(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    return _fi.import_file(manifest, output_key="tables_path")
