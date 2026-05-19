// atlases/genome/pages/comparative/page9.js
// =============================================================================
// page9 — Synteny (stage: comparative)
//
// Phase-D target: pairwise ribbon + multi-species ribbon stack + per-chrom
// dotplot + macrosyntR-style Oxford grid (aggregated chrom-pair view, focal-
// pair toggle, hover tooltip, click-to-zoom, categorical chrom colouring).
// Round-1 scaffold only.
//
// Interactions wired here at mount time:
//   • Oxford-grid focal-pair dropdowns (genome A / genome B) + swap (⇄).
//   • Colour-by dropdown: row chrom (categorical), col chrom (categorical),
//     significance (blue / yellow). Sets data-color-by on the grid; CSS
//     swaps the dot fill via attribute selectors — no JS recompute needed.
//   • Click on any [data-syn] cell → stash {a_id,b_id,chrom_a,chrom_b} in
//     _pageState.drilledPair, update the View 3 badge, scroll the View 3
//     card into view. Phase-D wires the actual dotplot fetch.
// =============================================================================

import { _pageState, _setActiveState } from './page9/_state.js';

export function renderPage9(/* state */) {
  // No-op. Four views planned (pairwise ribbon, multi-species stack,
  // per-chrom dotplot, macrosyntR Oxford grid). Depends on synteny_blocks
  // + synteny_oxford_grid layers.
  return;
}

export const PAGE9_META = {
  id: 'page9',
  stage: 'comparative',
  label: 'synteny',
  static: true,
};

export function refreshPage9(state) {
  if (state) _setActiveState(state);
  return renderPage9(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  legacyState.focalPair = legacyState.focalPair || { a: 'cgar', b: 'cmac' };
  legacyState.colorBy   = legacyState.colorBy   || 'row';
  legacyState.drilledPair = legacyState.drilledPair || null;
  _setActiveState(legacyState);
  try { refreshPage9(legacyState); }
  catch (e) { console.warn('page9.mount: refreshPage9 threw —', e); }
  _wireOxfordToggle(root, legacyState, atlasState, registry);
  _wireColorByToggle(root, legacyState);
  _wireCellClick(root, legacyState, atlasState);
  if (atlasState.genome) atlasState.genome._page9State = legacyState;
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}

// Focal-pair selectors. On change the renderer would fetch
// data/comparative/oxford/<a>_<b>.json; round 1 only logs.
function _wireOxfordToggle(root, state, atlasState, registry) {
  if (!root || !root.querySelectorAll) return;
  const selA = root.querySelector('[data-ga-syn-focal="a"]');
  const selB = root.querySelector('[data-ga-syn-focal="b"]');
  const swap = root.querySelector('[data-ga-syn-swap]');
  if (!selA || !selB) return;

  const onChange = () => _onFocalChange(root, state, selA.value, selB.value, atlasState, registry);
  selA.addEventListener('change', onChange);
  selB.addEventListener('change', onChange);

  if (swap) {
    swap.addEventListener('click', () => {
      const a = selA.value, b = selB.value;
      selA.value = b; selB.value = a;
      onChange();
    });
  }
}

function _onFocalChange(root, state, a, b, atlasState, registry) {
  state.focalPair = { a: a, b: b };
  if (atlasState && atlasState.genome) atlasState.genome._page9FocalPair = state.focalPair;
  if (typeof console !== 'undefined') {
    console.debug('page9 Oxford-grid focal pair →', a, '×', b);
  }
}

// Colour-by selector. Sets data-color-by on the grid; CSS handles the rest
// via [data-color-by="row|col|sig"] attribute selectors. Same attribute is
// read by the legend to swap which legend chip group is visible.
function _wireColorByToggle(root, state) {
  if (!root || !root.querySelector) return;
  const sel = root.querySelector('[data-ga-syn-color]');
  const grid = root.querySelector('.ga-syn-grid');
  const legend = root.querySelector('[data-ga-syn-legend]');
  if (!sel || !grid) return;

  if (state.colorBy) sel.value = state.colorBy;
  const apply = () => {
    const mode = sel.value || 'row';
    state.colorBy = mode;
    grid.setAttribute('data-color-by', mode);
    if (legend) legend.setAttribute('data-color-by', mode);
  };
  sel.addEventListener('change', apply);
  apply();
}

// Click any populated cell → stash the pair and update View 3.
function _wireCellClick(root, state, atlasState) {
  if (!root || !root.querySelector) return;
  const cells = root.querySelector('.ga-syn-cells');
  if (!cells) return;

  cells.addEventListener('click', (ev) => {
    const cell = ev.target && ev.target.closest && ev.target.closest('.ga-syn-cell[data-syn]');
    if (!cell) return;
    const chromA = cell.getAttribute('data-chrom-a') || '';
    const chromB = cell.getAttribute('data-chrom-b') || '';
    const a = state.focalPair && state.focalPair.a;
    const b = state.focalPair && state.focalPair.b;
    state.drilledPair = { a_id: a, b_id: b, chrom_a: chromA, chrom_b: chromB };
    if (atlasState && atlasState.genome) atlasState.genome._page9DrilledPair = state.drilledPair;

    const badge = root.querySelector('[data-ga-syn-drill-pair]');
    if (badge) badge.textContent = `${a}:${chromA} × ${b}:${chromB}`;

    const drillCard = root.querySelector('[data-ga-card="syn-drill"]');
    if (drillCard && drillCard.scrollIntoView) {
      drillCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (typeof console !== 'undefined') {
      console.debug('page9 drilled →', a, chromA, '×', b, chromB);
    }
    // Phase-D: fetch the per-pair synteny_blocks slice + render the dotplot.
  });
}
