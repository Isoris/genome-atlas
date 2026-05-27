# Genome Atlas — Page Contract Index

Per-page capability contracts for all 11 Genome Atlas pages (post-2026-05-19
meiosis carve-out). Each contract follows the Inversion Atlas template:
Purpose · Architecture · Capabilities · Required data · User interactions ·
Outputs · Connected analyses · Status · Documents.

## By stage

### assembly

- [`page_scaffold`](page_contracts/page_scaffold/PAGE_CONTRACT.md) — landing / vision / chip inventory · round 1
- [`page_assembly_stats`](page_contracts/page_assembly_stats/PAGE_CONTRACT.md) — BUSCO + N50 + gap + T2T tiles · phase B
- [`page_chromosome_overview`](page_contracts/page_chromosome_overview/PAGE_CONTRACT.md) — length-scaled chromosome strip · phase B (primary)
- [`page_assembly_methods`](page_contracts/page_assembly_methods/PAGE_CONTRACT.md) — HiFi+Hi-C+ONT pipeline walkthrough · round 1 (final)

### annotation

- [`page_genes`](page_contracts/page_genes/PAGE_CONTRACT.md) — gene density / track / cargo · phase B / C
- [`page_repeats_te`](page_contracts/page_repeats_te/PAGE_CONTRACT.md) — TE landscape + breakpoint enrichment · phase B
- [`page_conserved_elements`](page_contracts/page_conserved_elements/PAGE_CONTRACT.md) — UCE + phastCons overlay · phase C / D
- [`page_variant_annotations`](page_contracts/page_variant_annotations/PAGE_CONTRACT.md) — SnpEff / VEP impact · phase E (final)

### comparative

- [`page_synteny`](page_contracts/page_synteny/PAGE_CONTRACT.md) — pairwise + Oxford grid · phase D
- [`page_ancestral_karyotype`](page_contracts/page_ancestral_karyotype/PAGE_CONTRACT.md) — ancestral reconstruction · phase D
- [`page_orthologues`](page_contracts/page_orthologues/PAGE_CONTRACT.md) — focal × non-focal tables · phase D

## Phasing roadmap

| phase | pages activated |
|-------|-----------------|
| round 1 (A) | page_scaffold, page_assembly_methods |
| B           | page_assembly_stats, page_chromosome_overview, page_repeats_te, page_genes (views 1–2) |
| C           | page_genes (cargo, view 3), page_conserved_elements |
| D           | page_synteny, page_ancestral_karyotype, page_orthologues |
| E           | page_variant_annotations (final piece) |

## Stage READMEs

- [`pages/assembly/README.md`](../../atlases/genome/pages/assembly/README.md)
- [`pages/annotation/README.md`](../../atlases/genome/pages/annotation/README.md)
- [`pages/comparative/README.md`](../../atlases/genome/pages/comparative/README.md)
