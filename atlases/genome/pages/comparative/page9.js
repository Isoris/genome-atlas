// atlases/genome/pages/comparative/page9.js
// =============================================================================
// page9 — Synteny (stage: comparative)
//
// Phase-D target: pairwise ribbon + multi-species ribbon stack + per-chrom
// dotplot. Round-1 scaffold only.
// =============================================================================

import { _pageState, _setActiveState } from './page9/_state.js';

export function renderPage9(/* state */) {
  // No-op. Three views planned (pairwise ribbon, multi-species stack,
  // per-chrom dotplot). Depends on synteny_blocks layer.
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
  _setActiveState(legacyState);
  try { refreshPage9(legacyState); }
  catch (e) { console.warn('page9.mount: refreshPage9 threw —', e); }
  if (atlasState.genome) atlasState.genome._page9State = legacyState;
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}
