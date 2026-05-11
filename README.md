# genome-atlas

Assembly + annotation lens for the haplotype-resolved F₁ hybrid (*C. gariepinus* × *C. macrocephalus*) reference genome. Companion atlas to `inversion-atlas`, `diversity-atlas`, and `population-atlas`; shares the `atlas-core` engine.

## Layout

```
atlases/genome/                — atlas package (paired with atlas-core)
  manifest.json                — atlas declaration: pages, registries, stages, stylesheet
  pages/
    assembly/                  — page1 scaffold · page2 stats · page3 chromosome overview · page4 methods
    annotation/                — page5 genes · page6 repeats/TE · page7 variant annotations · page8 conserved elements
    comparative/               — page9 synteny · page10 ancestral karyotype
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
# then open http://localhost:8000/#/genome/page1
```

`atlas-core/build/atlas.config` already lists this atlas as `atlas_genome = ../../genome-atlas`.

## Cohort discipline

The Genome Atlas is the **only** of the four atlases that describes the F₁ hybrid (assembly paper cohort). The Inversion / Diversity / Population atlases all describe the 226-sample pure *C. gariepinus* hatchery cohort.

## Status

Round 1 ships ten scaffold pages — HTML fragments + JS lifecycle stubs + layer-status chips. No renderers wired yet; each page documents the data layers it'll consume when its phase ships (B–E).
