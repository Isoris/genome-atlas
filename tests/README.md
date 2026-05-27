# `tests/` — Genome Atlas smoke tests

Two scripts + one GitHub Actions workflow. The smoke pass runs on every
push to `main` and every PR; blocks merge when an invariant breaks.
Stdlib-only (no `pip install`).

```
tests/
  smoke_genome_atlas.py    the 7-check smoke pass (run against the repo)
  test_smoke_checks.py     self-tests for the smoke pass — plant a
                            known regression, run the smoke script in
                            a worktree copy, confirm it surfaces
  README.md                this file
```

## What the smoke pass checks

| # | Check | Guards against |
|---|---|---|
| 1 | Every `*.json` under `atlases/` + `fixtures/` + `docs/atlas_core_catalogue/` parses | A typo in a registry, manifest, or fixture file. |
| 2 | Every `manifest.json#pages[*].fragment` + `.module` resolves on disk | A page rename / move that left the manifest pointing at a ghost. |
| 3 | Every page HTML parses cleanly (tag depth returns to 0) | The stray `</div>` / `</tbody>` that sneaks in during page edits and breaks rendering. |
| 4 | Every `class="ga-*"` referenced on a page resolves in one of `manifest.json#stylesheets` | New UI primitives added to pages without the matching CSS rule. |
| 5 | Every inline `<pre class="ga-schema-block"><code>{…}</code></pre>` that looks like JSON parses | A schema-block edit that quietly broke the embedded contract. Non-JSON code blocks (GFF3 / BED examples) are detected and skipped. |
| 6 | Every Python adapter under `atlases/genome/registries/{extractors,runners}/` compiles | A syntax error in a Python adapter that wouldn't get caught until someone actually invokes it. |
| 7 | Every `<b>page_<topic></b>` mention on a page resolves to a real page in `manifest.json#pages` | A stale "see also" link after a page is renamed / carved out / removed. Cross-atlas refs like `<b>Inversion Atlas page16</b>` are excluded — they reference a different repo and live by a different naming convention. |

## Run locally

From the repo root:

```bash
python3 tests/smoke_genome_atlas.py
```

Exit 0 = all green. Non-zero exit + a numbered failure list otherwise.

Sample output:

```
Genome Atlas smoke tests
==================================================
  [1/7] JSON parse           : 47 files
  [2/7] Manifest paths       : 12 pages
  [3/7] HTML tag balance     : 12 pages
  [4/7] CSS class resolution : 12 pages
  [5/7] Inline schemas       : 5 schema blocks
  [6/7] Python adapters      : 79 files compile
  [7/7] Cross-references     : 22 page refs across 12 pages
==================================================
PASS — all 7 checks green.
```

## Self-tests (`test_smoke_checks.py`)

Verifies the smoke pass itself does what it claims — for each check,
plant a known regression in a `git worktree`-isolated copy of the repo,
run the smoke script in that copy, confirm the failure surfaces with
the expected `[<check>]` prefix.

```bash
python3 tests/test_smoke_checks.py
```

Sample output:

```
Self-tests for tests/smoke_genome_atlas.py
============================================================
  PASS  clean tree → smoke passes
  PASS  plant JSON typo → caught
  PASS  plant ghost manifest entry → caught
  PASS  plant stray </div> → caught
  PASS  plant undefined ga-* class → caught
  PASS  plant schema corruption → caught
  PASS  plant Python syntax error → caught
  PASS  plant stale page_* cross-ref → caught
============================================================
PASS — all 8 self-tests green
```

Each test uses `git worktree add --detach` to get a clean checkout
isolated from the repo's index/working tree; plants the targeted
regression in the worktree copy; runs the worktree's *own* copy of
the smoke script (so `__file__`-relative path discovery sees the
planted change); asserts the right `[<check>]` prefix appears in the
output. Stdlib-only — uses `subprocess` + `tempfile` + `shutil`.

CI runs both `smoke_genome_atlas.py` and `test_smoke_checks.py` so a
regression in either the *checks* or the *code under check* surfaces
on every PR.

## Design notes

- **Cohort-of-pages-agnostic.** The smoke tests read whichever pages
  the manifest happens to list. Adding or removing a page doesn't
  change the script — the checks adapt.
- **No hard-coded layouts.** Stylesheets are pulled from
  `manifest.json#stylesheets`, not hard-coded. JSON files are
  discovered by `rglob('*.json')` under three roots, not enumerated.
- **Self-closing void tags handled correctly.** Python's html.parser
  fires both start AND end events for `<input />`; the tag-depth
  walker overrides `handle_startendtag` to no-op for void tags so
  self-closing forms don't double-count.
- **HTML-entity-aware schema parsing.** Inline `ga-schema-block`
  contents have entities decoded (`&lt;` → `<` etc.) before
  `json.loads` so placeholders like `<hap>` inside descriptions don't
  trip the parser.
- **Stdlib-only.** No `requirements.txt`, no `pip install` step in
  CI. The workflow runs in `~5 s` on a fresh GitHub runner.

## What's NOT checked (and why)

- **Per-page renderer correctness.** The pages are spec scaffolds /
  data-driven views; rendering correctness needs a browser. Out of
  scope for stdlib-only CI.
- **Cross-atlas contract validity.** Pages reference an Inversion Atlas
  / a future cross-species atlas. Validating those references would
  need cross-repo CI, deferred.
- **Schema-vs-fixture conformance.** Each fixture under `fixtures/`
  should validate against the corresponding inline schema, but the
  smoke pass only checks each side parses. A draft-2020-12 validator
  (e.g. `jsonschema` from PyPI) would be the natural next step — see
  the issue tracker.

## Adding a new check

1. Write a `check_<name>(failures, ...) -> int` function in
   `smoke_genome_atlas.py` that appends a `[<name>]` -prefixed string
   to `failures` for each problem and returns a count of items
   inspected.
2. Wire it into `main()` with a new `[7/N]` line.
3. Run locally; confirm it catches a planted regression AND passes on
   clean state.
4. PR it. CI runs the new check on next push.
