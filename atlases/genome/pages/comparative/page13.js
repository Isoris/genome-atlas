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
