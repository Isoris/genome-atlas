# Cross-atlas integration

This doc explains how pages in the Genome Atlas talk to each other — the
**active candidate** and **active chromosome** selection layer.

When the user clicks a per-chromosome QC row on `page_assembly_stats`,
every other chrom-aware page should react: the chromosome strip on
`page_chromosome_overview` should scroll + highlight that chrom, the
per-chrom gene track on `page_genes` should switch to it, the
per-chrom dotplot on `page_synteny` should auto-axis to it, and a small
status chip in the corner of the screen should say which chromosome is
"active". When the user clicks a candidate cargo row on `page_genes`,
similar pages react — the variant impact tally for that candidate
highlights on `page_variant_annotations`, the UCE overlap row on
`page_conserved_elements` highlights, the repeat flank table on
`page_repeats_te` highlights.

This is the *cross-atlas selection layer*. The plumbing lives in
[`atlases/genome/shared/`](../atlases/genome/shared/) and four small
modules carry the whole design.

---

## Architecture

```
                     ┌─────────────────────────┐
                     │  document-level events  │
                     │                         │
   click cargo row ──┼─► ga-cargo-cand-click   │
   click QC row    ──┼─► ga-qc-chrom-click     │
   click strip row ──┼─► ga-strip-chrom-click  │
   click overlap   ──┼─► ga-ce-cand-click      │
   click burden    ──┼─► ga-impact-cand-click  │
                     │                         │
                     └────────────┬────────────┘
                                  │
                       ┌──────────▼──────────┐
                       │  cross-atlas.js     │
                       │  installRouter()    │
                       │                     │
                       │  active candidate ──┼──► onActiveCandidate
                       │  active chrom     ──┼──► onActiveChrom
                       │                     │
                       │  Escape clears      │
                       └──────────┬──────────┘
                                  │
            ┌─────────────────────┴─────────────────────┐
            │                                           │
            ▼                                           ▼
  Per-page subscribers                       active-pill.js
  - applyActiveCandidateHighlight()         (fixed bottom-right
  - applyActiveChromHighlight()              status chip)
  - switch dropdown to active chrom
  - scroll active row into view
```

Four files, all in `atlases/genome/shared/`:

| File | Role |
| --- | --- |
| `candidates.js` | Canonical sample candidate fallback + `resolveCandidates(state)` |
| `cross-atlas.js` | Document-level event router. `installRouter()` (idempotent), `onActiveCandidate`, `onActiveChrom`, `setActiveCandidate`, `clearAll`. Escape clears. |
| `active-pill.js` | Fixed-position status chip in `document.body`, one instance per atlas regardless of how many pages mount. |
| `page-index.js` | Per-page mini-nav inserted at the top of every page root. Static `PAGES` list mirrors `manifest.json`. |

---

## Event vocabulary

Pages emit page-level events on row clicks. The router catches them and
broadcasts a unified pair of subscriber callbacks (`onActiveCandidate`,
`onActiveChrom`) and document events
(`ga-genome-active-candidate`, `ga-genome-active-chrom`) every other
page can listen to.

| Event | Emitted by | Detail | Sets |
| --- | --- | --- | --- |
| `ga-qc-chrom-click` | page_assembly_stats per-chrom QC row | `{ chrom, hap }` | active chrom |
| `ga-strip-chrom-click` | page_chromosome_overview strip row | `{ chrom }` | active chrom |
| `ga-density-chrom-click` | (reserved for page_genes density bar) | `{ chrom }` | active chrom |
| `ga-cargo-cand-click` | page_genes cargo row, page_repeats_te flank row | `{ candidate: { id, chrom, start_bp, end_bp, label } }` | active candidate + active chrom |
| `ga-impact-cand-click` | page_variant_annotations burden row | same | active candidate + active chrom |
| `ga-ce-cand-click` | page_conserved_elements overlap row | same | active candidate + active chrom |

Setting an active candidate **also sets the active chrom** to that
candidate's chromosome — so a candidate click triggers both the
candidate-row highlights and the chrom-row scrolls in one motion.

---

## Per-page integration pattern

Every page that participates does the same three things in `mount()`:

```js
import {
  installRouter as _installCrossAtlasRouter,
  onActiveChrom as _onActiveChrom,
  getActiveChrom as _getActiveChrom,
  onActiveCandidate as _onActiveCandidate,
  getActiveCandidate as _getActiveCandidate,
} from '../../shared/cross-atlas.js';
import { installActivePill as _installActivePill } from '../../shared/active-pill.js';
import { installPageIndex as _installPageIndex } from '../../shared/page-index.js';

export async function mount(root, atlasState, registry) {
  // ... existing mount work ...

  // 1. Install the cross-atlas plumbing. All three are idempotent —
  // safe to call from every page's mount; the second call is a no-op.
  _installCrossAtlasRouter();
  _installActivePill();
  _installPageIndex(root, 'page_<this_id>');

  // 2. Subscribe to whichever channels this page cares about.
  if (root && !root.__gaXxxChromSub) {
    root.__gaXxxChromSub = _onActiveChrom(({ chrom, hap }) => {
      _applyActiveChromHighlight(chrom ? { chrom, hap } : null);
    });
  }
  if (root && !root.__gaXxxCandSub) {
    root.__gaXxxCandSub = _onActiveCandidate(({ candidate }) => {
      _applyActiveCandidateHighlight(candidate);
    });
  }

  // ... rest of mount ...
}

export async function unmount(root) {
  // ... existing teardown ...
  if (root && typeof root.__gaXxxChromSub === 'function') {
    try { root.__gaXxxChromSub(); } catch (_) {}
    root.__gaXxxChromSub = null;
  }
}
```

And on the render path that draws clickable rows:

```js
// Every clickable row carries data-ga-cand-id or data-ga-strip-chrom etc.
for (const r of rows) {
  lines.push(`<tr class="ga-cargo-row" data-ga-cand-id="${r.id}">…</tr>`);
}
slot.innerHTML = lines.join('');

// Idempotent delegation: install once per slot, dispatch the page's
// flavour of the event when a row is clicked.
_wireRowClicks();
_applyActiveCandidateHighlight(_getActiveCandidate());
```

`_wireRowClicks` looks up the full payload (chrom + span) from page
state so the router can update active chrom too:

```js
function _wireRowClicks() {
  const slot = document.getElementById('xxxSlot');
  if (!slot || slot.__gaXxxClicksWired) return;
  slot.addEventListener('click', (ev) => {
    const tr = ev.target.closest('tr[data-ga-cand-id]');
    if (!tr) return;
    const candId = tr.getAttribute('data-ga-cand-id');
    const cand = _state.rows.find((c) => c.candidate_id === candId);
    tr.dispatchEvent(new CustomEvent('ga-cargo-cand-click', {
      bubbles: true,
      detail: { candidate: cand ? { id: candId, chrom: cand.chrom, ... } : { id: candId } },
    }));
  });
  slot.__gaXxxClicksWired = true;
}
```

The `_apply…Highlight` helpers use a single-active invariant via
`classList.toggle`:

```js
function _applyActiveCandidateHighlight(active) {
  const id = active && active.id;
  document.querySelectorAll('tr[data-ga-cand-id]').forEach((tr) => {
    tr.classList.toggle('is-active', id != null && tr.getAttribute('data-ga-cand-id') === id);
  });
}
```

---

## What every page does today

```
                          page-index    router    pill    cand    chrom
                          ──────────    ──────    ────    ────    ─────
assembly
  page_scaffold             ✓             ·         ·       ·       ·
  page_assembly_stats       ✓             ✓         ✓       ·       ✓
  page_chromosome_overview  ✓             ✓         ✓       ·       ✓
  page_assembly_methods     ✓             ·         ·       ·       ·

annotation
  page_genes                ✓             ✓         ✓       ✓       ✓
  page_repeats_te           ✓             ✓         ✓       ✓       ·
  page_variant_annotations  ✓             ✓         ✓       ✓       ·
  page_conserved_elements   ✓             ✓         ✓       ✓       ·

comparative
  page_synteny              ✓             ✓         ✓       ·       ✓
  page_haplotype_synteny    ✓             ✓         ✓       ·       ✓
  page_ancestral_karyotype  ✓             ·         ·       ·       ·
  page_orthologues          ✓             ·         ·       ·       ·
  page_comparative_te       ✓             ·         ·       ·       ·
```

`✓` = mounted on this page  ·  `·` = not applicable (doc page or not yet
candidate/chrom-aware).

---

## Adding a new page

1. Drop the fragment HTML at `atlases/genome/pages/<stage>/page_<topic>.html`,
   the module at `page_<topic>.js`, and the state stub at
   `page_<topic>/_state.js`.
2. Register in `manifest.json#pages` with `id`, `label`, `stage`,
   `fragment`, `module`, `tooltip`.
3. **Register in `shared/page-index.js`** — add a row to the `PAGES`
   constant with the same `id`, the stage, the label, and the
   capabilities the page will eventually have (`['static']`,
   `['cand']`, `['chrom']`, `['cand', 'chrom']`).
4. If the page participates in the selection loop, follow the
   integration pattern above.

---

## Adding a new event type

If a new page introduces a clickable row that should set the active
candidate or chrom, **prefer reusing the existing event vocabulary**.
The router's `installRouter()` listens for the six events in the table
above; reusing one means no router change.

If a genuinely new channel is needed:

1. Add the listener in
   [`shared/cross-atlas.js#installRouter`](../atlases/genome/shared/cross-atlas.js).
2. Document the event in the **Event vocabulary** table above.
3. Add a router-test case to
   [`test/cross-atlas.test.js`](../test/cross-atlas.test.js) that
   dispatches the new event and asserts the right slot updates.

---

## Tests

Run the headless test suite:

```sh
node test/run.js
```

23 cases across 4 suites cover the shared modules:

```
▸ active-pill.test.js     idempotent install · hidden in neutral state ·
                          renders candidate id + chrom · close button clears ·
                          chrom-only event renders chrom badge alone
▸ candidates.test.js      fallback shape · default resolves to fallback ·
                          shared.candidates wins · empty array falls back
▸ cross-atlas.test.js     candidate event sets both slots · chrom event
                          preserves candidate · subscribers fire ·
                          installRouter idempotent · Escape clears ·
                          Escape from <input> ignored · clearAll dispatches
                          document events
▸ page-index.test.js      stage groups + chips build · active chip marked ·
                          idempotent install · capability badges align ·
                          insertion order · anchor hrefs · 13-page count
```

Individual page modules can't be imported by the headless runner
because they pull `core/mode_b_badge.js` from the sibling `atlas-core`
repo. Page wiring is verified by:

- `node --check` syntax pass on every touched module.
- The shared-module tests cover the integration surface — once a page
  follows the integration pattern, the router-side behaviour is
  guaranteed by the test suite.
- Reading the diff for each per-page commit. The pattern is small and
  repeats verbatim; deviations stand out.

---

## Future hooks

The router re-broadcasts every state change as a document-level event:

```js
document.addEventListener('ga-genome-active-candidate', (ev) => {
  // ev.detail.candidate
});
document.addEventListener('ga-genome-active-chrom', (ev) => {
  // ev.detail.chrom · ev.detail.hap
});
```

This is the hook the **Inversion Atlas web shell** can use to follow
the Genome Atlas's selection — when the user clicks a Genome Atlas
candidate, the shell can navigate Inversion Atlas to the matching
candidate page automatically. No additional Genome-Atlas code needed;
the document events are already firing.

The reverse direction (Inversion Atlas selection drives Genome Atlas
highlighting) is just `setActiveCandidate({ id, chrom, ... }, 'inversion-atlas:nav')`
called from wherever the shell receives Inversion-Atlas events.

---

## Files

```
atlases/genome/shared/
  candidates.js          26 LOC — canonical fallback + resolver
  cross-atlas.js        163 LOC — router + subscribers + Escape + clearAll
  active-pill.js         91 LOC — bottom-right status chip
  page-index.js         108 LOC — per-page mini-nav
atlases/genome/css/genome.css   +203 LOC for .ga-page-index-* +
                                .ga-active-pill-* + .ga-table tr.is-active
                                + .ga-chromov-svg g.is-active
test/
  _dom-stub.js          187 LOC — minimal DOM (element tree, classList,
                                event bubbling, compound selectors)
  _assert.js             24 LOC — test() + assert/assertEq/assertContains
  run.js                 71 LOC — zero-framework runner
  README.md             ~80 LOC — how to run + extend
  active-pill.test.js   5 cases
  candidates.test.js    4 cases
  cross-atlas.test.js   7 cases
  page-index.test.js    7 cases
```

---

## See also

- [`atlases/genome/REGISTRY_GUIDE.md`](../atlases/genome/REGISTRY_GUIDE.md) —
  how layers / actions / extractors / runners / schemas fit together.
- [`atlases/genome/manifest.json`](../atlases/genome/manifest.json) —
  source of truth for the page list; `shared/page-index.js#PAGES`
  mirrors it.
- [`test/README.md`](../test/README.md) — running and extending the
  headless test suite.
