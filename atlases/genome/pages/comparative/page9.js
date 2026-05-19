// atlases/genome/pages/comparative/page9.js
// =============================================================================
// page9 — Synteny (stage: comparative)
//
// Phase-D target: pairwise ribbon + multi-species ribbon stack + per-chrom
// dotplot + macrosyntR-style Oxford grid (aggregated chrom-pair view, focal-
// pair toggle, hover tooltip). Round-1 scaffold only.
//
// The Oxford-grid focal-pair toggle is wired here at mount time — the
// dropdowns + swap button update _pageState.focalPair without forcing the
// renderer to be live (so the spec page still works when the renderer is a
// no-op). The hover tooltip is delegated and reads the cell's title= attr
// in round 1; phase-D swaps that for a richer surface.
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
  _setActiveState(legacyState);
  try { refreshPage9(legacyState); }
  catch (e) { console.warn('page9.mount: refreshPage9 threw —', e); }
  _wireOxfordToggle(root, legacyState, atlasState, registry);
  if (atlasState.genome) atlasState.genome._page9State = legacyState;
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}

// Wire the Oxford-grid focal-pair selectors. On change, the renderer would
// fetch data/comparative/oxford/<a>_<b>.json — round 1 only updates state
// and emits a debug log; phase D replaces the body of _onFocalChange with
// the real fetch + re-render.
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
  // Phase-D: fetch data/comparative/oxford/<a>_<b>.json, then re-render the
  // grid. For now, just log so the toggle is observably wired.
  if (typeof console !== 'undefined') {
    console.debug('page9 Oxford-grid focal pair →', a, '×', b);
  }
}
