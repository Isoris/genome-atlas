"""runner: import_conserved_elements — ingests a phastCons / UCE BED.

The extractor parses BED intervals plus an optional score column. File-
import only.
"""
from __future__ import annotations
from typing import Any, Dict
from . import _file_import as _fi


def run(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    return _fi.import_file(manifest, output_key="bed_path")
