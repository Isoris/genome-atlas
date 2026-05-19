# 🟢 KICKOFF — Meiosis Atlas migration

**Date:** 2026-05-19
**Atlas ID (proposed):** `meiosis`
**Repo (proposed):** `meiosis-atlas`
**Cohort:** F₁×F₁ progeny (pedigree-derived CO / NCO calls)
**Status:** No migration yet. Round 0 / scoping. The source pages
already exist (inside genome-atlas, see §"What exists today");
this kickoff hands a fresh agent the carve-out plan.

---

## TL;DR

Two finished spec pages currently parked in **genome-atlas** under
`atlases/genome/pages/annotation/` are being carved out into their
own atlas:

- `page_crossovers` — per-inversion-candidate CO ideogram +
  telomere-bias curve + optional PRDM9 motif logo
- `page_nco_gc` — sister page; NCO + gene-conversion tracts on the
  same candidate, same per-candidate keying

The carve-out is driven by **cohort discipline**: these pages run
on the F₁×F₁ progeny cohort (a pedigree's worth of meiosis events),
not the F₁ hybrid cohort that the rest of the genome-atlas
describes. Per ADR-14-style "one atlas per cohort," they belong in
a separate repo.

**Scope is locked at two pages.** No genome-wide recombination
landscape, no sex-specific recombination map, no hotspot catalogue.
Catfish data doesn't support those views (no high-density linkage
map; sex-specific rates aren't reliably estimable from the F₁×F₁
pedigree). The atlas is small, focused, and tied to specific
inversion candidates via `shared.candidate`.

---

## What exists today

In **genome-atlas**, on branch `claude/crossover-page-json-plot-mTlJh`
(commits `b4eb9ce` → `f27aebc`), six files implement the two pages
plus their fixtures and registry entries:

```
atlases/genome/
├── pages/annotation/
│   ├── page_crossovers.html              ← 328 lines, three-view spec
│   ├── page_crossovers.js                ← module stub (mount/unmount)
│   ├── page_crossovers/_state.js         ← page-private _pageState
│   ├── page_nco_gc.html                  ← 249 lines, two-view spec
│   ├── page_nco_gc.js                    ← module stub
│   └── page_nco_gc/_state.js             ← page-private _pageState
├── fixtures/
│   ├── crossovers/cgar_inv_example_01.json   ← schema-valid example
│   └── nco_gc/cgar_inv_example_01.json       ← shares candidate_id
└── registries/data/
    └── layers.registry.json              ← declares 3 layers (see §"Layers")
```

Both pages already:
- Carry their full JSON-Schema contract inline in a
  `<pre class="ga-schema-block">` element (the spec IS the contract)
- Reference each other as sister pages
- Cross-reference the Inversion Atlas (`shared.candidate` provenance)
- Use the `--ga-chrom-*` palette tokens (atlas-wide, defined in
  `atlases/genome/css/genome.css`)

The fixtures share `candidate_id = "cgar_inv_example_01"` and the
same `candidate_span` so the two pages stack visually on one
candidate. The crossover fixture has a populated 15-position PRDM9
PWM so View 3 renders, not just placeholders.

---

## Why migrate this out of genome-atlas

Three reasons, in order of importance:

1. **Cohort discipline** — the genome-atlas describes the F₁ hybrid
   (one organism, one assembly QC story). The CO/NCO calls come
   from pedigree analysis of the F₁×F₁ progeny (an arbitrary
   number of organisms, dozens of meioses). Same chromosome
   coordinate system, but a different scientific story and a
   different cohort. The genome-atlas kickoff explicitly forbids
   mixing cohorts in one atlas (§"Three-cohort discipline").

2. **Reader model** — readers landing in genome-atlas expect "tell
   me about this assembly." Readers landing in meiosis-atlas
   expect "tell me about recombination in this candidate." Same
   inversion candidate, different lens. Two atlases = two coherent
   reader paths.

3. **Future growth without bloat** — keeping the meiosis pages
   under `annotation` worked when there were two of them. If a
   future round adds, e.g., a recombination-vs-divergence overlay
   or a chiasma-interference plot, those would also belong with
   the meiosis pages, not with gene tracks. A dedicated atlas
   makes that growth low-cost.

---

## Scope decisions (locked)

These were decided in chat on 2026-05-19. The new agent does **not**
need to re-litigate them:

| Page | In/Out | Why |
|---|---|---|
| `page_crossovers`              | **IN**  | Already built, migrates as-is |
| `page_nco_gc`                  | **IN**  | Already built, migrates as-is |
| `page_recombination_landscape` | **OUT** | Genome-wide cM/Mb map. Not estimable in catfish without a dense linkage map; the F₁×F₁ pedigree gives candidate-scoped rates only |
| `page_sex_specific_recombination` | **OUT** | Female:male heterochiasmy. Currently surfaced *per candidate* on page_crossovers (red ♀ / blue ♂ dots); a genome-wide version isn't reliable from this pedigree |
| `page_hotspot_catalogue`       | **OUT** | A catfish-wide PRDM9 hotspot catalogue would need genome-wide hotspot calls — not in the pipeline |
| `page_pedigree_qc`             | **OUT** | Out of scope for round 1; can be added later if the pedigree QC story needs its own page |
| `page_meiosis_methods`         | **OUT** | Same — defer until round 2 |

Result: **the round-1 meiosis-atlas ships two pages, one stage.**
That's small, but it's a complete unit (the two pages are
self-consistent and reference each other; nothing dangles).

---

## What gets MOVED out of genome-atlas

A single mechanical sweep. Every path below is `git mv`-able as-is
into the new repo at the mirrored path under `atlases/meiosis/`:

| genome-atlas path | new path in meiosis-atlas |
|---|---|
| `atlases/genome/pages/annotation/page_crossovers.html`    | `atlases/meiosis/pages/recombination/page_crossovers.html` |
| `atlases/genome/pages/annotation/page_crossovers.js`      | `atlases/meiosis/pages/recombination/page_crossovers.js` |
| `atlases/genome/pages/annotation/page_crossovers/_state.js` | `atlases/meiosis/pages/recombination/page_crossovers/_state.js` |
| `atlases/genome/pages/annotation/page_nco_gc.html`        | `atlases/meiosis/pages/recombination/page_nco_gc.html` |
| `atlases/genome/pages/annotation/page_nco_gc.js`          | `atlases/meiosis/pages/recombination/page_nco_gc.js` |
| `atlases/genome/pages/annotation/page_nco_gc/_state.js`   | `atlases/meiosis/pages/recombination/page_nco_gc/_state.js` |
| `atlases/genome/fixtures/crossovers/cgar_inv_example_01.json` | `atlases/meiosis/fixtures/crossovers/cgar_inv_example_01.json` |
| `atlases/genome/fixtures/nco_gc/cgar_inv_example_01.json`     | `atlases/meiosis/fixtures/nco_gc/cgar_inv_example_01.json` |

Stage name suggestion: **`recombination`** (only one stage; could
also be the literal `meiosis` if you prefer the atlas-id repeated).

After moving, run the same text-substitution sweep the genome-atlas
rename used (commit `a7a0b1b` on the source branch shows the
pattern): rewrite `atlases/genome/` → `atlases/meiosis/` inside the
page HTML/JS/JSON, and `stage: annotation` → `stage: recombination`
in the manifest entries.

---

## Layers to move (registries)

Three layer-registry entries to lift from
`atlases/genome/registries/data/layers.registry.json`:

- `crossover_track` — per-candidate CO events + telomere curve
- `nco_gc_track` — per-candidate NCO + GC tracts + curves
- `prdm9_motif` — optional PWM block (lives on `crossover_track`'s
  page but as its own layer because it can be absent)

The contracts for these are duplicated in the spec pages
themselves (in the inline `ga-schema-block`), so the registry
entry is the *declaration of existence*, not the source of truth.
Carry it over verbatim.

No other registries (files, operations, pages, slots) need new
entries beyond the boilerplate for "two pages, one stage."

---

## What gets COPIED (not moved) — shared scaffolding

These are atlas-wide concerns the meiosis-atlas needs but can't
"take" from the genome-atlas (the genome-atlas needs them too):

| Thing | Action |
|---|---|
| Chromosome palette (`--ga-chrom-1`…`--ga-chrom-13` + `--ga-chrom-fused`, the 14 utility classes, the `--ga-chrom-sat`/`--ga-chrom-light` building blocks) | **Promote to atlas-core** (preferred) so all four atlases share one source of truth — `atlas-core/css/chrom-palette.css`. Fallback: copy verbatim into `atlases/meiosis/css/meiosis.css` and accept the drift risk. The genome-atlas defines them in `atlases/genome/css/genome.css` lines 67-101 (round-1 branch). |
| `.ga-card`, `.ga-content`, `.ga-title`, `.ga-card-status`, etc. — the page-section primitives | Same: promote to atlas-core or copy. The meiosis-atlas pages reference these classes throughout. |
| `_partials/_chrom-palette-swatches.html` reference partial + `.ga-chrom-palette-frame` iframe wrapper | Copy if you want the swatch reference embedded on the meiosis pages (probably not — they only need a couple of chrom colours, not the full palette). |
| Fixtures/data dir convention (gitignored `data/` for cluster rsyncs; committed `fixtures/`) | Copy the convention; replicate `atlases/meiosis/data/.gitkeep` + `.gitignore` rule. See genome-atlas's `fixtures/README.md` for the rationale + ASCII data-flow diagram. |

If you go the atlas-core route, the genome-atlas should be updated
in the same round to consume the shared file — keep one source of
truth, not two.

---

## Cross-atlas contracts the meiosis-atlas inherits

Two contracts the new atlas reads but doesn't define:

1. **`shared.candidate` slot** — read from the Inversion Atlas's
   `candidates_registry`. Both meiosis pages key off this. The
   slot wiring is unchanged from the genome-atlas; the meiosis-
   atlas just needs to declare it as a `scope: shared` slot in
   its `slots.registry.json` so the shell knows to forward
   updates. Example shape lives at
   `atlases/genome/registries/data/slots.registry.json` (carry
   the structure verbatim; `activeHaplotype` is genome-private
   and stays behind).

2. **Chromosome coordinate system** — chrom ids like `LG28`,
   `cgar_inv_example_01.json`, etc. come from the genome-atlas's
   assembly. The meiosis-atlas doesn't redefine these; it just
   uses them. No registry entry needed — it's a naming
   convention shared atlas-wide.

---

## What the genome-atlas needs to do after the carve-out

A separate, smaller change in **genome-atlas**:

1. Remove the two pages from `atlases/genome/manifest.json#pages`
   (delete the `page_crossovers` + `page_nco_gc` entries)
2. Remove the 6 files + 2 fixtures (the §"What gets MOVED" table)
3. Remove `crossover_track`, `nco_gc_track`, `prdm9_motif` from
   `atlases/genome/registries/data/layers.registry.json`
4. Update `atlases/genome/fixtures/README.md` to drop those two
   rows from the table (and the cross-check note about the shared
   `candidate_id`)
5. Find any cross-references to `page_crossovers` / `page_nco_gc`
   elsewhere in the genome-atlas (likely in `page_chromosome_overview.html`
   and `page_repeats_te.html`'s "Cross-references" cards) and
   rewrite them to point at the new meiosis-atlas
6. Drop a one-paragraph pointer in `KICKOFF_genome_atlas.md`
   explaining that the meiosis pages moved (so future readers
   don't go looking for them)
7. Leave the `--ga-chrom-*` palette in place — the genome-atlas
   still uses it (see commit `e102d67`)

This is mechanical. Do it in the same round as the carve-out so
the two atlases land in a consistent state.

---

## Round-1 plan for the next agent

### Round 0 (this kickoff)
- Read this file.
- Confirm answers to the §"Open questions" below.
- Schedule round 1.

### Round 1 — skeleton + the two pages

1. **Create the new repo.** Name: `meiosis-atlas` (proposed; see
   open question #1). Same org as `genome-atlas` /
   `inversion-atlas`.

2. **Mirror the genome-atlas skeleton.** Copy:
   - Top-level `.gitignore`, `README.md` skeleton, `0_READ_ME_FIRST.md` template
   - `atlases/meiosis/` directory structure: `pages/`, `css/`, `data/` (with `.gitkeep`), `fixtures/`, `registries/data/`, `shared/`, `_partials/`
   - The `manifest.json` shape (atlas_id, atlas_name, pages, registries, shared_modules, stages — see `atlases/genome/manifest.json` for layout)

3. **Carry over the six page files + two fixtures** per the
   §"What gets MOVED" table. Use `git mv` from a clone of
   genome-atlas's branch `claude/crossover-page-json-plot-mTlJh`
   so file history follows.

4. **Carry over the three layer-registry entries** per §"Layers."

5. **Mint the manifest.** Single stage (`recombination` or
   `meiosis`); two pages. Both keyed by `shared.candidate`.
   Both phase C+ (matches genome-atlas tags).

6. **Wire shared scaffolding** (chrom palette + .ga-card etc.) —
   pick a path per the §"What gets COPIED" table. If you go the
   atlas-core route, do that work in a parallel PR against
   atlas-core.

7. **Substitution sweep**: `atlases/genome/` → `atlases/meiosis/`
   inside the moved files; `stage: "annotation"` → the new stage
   name; "Genome Atlas" → "Meiosis Atlas" where it's a self-
   reference (NOT in cross-references — page_synteny, page_orthologues
   etc. still live in genome-atlas).

8. **Standalone smoke test**: open each page HTML directly in a
   browser. The pages have no JS deps, so they should render the
   spec text + the chrom-palette utility classes correctly with
   only the meiosis.css stylesheet loaded.

9. **Land the genome-atlas carve-out PR** in parallel (the 7
   steps in §"What the genome-atlas needs to do"). Coordinate so
   both PRs merge together; no orphan cross-references.

### Round 2+

Out of scope for this kickoff. If/when a `page_pedigree_qc` or
`page_meiosis_methods` is wanted, design that in a new round and
add it under the same `recombination` stage (or a sibling stage,
e.g. `methods` if it grows).

---

## Reference: source-of-truth pointers

When the new agent needs to look something up:

- **The two page HTML files** are the contract. JSON-Schema is
  inline in each `<pre class="ga-schema-block">`; everything else
  is mockup + prose.
- **`atlases/genome/manifest.json`** — pattern for the new
  meiosis manifest. Same shape, smaller (one stage, two pages).
- **`atlases/genome/registries/data/*.registry.json`** — pattern
  for the new meiosis registries.
- **`atlases/genome/fixtures/README.md`** — the data/ vs
  fixtures/ split rationale + how to symlink for local dev.
- **`atlases/genome/css/genome.css` lines 46-114** — the chrom
  palette token block (decide whether to copy or promote).
- **Commit `a7a0b1b` on `claude/crossover-page-json-plot-mTlJh`**
  — example of a mechanical multi-file rename done with
  word-boundary regex; reuse the approach for the carve-out
  substitution sweep.

---

## Three-cohort discipline — and the meiosis exception

The four cohorts in this manuscript universe:

- **F₁ hybrid** (*C. gariepinus* × *C. macrocephalus*) — describes
  one organism's haplotype-resolved genome. Owned by **genome-atlas**.
- **226 hatchery** *C. gariepinus* — population-level analyses.
  Owned by **inversion-atlas**, **population-atlas**, **diversity-atlas**.
- **F₁×F₁ progeny** (the F₁ hybrid's offspring; pedigree of ~42
  meioses in the mock fixture) — yields the CO/NCO calls. Owned
  by **meiosis-atlas** (this kickoff).

The discipline is one cohort per atlas, and never mix. The
meiosis-atlas exists precisely because folding the F₁×F₁ pages
into genome-atlas (which describes the F₁ parent) violates that
rule. The carve-out restores discipline.

---

## Open questions for Quentin (must answer before round 1)

### Q1 — repo name

- `meiosis-atlas` — short, parallels `genome-atlas` / `inversion-atlas`
- `catfish-meiosis-atlas` — explicit about species scope
- something else?

### Q2 — atlas_id in manifest

- `meiosis` — matches repo name
- `recombination` — matches the most natural stage name
- pick whichever the manuscript figures will cite by

### Q3 — stage label

- `recombination` (Recommended; describes the biology — CO + NCO
  are recombination outcomes)
- `meiosis` (same as atlas_id; slightly redundant but unambiguous)
- something splittable later (e.g., `co_landscape` + `nco_landscape`
  — over-engineered for two pages)

### Q4 — share `atlas-core` palette + .ga-card via core, or copy?

The genome-atlas's `--ga-chrom-*` palette + `.ga-card` primitives
are used in every page. Two options:

- **Promote to atlas-core** (Recommended) — one source of truth,
  retuning ripples through all four atlases. Slight refactor cost
  in atlas-core; rename `--ga-` prefix to `--core-` or keep `--ga-`
  for back-compat.
- **Copy into meiosis-atlas** — zero coordination, but the
  palette + primitives can drift over time. Acceptable for
  round 1 if atlas-core is read-only this sprint.

### Q5 — meiosis-atlas accent colour

The atlas system uses an accent colour per atlas (`#4fa3ff` for
inversion, `#ff8c6e` / `#e48a3c` for genome). Meiosis needs its
own — proposed: a green or violet, distinct from the existing two.

---

## What round 1 should NOT do

- Don't add `page_recombination_landscape`, `page_sex_specific_*`,
  or `page_hotspot_catalogue` — those are out of scope per the
  locked decisions above.
- Don't try to invent a recombination-rate calculation from the
  per-candidate CO calls. The data flows in from cluster-side
  pre-binned curves; the atlas just renders them.
- Don't refactor the JSON-Schema contracts — they're already in the
  page HTML and have working fixtures. Round 1 is a carve-out, not
  a redesign.
- Don't delete the genome-atlas pages until the meiosis-atlas
  ships and the cross-reference rewrites in genome-atlas land —
  keep both alive for the duration of the migration round so a
  half-merged state doesn't break navigation.

---

## What to do right now

1. Decide on Q1–Q5 (above).
2. Create the `meiosis-atlas` repo.
3. Drop this kickoff into the new repo's root as
   `KICKOFF_meiosis_atlas.md`.
4. Schedule round 1.

Once round 1 lands, drop a pointer back to this kickoff in
`KICKOFF_genome_atlas.md`'s §"What to do right now" so a future
maintainer of genome-atlas knows where the carve-out went.
