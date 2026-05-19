// atlases/genome/pages/comparative/page13.js
// =============================================================================
// page13 — Orthologues, focal vs. non-focal (stage: comparative)
//
// Three tables: summary (one row per non-focal genome), per-focal-chrom
// breakdown (%1:1 conservation), gene-level explorer (filterable, paginated).
//
// Focal genome is selectable; the selector reads/writes shared.focalGenome
// so page9's Oxford-grid row axis stays in sync. The gene-level filter
// runs over the rows currently in the DOM (round 1) — phase D swaps in
// the lazy-loaded per-pair fetch.
// =============================================================================

import { _pageState, _setActiveState } from './page13/_state.js';

export function renderPage13(/* state */) {
  // No-op. Phase D fetches data/comparative/orthologs/<focal>.json and
  // populates Views 1+2; per-pair files hydrate View 3 column-by-column
  // on reveal. Round 1 ships mock rows in the HTML.
  return;
}

export const PAGE13_META = {
  id: 'page13',
  stage: 'comparative',
  label: 'orthologues',
  static: true,
};

export function refreshPage13(state) {
  if (state) _setActiveState(state);
  return renderPage13(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  legacyState.focalGenome = legacyState.focalGenome || _readSharedFocal(atlasState) || 'cgar';
  _setActiveState(legacyState);
  try { refreshPage13(legacyState); }
  catch (e) { console.warn('page13.mount: refreshPage13 threw —', e); }
  _wireFocalSelector(root, legacyState, atlasState);
  _wireSearchFilter(root, legacyState);
  _applyIncomingFilter(root, legacyState, atlasState);
  if (atlasState.genome) atlasState.genome._page13State = legacyState;
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}

function _readSharedFocal(atlasState) {
  return (atlasState && atlasState.shared && atlasState.shared.focalGenome) || null;
}
function _writeSharedFocal(atlasState, focal) {
  if (!atlasState) return;
  atlasState.shared = atlasState.shared || {};
  atlasState.shared.focalGenome = focal;
}

// Focal-genome dropdown. On change, store on _pageState.focalGenome AND
// on shared.focalGenome so page9's Oxford grid follows.
function _wireFocalSelector(root, state, atlasState) {
  if (!root || !root.querySelector) return;
  const sel = root.querySelector('[data-ga-ortho-focal]');
  if (!sel) return;
  if (state.focalGenome) sel.value = state.focalGenome;
  sel.addEventListener('change', () => {
    state.focalGenome = sel.value;
    _writeSharedFocal(atlasState, sel.value);
    if (typeof console !== 'undefined') {
      console.debug('page13 focal genome →', sel.value);
    }
    // Phase D: fetch data/comparative/orthologs/<focal>.json and refresh
    // Views 1 + 2; View 3's per-pair caches are invalidated.
  });
}

// Read incoming pre-filter slots from shared (set by page9's Oxford-grid
// gestures): drilledChrom (axis click) and drilledPair (cell dblclick or
// the popover "open" link). When present:
//   • Sync focal genome.
//   • Pre-fill the gene-level explorer search box with a chrom prefix
//     (e.g. "CGAR.LG01.") so View 3 narrows to that chrom.
//   • Add data-ga-ortho-highlight = "<nonfocal_id>" on the summary table
//     so a CSS rule can flash the matching row.
// The slot is consumed (cleared) after applying so a later mount won't
// re-apply stale state.
function _applyIncomingFilter(root, state, atlasState) {
  const shared = (atlasState && atlasState.shared) || {};
  const dc = shared.drilledChrom;
  const dp = shared.drilledPair;
  if (!dc && !dp) return;

  const chrom = (dc && dc.chrom_id) || (dp && dp.chrom_a);
  const focal = (dc && dc.genome_id) || (dp && dp.a_id);
  const nonFocal = dp && dp.b_id;

  if (focal) {
    state.focalGenome = focal;
    const sel = root.querySelector('[data-ga-ortho-focal]');
    if (sel) sel.value = focal;
  }
  if (chrom) {
    const prefix = (focal ? focal.toUpperCase() : '') + '.' + chrom + '.';
    const input = root.querySelector('[data-ga-ortho-search]');
    if (input) {
      input.value = prefix;
      input.dispatchEvent(new Event('input'));
    }
  }
  if (nonFocal) {
    const summary = root.querySelector('.ga-ortho-summary');
    if (summary) {
      summary.setAttribute('data-ga-ortho-highlight', nonFocal);
      // Phase-D will stamp data-ga-ortho-id="<nonfocal>" on each summary
      // row; here we tag the matching row with .ga-ortho-flash to trigger
      // the one-shot fade. In round 1 the mock rows carry no id, so this
      // is a no-op on the spec page — kept here so the wiring is in place.
      const match = summary.querySelector('.ga-ortho-summary-row[data-ga-ortho-id="' + nonFocal + '"]');
      if (match) {
        match.classList.add('ga-ortho-flash');
        setTimeout(() => match.classList.remove('ga-ortho-flash'), 1600);
      }
    }
  }

  // Consume — don't replay on next mount.
  if (atlasState && atlasState.shared) {
    delete atlasState.shared.drilledChrom;
    delete atlasState.shared.drilledPair;
    delete atlasState.shared.pendingPage;
  }
  if (typeof console !== 'undefined') {
    console.debug('page13 incoming filter applied', { focal: focal, chrom: chrom, nonFocal: nonFocal });
  }
}

// View 3 filter input. Round-1 implementation walks the rows currently
// in the DOM and toggles a hidden class. Updates the count chip.
function _wireSearchFilter(root, state) {
  if (!root || !root.querySelectorAll) return;
  const input = root.querySelector('[data-ga-ortho-search]');
  const count = root.querySelector('[data-ga-ortho-count]');
  const rows = root.querySelectorAll('.ga-ortho-genes-row');
  if (!input || !rows.length) return;

  const total = rows.length;
  const apply = () => {
    const q = (input.value || '').trim().toLowerCase();
    let shown = 0;
    rows.forEach((row) => {
      const txt = row.textContent.toLowerCase();
      const hit = q === '' || txt.indexOf(q) !== -1;
      row.style.display = hit ? '' : 'none';
      if (hit) shown += 1;
    });
    if (count) count.textContent = 'showing ' + shown + ' / ' + total;
  };
  input.addEventListener('input', apply);
}
