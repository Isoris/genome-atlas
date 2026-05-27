# `fixtures/haplotype_synteny/` — Focal Gar↔Mac wfmash synteny

Companion to **page_haplotype_synteny**. Carries the focal-pair output
of `STEP_CS01_extract_breakpoints.py` (the BP_ATLAS pipeline's `cs`
caller) — schema v2 `synteny_blocks.json`. Single pair:
`fClaHyb_Gar_LG` query × `fClaHyb_Mac_LG` target.

**NOT** the multi-species cross-species output. The cross-species
panel (17-genome mashmap triage, all-vs-focal alignments, reciprocity,
arc views) lives in the separate cross-species atlas — per the user's
`COPY_TO_MNT_E.md` split between `results_genome/` and
`results_cross_species/`.

## Tree

```
fixtures/haplotype_synteny/
├── README.md                    this file
├── synteny_blocks.json          42 blocks × focal pair × strand × bp
└── synteny_figures/             Python helper that emits PDF/PNG figures
                                  off the same JSON (manuscript outputs)
    ├── README.md                package README
    ├── bp_multitrack.py         multi-method breakpoint overlay (4 tracks)
    ├── pkg/                     installable Python package source
    │   ├── __init__.py
    │   ├── cli.py
    │   ├── data.py              CSBreakpoints class — the parser
    │   └── style.py             BAND palette, ribbon/dotplot helpers
    └── pyproject.toml
```

## Page consumer

**`page_haplotype_synteny`** reads exactly `synteny_blocks.json` and
renders four views inline as SVG: per-Gar-chrom ribbons, focal Oxford
dotplot, LG28↔(LG06+LG01) fusion/fission event panel, strand-orientation
summary. The Python `synteny_figures` package is the manuscript-output
side — it emits PDF/PNG of the same shapes for the paper.

## Headline content (real numbers from the fixture)

- **42 synteny blocks** total, **40.1 Mb** covered
- **29 inverted-strand / 13 same-strand** blocks (focal-pair strand bias)
- **LG28 → {LG06, LG01}** — the only Gar chrom that splits across two
  Mac chroms. Sequence-level signature of the n=28 vs n=27 karyotype
  difference. LG06 takes the bulk (6 blocks); LG01 takes the lesser
  arm (2 blocks).
- Other focal pairs (1:1 in this fixture): LG15→LG06 (2 blocks),
  LG23→LG01 (16 blocks), LG27→LG01 (16 blocks).
- Mac side fan-in: LG01 receives anchors from Gar (LG23, LG27, LG28);
  LG06 receives from (LG15, LG28).

## Schema (v2)

Top-level keys: `tool` ('wfmash_synteny'), `schema_version` (2),
`species_query`, `species_target`, `chrom_lengths_query` (dict),
`chrom_lengths_target` (dict), `n_synteny_blocks`, `synteny_blocks`
(list of `{gar_chr, gar_start, gar_end, mac_chr, mac_start, mac_end,
strand, block_size_bp, mapping_quality}`).

The full schema is embedded inline on `page_haplotype_synteny.html`
(search for `ga-schema-block`).

## Adapter

`atlases/genome/registries/extractors/haplotype_synteny_blocks.py`
parses the upstream JSON and wraps it with derived summary fields
(per-pair counts, multi-target lists for fusion/fission detection,
strand distribution). Output schema: `haplotype_synteny_v0`. Smoke-test:

```bash
python3 -c "
import sys; sys.path.insert(0, 'atlases/genome/registries')
from extractors.haplotype_synteny_blocks import extract
out = extract({'synteny_blocks_json': 'fixtures/haplotype_synteny/synteny_blocks.json'})
print(out['n_synteny_blocks'], out['multi_target_gar'])
# expect: 42 [{'gar_chr': 'LG28', 'mac_partners': ['LG01', 'LG06']}]
"
```

## Regenerate

`STEP_CS01_extract_breakpoints.py` in the BP_ATLAS pipeline rebuilds the
JSON from a fresh wfmash PAF. The bundled `synteny_figures` Python
package regenerates the manuscript PDFs / PNGs from the same JSON.

## Strand orientation note

The wfmash chain reports strand per block; the focal pair shows
**~69% inverted-strand blocks** (29/42). This is **not** 29 real
inversions — most are convention-mirroring artefacts of how each
assembly fixed its scaffolds. The `MODULE_BP0_orient` pre-pass
classifies each Gar chrom as FLIP / KEEP / MIXED; the canonical
breakpoint pipeline runs in **native coordinates with no
reverse-complement** (orientation handled at plot/display time only).
See View 4 on the page for the 16-FLIP / 12-KEEP / 2-MIXED summary.
