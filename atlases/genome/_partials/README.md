# `_partials/` — reusable HTML fragments

Small, self-contained HTML files that one or more spec pages want to
embed. Files in this directory are prefixed with `_` to signal "fragment,
not a routable page" — the shell's page registry should never list them
in `manifest.json#pages`.

This repo has no template engine, so "include" means one of:

1. **Iframe.** Each partial is a complete HTML document (with its own
   `<link rel="stylesheet">`) so it renders correctly when embedded as
   an `<iframe>` from a spec page. This is the recommended default —
   the partial is fully isolated and the spec page doesn't need to
   carry the partial's markup.

2. **Copy-paste.** If the partial has a clearly marked `<section>` body,
   spec authors can copy that section directly into their page. The
   `.ga-*` utility classes referenced by the partial are atlas-wide, so
   the pasted copy renders identically wherever it lands.

3. **Standalone view.** Every partial works when opened directly in a
   browser — useful when an author just wants a quick visual reference
   without spinning up the shell.

## Contents

| Partial | What it shows | Used by |
|---|---|---|
| `_chrom-palette-swatches.html` | All 14 `--ga-chrom-*` palette tokens with utility-class names + hue degrees. Visual key for the chromosome palette tokens defined in `genome.css`. | Reference; spec authors can embed via `<iframe class="ga-chrom-palette-frame">` when a page benefits from a colour key (e.g. page_synteny, page_ancestral_karyotype, page_orthologues). |

## Adding a partial

1. Create `atlases/genome/_partials/_<name>.html` — leading underscore
   on the filename.
2. Make it a full HTML document with a `<link rel="stylesheet"
   href="../css/genome.css" />` so iframe + standalone modes both work.
3. Scope any partial-only styles to a wrapper class (e.g.
   `.ga-<name>-sheet`) to keep them out of the page-author's namespace.
4. Add a row to the table above with a one-liner saying what it is and
   who uses it.
5. If the partial needs an iframe-wrapper rule (sizing / border
   defaults), add a `.ga-<name>-frame` class to `genome.css`.

## Why not a JS include helper?

A `<script>` that fetches and injects the partial would work, but adds
runtime cost + a load-order dependency for what's almost always a
mostly-decorative reference panel. Iframes give the same isolation with
zero JS and zero ordering risk; copy-paste is even cheaper when the
fragment is short.
