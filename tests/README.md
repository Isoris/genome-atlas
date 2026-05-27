# `tests/` — Genome Atlas smoke tests

One Python script + one GitHub Actions workflow. Runs on every push to
`main` and every PR; blocks merge when an invariant breaks. Stdlib-only
(no `pip install`).

## What it checks

| # | Check | Guards against |
|---|---|---|
| 1 | Every `*.json` under `atlases/` + `fixtures/` + `docs/atlas_core_catalogue/` parses | A typo in a registry, manifest, or fixture file. |
| 2 | Every `manifest.json#pages[*].fragment` + `.module` resolves on disk | A page rename / move that left the manifest pointing at a ghost. |
| 3 | Every page HTML parses cleanly (tag depth returns to 0) | The stray `</div>` / `</tbody>` that sneaks in during page edits and breaks rendering. |
| 4 | Every `class="ga-*"` referenced on a page resolves in one of `manifest.json#stylesheets` | New UI primitives added to pages without the matching CSS rule. |
| 5 | Every inline `<pre class="ga-schema-block"><code>{…}</code></pre>` that looks like JSON parses | A schema-block edit that quietly broke the embedded contract. Non-JSON code blocks (GFF3 / BED examples) are detected and skipped. |
| 6 | Every Python adapter under `atlases/genome/registries/{extractors,runners}/` compiles | A syntax error in a Python adapter that wouldn't get caught until someone actually invokes it. |

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
  [1/6] JSON parse           : 39 files
  [2/6] Manifest paths       : 11 pages
  [3/6] HTML tag balance     : 11 pages
  [4/6] CSS class resolution : 11 pages
  [5/6] Inline schemas       : 3 schema blocks
  [6/6] Python adapters      : 65 files compile
==================================================
PASS — all 6 checks green.
```

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
