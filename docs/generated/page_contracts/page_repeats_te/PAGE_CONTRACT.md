# page_repeats_te — repeats / TE landscape + breakpoint enrichment — Page Capability Contract

**Atlas**: genome · **Stage**: annotation · **Status**: scaffold spec (phase B target)

## Purpose

Three views:

1. **Per-class composition** — LTR / LINE / SINE / DNA / simple /
   unclassified bars per haplotype.
2. **Per-chrom density heatmap** — TE density by class × chrom.
3. **Breakpoint enrichment per inversion candidate** — Spalax-style
   focal-vs-bg widget (same widget the Inversion Atlas uses on its
   page16 breakpoints page).
4. **TE-hierarchy alluvial** — optional 4th view, per parental
   haplotype, N-level Wicker-2007 hierarchy (`te_hierarchy` layer; the
   alluvial renderer auto-adapts the legacy `{total_bp,classes}` shape).

## Architecture

Round-1 scaffold spec. Phase B wires the BED-driven per-class +
per-chrom views.

| file        | role                              |
|-------------|-----------------------------------|
| `_state.js` | `_pageState` handle               |

## Capabilities

- View toggle (composition / heatmap / breakpoint / alluvial).
- Haplotype toggle (Gar / Mac).
- Candidate selector (cross-atlas via `candidateList`).

## Required data

- **Registry says (round 1)**: `requires_layers: []`, `requires_slots: []`
- **Future requires_layers**: `repeat_track`, `chromosome_map`,
  `te_hierarchy` (optional)
- **Future requires_slots**: `candidateList`, `activeHaplotype`

## User interactions

- View toggle.
- Candidate selector (phase C).
- Hover TE class → tooltip with bp + % of haplotype.

## Outputs

Preview only.

## Connected analyses / adapters

- **IN adapter**: `import_repeat_track`, `import_te_hierarchy`.
- **Upstream pipelines**: RepeatMasker / EDTA per haplotype; cluster
  post-processing aggregates to Wicker-2007 tree for the alluvial view.

## Status and known issues

- **Alluvial view auto-adapts legacy shape**: extractor handles both
  `{haplotypes:[…]}` (canonical) and `{total_bp,classes:[…]}` (legacy).
  Renderer should stay single-shape (canonical).

## Documents

- **Registry doc**: [pages.registry.json](../../../../atlases/genome/registries/data/pages.registry.json) → `pages.page_repeats_te._doc`
- **Schemas**: [`repeat_track_v1`](../../../../atlases/genome/registries/schemas/schema_out/repeat_track_v1.schema.json), [`te_hierarchy_v1`](../../../../atlases/genome/registries/schemas/schema_out/te_hierarchy_v1.schema.json)

**Confidence**: high
