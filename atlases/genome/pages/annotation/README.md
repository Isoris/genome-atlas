# `pages/annotation/` — Genome Atlas annotation stage

Functional annotation lens: genes, repeats / TEs, conserved elements,
variant impacts. Where the assembly paper meets the Inversion Atlas
manuscript.

## What each page does

| page | manifest stage | label | summary | phase |
|------|----------------|-------|---------|-------|
| `page_genes`               | annotation | genes               | gene-density + per-chrom track + per-candidate cargo (cross-atlas) | B / C |
| `page_repeats_te`          | annotation | repeats / TE        | per-class + per-chrom heatmap + per-candidate breakpoint enrichment + alluvial | B |
| `page_conserved_elements`  | annotation | conserved elements  | UCE + phastCons regulatory-disruption overlay per candidate | C / D |
| `page_variant_annotations` | annotation | variant annotations | SnpEff / VEP impact overlay per candidate | E (final) |

## Vocabulary contracts

### Impact category (per `variant_annotations_v1`)

Locked four-value enum (matches SnpEff impact + VEP severity):

| value      | typical effects |
|------------|-----------------|
| `HIGH`     | frameshift, stop_gained, splice_acceptor / donor, start_lost |
| `MODERATE` | missense, inframe indel, splice_region |
| `LOW`      | synonymous, intron, 5′/3′ UTR |
| `MODIFIER` | intergenic, downstream, upstream |

Page must render all four bins even when count is zero (avoids
"absent vs zero" ambiguity).

### TE classification (per `repeat_track_v1` + `te_hierarchy_v1`)

`class` and `family` fields follow the Wicker et al. 2007 hierarchy,
split on `/` from the BED col-4 name (`LTR/Gypsy-1` → class=`LTR`,
family=`Gypsy-1`). The `te_hierarchy` layer carries the full N-level
tree for the alluvial view.

### Feature type filter (per `gene_track_v1`)

Default: GFF3 `gene` features only. Pass
`params.feature_types=["mRNA","exon",...]` at IN time to widen. The
emit shape is the same regardless of type.

## Cross-page dependencies

- **page_genes** view 3 (cargo) consumes the Inversion Atlas's
  `candidateList` slot — defer until that slot is wired cross-atlas.
- **page_repeats_te** view 3 (breakpoint enrichment) ALSO consumes
  `candidateList`. Shares the focal-vs-bg widget with the Inversion
  Atlas's `page16`.
- **page_variant_annotations** consumes `candidateList` for the
  per-candidate tally.
- **page_conserved_elements** + **page_synteny** share the Cactus
  output (`synteny_blocks`) — fetched once via the registry cache.

## Round-1 status

All four pages ship as scaffold specs — fragments list required layers,
placeholders render with `TODO_MISSING` banners. Phase B starts with
`page_repeats_te` views 1+2 (the simplest) and `page_genes` view 2.
Phase E (last) is `page_variant_annotations`.

## IN / OUT adapters added 2026-05-20

Five typed adapter pipelines added for this stage:

| layer | runner | extractor | schema_in | schema_out |
|-------|--------|-----------|-----------|-----------|
| `gene_track`           | [`runners/gene_track.py`](../../registries/runners/gene_track.py)                     | [`extractors/gene_track.py`](../../registries/extractors/gene_track.py)                     | [`import_gene_track_v1`](../../registries/schemas/schema_in/import_gene_track_v1.schema.json)                     | [`gene_track_v1`](../../registries/schemas/schema_out/gene_track_v1.schema.json) |
| `repeat_track`         | [`runners/repeat_track.py`](../../registries/runners/repeat_track.py)                 | [`extractors/repeat_track.py`](../../registries/extractors/repeat_track.py)                 | [`import_repeat_track_v1`](../../registries/schemas/schema_in/import_repeat_track_v1.schema.json)                 | [`repeat_track_v1`](../../registries/schemas/schema_out/repeat_track_v1.schema.json) |
| `te_hierarchy`         | [`runners/te_hierarchy.py`](../../registries/runners/te_hierarchy.py)                 | [`extractors/te_hierarchy.py`](../../registries/extractors/te_hierarchy.py)                 | [`import_te_hierarchy_v1`](../../registries/schemas/schema_in/import_te_hierarchy_v1.schema.json)                 | [`te_hierarchy_v1`](../../registries/schemas/schema_out/te_hierarchy_v1.schema.json) |
| `conserved_elements`   | [`runners/conserved_elements.py`](../../registries/runners/conserved_elements.py)     | [`extractors/conserved_elements.py`](../../registries/extractors/conserved_elements.py)     | [`import_conserved_elements_v1`](../../registries/schemas/schema_in/import_conserved_elements_v1.schema.json)     | [`conserved_elements_v1`](../../registries/schemas/schema_out/conserved_elements_v1.schema.json) |
| `variant_annotations`  | [`runners/variant_annotations.py`](../../registries/runners/variant_annotations.py)   | [`extractors/variant_annotations.py`](../../registries/extractors/variant_annotations.py)   | [`import_variant_annotations_v1`](../../registries/schemas/schema_in/import_variant_annotations_v1.schema.json)   | [`variant_annotations_v1`](../../registries/schemas/schema_out/variant_annotations_v1.schema.json) |

## SPECs relevant to annotation

- [`KICKOFF_genome_atlas.md`](../../../../KICKOFF_genome_atlas.md) — §Q1
  for the gene / repeat / variant scope decisions.

## Per-page contracts

[`docs/generated/page_contracts/<page_id>/`](../../../../docs/generated/page_contracts/) — every annotation page has a contract.

## Notes for new contributors

- **Two-shape tolerance** (extractors): both `te_hierarchy` and
  `variant_annotations` accept legacy + canonical shapes from upstream.
  Don't add a third shape in the renderer — the IN adapter is the
  single normalization point.
- **`feature_types` param** on `gene_track` defaults to `["gene"]`. If
  a page needs `mRNA` or `exon`, the consuming round must invoke the
  importer with the widened list (cluster-side re-emit, not a renderer
  fallback).
- **page_variant_annotations is phase-E** — last to ship; depends on
  cluster-side `MODULE_CONSERVATION` deliverables (VESM / SIFT4G /
  SnpEff / GERP++).
