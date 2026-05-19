# page_scaffold — scaffold / landing — Page Capability Contract

**Atlas**: genome · **Stage**: assembly · **Status**: scaffold (round 1)

## Purpose

Genome Atlas landing page. Declares the atlas's vision, the cluster-side
data layers it commits to, the chromosome-overview mockup, the planned
panel inventory, the phasing roadmap (A → E), and cross-references to the
three sibling atlases (Inversion / Population / Diversity).

Layer-status chips (`[data-ga-layer]`) stay "⚪ not loaded" in round 1 —
they're toggled in later rounds as the real layers land.

## Architecture

Static HTML fragment + thin lifecycle wrapper. Pattern matched to the
Inversion Atlas's `pages/comparative/page_genes` (the canonical "static
HTML, no renderer" template).

Sub-modules:

| file        | role                                              |
|-------------|---------------------------------------------------|
| `_state.js` | `_pageState` + `_setActiveState` setter           |

`mount()` is a true no-op beyond setting `_pageState`; `unmount()`
clears it. Future rounds (phase B+) wire real renderers into
`refreshPage1`.

## Capabilities

- Render the eight `[data-ga-layer]` status chips (round 1: all "⚪
  not loaded").
- Display the chromosome-overview mockup (gradient stand-ins, no real
  density tracks).
- List the planned-panel inventory + phasing roadmap as static prose.

## Required data

- **Registry says**: none (`requires_layers: []`, `requires_slots: []`)
- **Actually consumed**: none — pure declarative HTML

## User interactions

- None in round 1. Phase B turns chips into clickable jump links once
  the chromosome-overview renderer is wired.

## Outputs

None — preview only.

## Connected analyses / adapters

- None in round 1. The eight chip layers (assembly_stats,
  chromosome_map, gene_track, repeat_track, conserved_elements,
  centromere_telomere, synteny_blocks, variant_annotations) all have
  IN/OUT adapters under [`atlases/genome/registries/`](../../../../atlases/genome/registries/)
  but their files don't ship yet.

## Status and known issues

- **Round-1 scaffold**: `refreshPage1` is a no-op. Phase B wires
  `chromosome_map` + `gene_track` + `repeat_track` for the
  chromosome-overview mockup replacement.
- No registry mismatches.

## Documents

- **Registry doc**: [pages.registry.json](../../../../atlases/genome/registries/data/pages.registry.json) → `pages.page_scaffold._doc`
- **Spec**: [docs/SPEC_genome_wide_ideogram.md](../../../SPEC_genome_wide_ideogram.md)
- **Kickoff**: [KICKOFF_genome_atlas.md](../../../../KICKOFF_genome_atlas.md)
- **Legacy source**: `legacy/Genome_atlas.html` lines 199-473

**Confidence**: high
