# page_chromosome_overview — length-scaled chromosome strip — Page Capability Contract

**Atlas**: genome · **Stage**: assembly · **Status**: scaffold spec (phase B primary)

## Purpose

Primary phase-B deliverable. One row per chromosome, length-scaled
across the page. Stacked sub-tracks:

- Base bar (with centromere overlay)
- Gene density
- Repeat density
- Conserved-element density
- CO density (sex-collapsed; cross-atlas from meiosis-atlas's
  `crossover_track`)
- Cohort overlay (L2 envelopes + candidates from Inversion Atlas)

Mirrors the Inversion Atlas scrubber width so the two atlases can be
stacked.

## Architecture

Round-1 scaffold spec. Lifecycle skeleton in place; renderer hook
(`refreshPage3`) is a no-op pending phase B.

| file        | role                              |
|-------------|-----------------------------------|
| `_state.js` | `_pageState` handle               |

Phase B introduces:
- `_render.js` — per-row canvas painter (gene + repeat + conserved +
  CO + cohort tracks).
- `_picker.js` — `activeChrom` write-through on row click.

## Capabilities

- Length-scaled row per chromosome.
- Per-row stacked sub-tracks (5 + cohort overlay).
- Click row → set `activeChrom` slot (drives page_genes, page_repeats_te,
  page_synteny).
- Click CO sub-track → pivot to meiosis-atlas `page_crossovers` for the
  active candidate.

## Required data

- **Registry says (round 1)**: `requires_layers: []`, `requires_slots: []`
- **Future requires_layers**: `chromosome_map`, `gene_track`,
  `repeat_track`, `conserved_elements`, `centromere_telomere`,
  `crossover_track` (cross-atlas)
- **Future requires_slots**: `activeChrom`, `candidate` (cross-atlas)

## User interactions

- Chromosome row click → `activeChrom` set.
- Sub-track click → navigate to consuming page.
- Hover → tooltip with chrom · length · centromere span.

## Outputs

Preview only.

## Connected analyses / adapters

- **IN adapter**: `import_chromosome_map`, `import_gene_track`,
  `import_repeat_track`, `import_conserved_elements`,
  `import_centromere_telomere`.
- **Cross-atlas**: reads `crossover_track` from meiosis-atlas's layer
  registry (see `_migration_note_2026_05_19` in
  [layers.registry.json](../../../../atlases/genome/registries/data/layers.registry.json)).
- **Upstream pipelines**: FAI+AGP, BRAKER/TOGA/RefSeq, RepeatMasker/EDTA,
  Cactus/phastCons, tidk/centromics.

## Status and known issues

- **Phase B not yet shipped**.
- **Cross-atlas dep**: `crossover_track` lives in meiosis-atlas. Renderer
  must handle the layer being absent (meiosis-atlas not built into the
  workspace) — hide the CO sub-track in that case.

## Documents

- **Registry doc**: [pages.registry.json](../../../../atlases/genome/registries/data/pages.registry.json) → `pages.page_chromosome_overview._doc`
- **Spec**: [docs/SPEC_genome_wide_ideogram.md](../../../SPEC_genome_wide_ideogram.md)

**Confidence**: high
