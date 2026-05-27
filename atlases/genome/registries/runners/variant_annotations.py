"""runner: import_variant_annotations — ingests a SnpEff / VEP impact tally JSON.

Per-candidate: impact category counts (HIGH/MODERATE/LOW/MODIFIER) +
HIGH-impact variant list. Powers page_variant_annotations. File-import
only.
"""
from __future__ import annotations
from typing import Any, Dict
from . import _file_import as _fi


def run(manifest: Dict[str, Any], client: Any) -> Dict[str, str]:
    return _fi.import_file(manifest, output_key="va_path")
