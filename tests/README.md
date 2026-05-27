# `tests/` — Genome Atlas smoke tests

Two scripts + one GitHub Actions workflow. The smoke pass runs on every
push to `main` and every PR; blocks merge when an invariant breaks.
Checks #1-#7 are stdlib-only; check #8 needs `jsonschema` from PyPI
(CI installs automatically; locally optional).

```
tests/
  smoke_genome_atlas.py    the 8-check smoke pass (run against the repo)
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
| 8 | Every `(fixture, schema)` pair declared in `tests/fixture_schema_pairs.json` validates | Drift between a fixture and the schema that's supposed to describe it. Catches "edited the schema's `required` but not the fixture" + "edited the fixture but not the schema." Skips silently if `jsonschema` isn't installed. |

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
  [1/8] JSON parse           : 54 files
  [2/8] Manifest paths       : 13 pages
  [3/8] HTML tag balance     : 13 pages
  [4/8] CSS class resolution : 13 pages
  [5/8] Inline schemas       : 6 schema blocks
  [6/8] Python adapters      : 83 files compile
  [7/8] Cross-references     : 25 page refs across 13 pages
  [8/8] Schema validation    : 1 pairs validated
==================================================
PASS — all 8 checks green.
```

Without `jsonschema` installed, check #8 reports `jsonschema not installed (skip)` and the pass still counts as green — the other seven checks still run.

## Adding a fixture / schema pair to check #8

Edit `tests/fixture_schema_pairs.json` and add a new entry to `pairs`. Two binding styles:

```json
{ "fixture": "fixtures/<area>/<file>.json",
  "schema_file": "atlases/genome/registries/schemas/schema_out/<schema>.schema.json" }
```

or, when the schema lives inline in a page (in a `<pre class="ga-schema-block">` block):

```json
{ "fixture": "fixtures/<area>/<file>.json",
  "inline_from_page": "atlases/genome/pages/<stage>/page_<x>.html",
  "schema_index": 0 }
```

`schema_index` is 0-based — most pages have one schema block; pages with multiple (e.g. `page_comparative_te` has one for the consolidated envelope and one for the BED file format) use the index to disambiguate. Code-format blocks that aren't JSON (GFF3, BED) are skipped automatically.

The check will fail the smoke pass if the fixture doesn't validate against the schema. Local test before pushing:

```bash
pip install -r tests/requirements-test.txt   # one-time
python3 tests/smoke_genome_atlas.py
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
  need cross-repo CI, deferred. (In-atlas `<b>page_*</b>` refs ARE
  checked, see #7.)

## Adding a new check

1. Write a `check_<name>(failures, ...) -> int` function in
   `smoke_genome_atlas.py` that appends a `[<name>]` -prefixed string
   to `failures` for each problem and returns a count of items
   inspected.
2. Wire it into `main()` with a new `[9/N]` line.
3. Run locally; confirm it catches a planted regression AND passes on
   clean state.
4. PR it. CI runs the new check on next push.
