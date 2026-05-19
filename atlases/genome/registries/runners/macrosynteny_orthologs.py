"""runner: import_macrosynteny_orthologs — ingests OrthoFinder/wfmash-anchor JSON.

One JSON per species pair carrying gene-anchor positions for the
page_synteny macrosyntR Oxford-grid + linear macro-synteny views. File-
import only.
"""
from __future__ import annotations
from typing import Any, Dict
from . import _file_import as _fi


def run(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    return _fi.import_file(manifest, output_key="pairs_path")
