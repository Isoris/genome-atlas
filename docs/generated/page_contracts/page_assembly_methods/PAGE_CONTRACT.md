# page_assembly_methods — assembly methods walkthrough — Page Capability Contract

**Atlas**: genome · **Stage**: assembly · **Status**: documentation (final shape)

## Purpose

Pure documentation page describing the HiFi + Hi-C + ONT haplotype-
resolved assembly pipeline. Five stages from raw reads to curated
FAI + AGP. No data layers, no renderer. Ships round 1 in its final
shape; no phase B/C upgrade planned beyond text edits.

## Architecture

Static HTML fragment. Same pattern as `page_scaffold`.

| file        | role                              |
|-------------|-----------------------------------|
| `_state.js` | `_pageState` handle (no-op)       |

## Capabilities

- Render the 5-stage pipeline walkthrough.
- Render figures (Hi-C contact map, ONT bridging diagram, …) as static
  SVG / inline images.

## Required data

- **Registry says**: `requires_layers: []`, `requires_slots: []`
- **Actually consumed**: none

## User interactions

- None.

## Outputs

None — read-only documentation.

## Connected analyses / adapters

- None. Documentation page.

## Status and known issues

- Final shape. Future edits are content-only.

## Documents

- **Registry doc**: [pages.registry.json](../../../../atlases/genome/registries/data/pages.registry.json) → `pages.page_assembly_methods._doc`

**Confidence**: high
