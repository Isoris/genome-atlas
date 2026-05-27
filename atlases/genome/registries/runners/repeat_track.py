"""runner: import_repeat_track — ingests a RepeatMasker / EDTA BED.

The extractor parses BED intervals plus a `family` / `class` column when
present. File-import only.
"""
from __future__ import annotations
from typing import Any, Dict
from . import _file_import as _fi


def run(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    return _fi.import_file(manifest, output_key="bed_path")
