# 🟢 KICKOFF — Genome Atlas migration

**Date:** 2026-05-07
**Atlas ID (proposed):** `genome`
**Repo (proposed):** `genome-atlas`
**Cohort:** F₁ hybrid (*C. gariepinus* × *C. macrocephalus*) —
**Genome Atlas is the only one of the four that describes the F₁
hybrid**; the assembly paper cohort.
**Status:** No migration yet. Round 0 / scoping.

---

## What exists today

A single-file scaffold HTML:
- `Genome_atlas.html` — ~27 KB. Warm coral palette. Originally
  drafted as "page 14" inside the Inversion Atlas (chat ~Apr 29,
  bundle `atlas_v4_session_apr29.tar.gz`); then split out per
  ADR-14 (late April 2026) so the four atlases would each live in
  their own HTML file.

Cross-links inside the file already point at the other three:
`Inversion_atlas.html`, `Population_atlas.html`,
`Diversity_atlas.html` (rename done in chat 07759823).

Beyond the scaffold, there is **no real content yet** — no page1
through pageN, no per-page modules, no registries, no tests, no
handoff docs.

---

## Why migrate this one first

It's the **smallest** of the three sibling atlases (27 KB scaffold
vs Population's 63 KB scaffold vs Diversity's 2.5 MB single-file).
Almost all of round 1 is **establishing the skeleton**, not
extracting real content. Once the Genome Atlas is at "first page
migrated," the same skeleton works for Population and Diversity
with minimal customization.

In other words: **use the Genome Atlas as the template for the
other two.**

---

## Open questions for Quentin (must answer before round 1)

### Q1 — pages

The Genome Atlas's promise (from the v4 session memory):
*"assembly + annotations lens (chrom assembly stats, synteny /
ancestral karyotype, gene tracks, repeats / TE landscape)."*

Which of these are committed to as **real pages** for the manuscript?
The most plausible page list (your call to confirm):

| # | Page | What it shows | Source data |
|---|---|---|---|
| 1 | `assembly_stats` | Chromosome lengths, gaps, N50, BUSCO per haplotype | F₁ assembly QC outputs |
| 2 | `synteny` | Gar ↔ Mac syntenic blocks; ancestral karyotype reconstruction | `catfish-synteny-toolkit` (wfmash, 9–11 catfish genomes) |
| 3 | `genes` | Gene tracks, density, functional annotation | EDTA / Liftoff / BRAKER / etc. |
| 4 | `repeats_te` | TE density per haplotype (Gar: 28 chroms; Mac: 27) | EDTA outputs (the `data.table::foverlaps` pipeline) |
| 5 | `ancestral_karyotype` | The teleost / siluriform ancestral karyotype panel | the phylogeny/ancestral karyotype module promoted to Supp Note |
| 6 | `assembly_methods` | The haplotype-resolved assembly pipeline (HiFi + Hi-C + ONT) | the assembly methods walkthrough |

Decide: **what's in, what's out, what's the order, what are the
canonical page names.** (The Inversion Atlas equivalent is the
`stages` array in `manifest.json` — see
`inversion-atlas/atlases/inversion/manifest.json`.)

### Q2 — stages

The Inversion Atlas has four stages: `discovery → review →
catalogue → comparative`. The Genome Atlas's stages need to be
something genuinely different, because nothing in the Genome Atlas
is a "candidate to be reviewed."

Likely candidates:
- **`assembly`** (chromosomes, N50, BUSCO, gaps)
- **`annotation`** (genes, repeats, TEs)
- **`comparative`** (synteny, ancestral karyotype) — borrows the
  Inversion Atlas's stage name and that's fine, the concept
  matches.

Decide: 2 stages, 3 stages? What labels?

### Q3 — registries

The Inversion Atlas has five registries: `pages`, `layers`,
`slots`, `files`, `operations`. For the Genome Atlas, all five
are likely needed but the **content** is completely different:
- `layers.registry.json` — what data layers exist
  (`assembly_stats.json`, `synteny_blocks.json`, `gene_track.gff`,
  `te_density.bed`, …).
- `slots.registry.json` — what cross-page state exists
  (`activeHaplotype` = "Gar" | "Mac"; `activeChrom`; ...).
- `files.registry.json` — what files the atlas knows how to load.
- `operations.registry.json` — what derived operations exist.

These can be **stubbed empty in round 1** (just enough for the
engine to boot), and filled in as pages migrate.

Decide: stub-empty in round 1, or design upfront? Defer is fine.

### Q4 — repo location

Two natural homes for the Genome Atlas:

- **(a) Its own repo** `genome-atlas/`, sibling to
  `inversion-atlas/`. Most consistent with the four-repo split
  pattern. Recommended.
- **(b) Inside the existing `catfish-genome-assembly/` repo** as
  a `docs/atlas/` subdir. More aligned with "the genome atlas
  belongs with the assembly paper." Also fine.

Decide: (a) or (b)?

### Q5 — share `atlas-core` or fork?

The clean architectural answer is: **share `atlas-core` across all
four atlases**, with `atlas-core` as its own pinned-version repo.
Each atlas just brings its own `atlases/<id>/` tree.

The risk is that as `atlas-core` evolves to fit the Inversion
Atlas's needs, it may grow features that don't make sense for
Genome / Population / Diversity (and vice versa). If that becomes a
problem, the four atlases can either coordinate on `atlas-core`
together, or fork.

Decide: share for now (recommended) or fork early?

---

## First-round plan (once Q1–Q5 are answered)

### Round 0 (this kickoff)
- ✅ Folder created, scaffold HTML dropped in.
- ✅ This kickoff doc read.
- ⏳ Q1–Q5 answered.

### Round 1 — skeleton + first page
Goal: get `atlas-core` to boot the Genome Atlas with one real
page rendering.

Steps:
1. **Create `genome-atlas/` repo structure** mirroring
   `inversion-atlas/`:
   ```
   genome-atlas/
     atlases/genome/
       manifest.json
       pages/<stage>/
       registries/data/
       shared/
       css/
       server/                       (skip in round 1, stub later)
       analysis/                     (skip in round 1)
       data/                         (skip in round 1)
     tests/
     _tooling/run_migrated_tests.sh
     _handoff_docs/
   ```
2. **Write `manifest.json`** with `atlas_id: "genome"`, the pages
   list from Q1, the stages list from Q2, empty/stub registries
   per Q3.
3. **Carve out one page** from `Genome_atlas.html` into
   `pages/<stage>/page<N>.html` + `page<N>.js` + `page<N>/_state.js`
   following the **page7 template** (the simplest possible
   migrated page in the Inversion Atlas; see references below).
4. **Write the unit test + smoke test** for that page (~15 unit
   assertions, ~25 smoke assertions). Reuse the synthetic-DOM
   helper from `inversion-atlas/tests/smoke_review_page7_round5.mjs`.
5. **Add `_tooling/run_migrated_tests.sh`** with the one page in
   `UNITS` + `SMOKES`.
6. **Verify**: harness passes, single page renders in browser via
   `atlas-core/index.html?atlas=genome`.
7. **Write `HANDOFF_<date>_genome_round1_done.md`** + bump
   `CONTINUE_HERE`.

Estimated time: 1.5–2 hours, because round 1 includes the
one-time skeleton work that subsequent rounds don't redo.

### Round 2+
One page per round, following the Inversion Atlas migration
recipe. Each round ~30–60 min depending on page complexity.

---

## Reference paths in the Inversion Atlas

The Inversion Atlas tree is the canonical template. Specifically:

| What | Where |
|---|---|
| Atlas manifest shape | `inversion-atlas/atlases/inversion/manifest.json` |
| Page registry shape | `inversion-atlas/atlases/inversion/registries/data/pages.registry.json` |
| Simplest possible migrated page (template for Genome Atlas pages without complex renderers) | `inversion-atlas/atlases/inversion/pages/review/page7.{html,js}` + `page7/_state.js` |
| Migrated page WITH a real DOM helper | `inversion-atlas/atlases/inversion/pages/discovery/page15.{html,js}` + `page15/_state.js` |
| Big page with sub-modules | `inversion-atlas/atlases/inversion/pages/discovery/page1.{html,js}` + `page1/_data.js,_state.js,*_panel.js` |
| Unit-test shape | `inversion-atlas/tests/test_review_page7.js` |
| Smoke-test shape (with synthetic DOM + global renderer + counter) | `inversion-atlas/tests/smoke_review_page7_round5.mjs` |
| Test harness | `inversion-atlas/_tooling/run_migrated_tests.sh` |
| Migration recipe | `handoff/PAGE_MIGRATION_RECIPE.md` (the whole file; rounds-5-step-17 + step-18 are the most recent worked examples) |
| Architectural-discipline rule (registry content out-of-scope) | `handoff/HANDOFF_2026-05-07_chat38_round5_step17_done.md` |

---

## What round 1 should NOT do

- **Don't try to migrate all the content at once.** The Genome
  Atlas has the smallest content footprint of the three siblings,
  but the discipline still matters — one page per round.
- **Don't fill in the registries with hypothetical layers/slots.**
  Round 1 stubs them empty; round N adds them as the page that
  needs them lands.
- **Don't decide on the manuscript figure mapping yet.** Which
  Genome Atlas page corresponds to which manuscript figure is a
  late-stage decision (analogous to page renumbering for the
  Inversion Atlas).

---

## Three-cohort discipline

The Genome Atlas describes the **F₁ hybrid** (*C. gariepinus* ×
*C. macrocephalus*). This is **the only one of the four atlases**
that uses the F₁ hybrid cohort. The Inversion / Population /
Diversity atlases all use the 226-sample pure *C. gariepinus*
hatchery cohort.

When the manuscript talks about the Genome Atlas as "Supplementary
Atlas 1" (haplotype-resolved genome as coordinate system), the
F₁-vs-226 distinction is the key reason it's a separate atlas:
the assembly paper's cohort is one thing, the hatchery cohort's
analyses are another, and they should never appear in the same
atlas.

---

## What to do right now

1. Decide on Q1–Q5 (above).
2. Drop `Genome_atlas.html` into `~/Atlas_workspace/genome-atlas/`.
3. Drop this kickoff into the same folder.
4. Schedule round 1.
