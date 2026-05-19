# page_variant_annotations — SnpEff / VEP overlay — Page Capability Contract

**Atlas**: genome · **Stage**: annotation · **Status**: scaffold spec (phase E target)

## Purpose

Final piece of the Genome Atlas (phase E). SnpEff / VEP impact-category
overlay per inversion candidate. Three views:

1. **Per-candidate impact tally table** — HIGH / MODERATE / LOW /
   MODIFIER counts per candidate.
2. **Compact impact bar** — stacked bar of the four categories per
   candidate.
3. **Expandable HIGH-impact variant list** — one row per HIGH variant
   with gene_id, hgvs_p, effect, position.

Depends on the cluster-side MODULE_CONSERVATION deliverables (VESM /
SIFT4G / SnpEff / GERP++).

## Architecture

Round-1 scaffold spec. Phase E wires the JSON-per-candidate adapter.

| file        | role                              |
|-------------|-----------------------------------|
| `_state.js` | `_pageState` handle               |

## Capabilities

- Tally table.
- Compact bar per candidate.
- Expandable HIGH-impact rows.
- Candidate selector (cross-atlas).

## Required data

- **Registry says (round 1)**: `requires_layers: []`, `requires_slots: []`
- **Future requires_layers**: `variant_annotations`, `gene_track`
- **Future requires_slots**: `candidateList`

## User interactions

- Candidate selector.
- Row click → expand HIGH variants.
- Variant hover → tooltip with hgvs_p + hgvs_c.

## Outputs

Preview only.

## Connected analyses / adapters

- **IN adapter**: `import_variant_annotations` —
  [runners/variant_annotations.py](../../../../atlases/genome/registries/runners/variant_annotations.py) →
  [extractors/variant_annotations.py](../../../../atlases/genome/registries/extractors/variant_annotations.py) →
  [schema_out/variant_annotations_v1](../../../../atlases/genome/registries/schemas/schema_out/variant_annotations_v1.schema.json).
- **Upstream pipeline**: SnpEff + VEP per inversion-candidate VCF slice.
- **Tolerant of two shapes**: pre-tallied (`impact_counts`) or raw
  (`variants[]`, extractor tallies on the way in).

## Status and known issues

- **Phase E (last)**: depends on MODULE_CONSERVATION cluster-side
  deliverables not yet shipped.

## Documents

- **Registry doc**: [pages.registry.json](../../../../atlases/genome/registries/data/pages.registry.json) → `pages.page_variant_annotations._doc`
- **Schema**: [`variant_annotations_v1`](../../../../atlases/genome/registries/schemas/schema_out/variant_annotations_v1.schema.json)

**Confidence**: high
