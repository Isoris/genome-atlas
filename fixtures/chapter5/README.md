# `fixtures/chapter5/` — Comparative TE landscape (Chapter 5 ingest)

Companion to **page_comparative_te**. Ingest of the Chapter 5 deliverable
([HANDOFF6.md][hb] from session 2026-05-25), wired so the page renders
the same plots — abundance bars (Fig 5.1), Kimura age landscape
(Fig 5.2), Cgar centromere context (Table 5.4), ALG collinearity heatmap,
and the breakpoint × TE cross (the chapter's key deliverable).

**Cohort:** 17 chromosome-scale catfish genomes + the two focal
haplotype frames (`fClaHyb_Gar` = *C. gariepinus*, 28 chr;
`fClaHyb_Mac` = *C. macrocephalus*, 27 chr).

**NOT** the 226-sample hatchery cohort (that's the Inversion Atlas).

## Tree

```
fixtures/chapter5/
├── README.md                                        this file
├── consolidated.json                                single-fetch envelope (the page reads this)
├── te_abundance/
│   ├── TE_data_figure1_toky_v2.tsv                  long-format abundance (246 rows × 17 sp × class × family)
│   ├── metadata_long.tsv                            18-species accession + genome-length metadata
│   └── SO_keys_TE_family_to_sequence_ontology.tsv   family → SO-term map
├── kimura/                                          per-species K2P divergence summaries
│   ├── GCA_<acc>_<Genus>_<species>_short.fa.Kimura.distance     (15 species)
│   └── Clarias_macrocephalus_short.fa.Kimura.distance           (2 focal frames)
├── intact_bed/                                      per-element TE BED (intact-only)
│   ├── fClaHyb_Gar_LG.fa.mod.EDTA.intact.bed        9 304 rows
│   └── fClaHyb_Mac_LG.fa.mod.EDTA.intact.bed        ~6 500 rows
├── centromeres/
│   └── df_centromeres_Clarias_gariepinus.tsv        29 Cgar RefSeq-frame centromeres
└── synteny/
    ├── ALG_collinearity_map.tsv                     504 rows: Gar LG × catfish species × anchors
    └── gar_lengths.tsv                              Cgar chrom lengths
```

## Page consumer

**`page_comparative_te`** reads exactly **one** file from this tree:
`consolidated.json` (~750 KB). The other files are upstream raw output
that the consolidated envelope is derived from — they ship as fixtures
so forensic questions can be answered without leaving the repo.

The consolidated envelope is built by:
```bash
python3 -c "
import json, csv, pathlib, re, collections
# … the build script that lives at scripts/build_chapter5_consolidated.py
# (not yet checked in — the file you see here was built once in-session)
"
```

## Adapters

Four Python extractors under `atlases/genome/registries/extractors/`
parse the upstream files into normalized envelopes the dispatcher can
ingest:

| Adapter file | Input | Output envelope | Action |
|---|---|---|---|
| `edta_intact_bed.py`   | `*.EDTA.intact.bed`       | `repeat_track_intact_v0` (same as GFF3 form) | `edta_intact_bed_ingest` |
| `kimura_distance.py`   | `*.Kimura.distance`        | `kimura_landscape_v0`                         | `kimura_distance_ingest` |
| `te_abundance_table.py`| `TE_data_figure1_*.tsv`    | `te_abundance_v0`                              | `te_abundance_ingest` |
| `centromere_table.py`  | `df_centromeres_*.tsv`     | `centromeres_table_v0`                         | `centromere_table_ingest` |

Smoke-test (run from the repo root):
```bash
python3 -c "
import sys; sys.path.insert(0, 'atlases/genome/registries')
from extractors.edta_intact_bed import extract
print(extract({'intact_bed': 'fixtures/chapter5/intact_bed/fClaHyb_Gar_LG.fa.mod.EDTA.intact.bed'})['n_features'])
# expect: 9304
"
```

## Confirmed numbers (from HANDOFF6, exact from uploaded TSVs)

**GAR:** 377 breakpoints, 202 with ≥ 1 TE in ±50 kb. Inversions 331,
noncollinear 39, inverted_translocation 4, translocation 2,
fission_or_fusion 1. Youngest TE class: DNA 117, MITE 48, LTR 37.
Region: 304 paracentromeric / 27 pericentromeric (inversions).

**MAC:** 412 breakpoints, 223 with TE. Inversions 321, noncollinear 58,
fission_or_fusion 6, translocation 7, inverted_translocation 5.
Youngest: DNA 124, MITE 65, LTR 34.

**Key:** both genomes independently → DNA transposons are the most
common youngest TE; breakpoints overwhelmingly paracentromeric;
events dominated by inversions.

## Known caveat

Only **64 / 377 Gar breakpoints are base-precise**; 83% sit on round
50 kb multiples (binned). Consequence: enrichment at ±50 kb measures
**neighbourhood density**, not what sits ON the junction. The DNA-
transposon dominance (117 / 202) is currently a **raw count**, not
enrichment. Whether it's real enrichment depends on genome-wide
background → see the TE12 upgrade output
(`breakpoint_TEclass_enrichment_<F>.tsv`, Fisher + fold-enrichment
with Bonferroni against intact-TE genome-wide background).

## Rebuild

The R-module scripts under
`chapter5_TE_module.tar.gz` (path: `module/01_te_annotation` through
`module/07_breakpoint_cross/`) regenerate every figure here. See
[HANDOFF6][hb] for run instructions.

[hb]: ../../KICKOFF_genome_atlas.md "see also: KICKOFF for the broader cohort discipline"
