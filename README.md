# genome-atlas

Assembly + annotation lens for the haplotype-resolved F₁ hybrid (*C. gariepinus* × *C. macrocephalus*) reference genome. Companion atlas to `inversion-atlas`, `diversity-atlas`, and `population-atlas`; shares the `atlas-core` engine.

## Layout

```
atlases/genome/                — atlas package (paired with atlas-core)
  manifest.json                — atlas declaration: pages, registries, stages, stylesheet
  pages/
    assembly/                  — page_scaffold scaffold · page_assembly_stats stats · page_chromosome_overview chromosome overview · page_assembly_methods methods
    annotation/                — page_genes genes · page_repeats_te repeats/TE · page_variant_annotations variant annotations · page_conserved_elements conserved elements
    comparative/               — page_synteny synteny · page_ancestral_karyotype ancestral karyotype
  registries/data/             — pages / layers / slots / files / operations registries
  css/genome.css               — atlas-wide stylesheet (orange/coral accent)
  shared/, data/               — reserved for phase B+

Genome_atlas.html              — legacy single-file scaffold (kept for reference)
KICKOFF_genome_atlas.md        — round-0 kickoff doc (page list, open questions)
0_READ_ME_FIRST.md             — overview of the four-atlas migration
_handoff_docs/, _tooling/, tests/, legacy/  — convention from inversion-atlas
```

## Build

```sh
# in atlas-core/
bash build/assemble.sh
cd ../atlas-workspace/
bash start.sh
# then open http://localhost:8000/#/genome/page_scaffold
```

`atlas-core/build/atlas.config` already lists this atlas as `atlas_genome = ../../genome-atlas`.

## Cohort discipline

The Genome Atlas is the **only** of the four atlases that describes the F₁ hybrid (assembly paper cohort). The Inversion / Diversity / Population atlases all describe the 226-sample pure *C. gariepinus* hatchery cohort.

## Status

Round 1 ships ten scaffold pages — HTML fragments + JS lifecycle stubs + layer-status chips. No renderers wired yet; each page documents the data layers it'll consume when its phase ships (B–E).
