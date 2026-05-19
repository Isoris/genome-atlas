"""runner: import_synteny_oxford_grid — ingests a macrosyntR Oxford-grid JSON.

Per ordered focal pair (genome A × genome B): chrom-pair Fisher-exact
counts + BH-q. Powers page_synteny View 4 (aggregated Oxford grid).
File-import only.
"""
from __future__ import annotations
from typing import Any, Dict
from . import _file_import as _fi


def run(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    return _fi.import_file(manifest, output_key="grid_path")
