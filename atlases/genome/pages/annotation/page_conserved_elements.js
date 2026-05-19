// atlases/genome/pages/annotation/page_conserved_elements.js
// =============================================================================
// page_conserved_elements — Conserved elements (stage: annotation)
//
// Phase-C/D target: UCE + phastCons regulatory-disruption overlay per
// candidate. Round-1 scaffold only.
// =============================================================================

import { _pageState, _setActiveState } from './page_conserved_elements/_state.js';

export function renderPage8(/* state */) {
  // No-op. Three views planned (per-chrom strip, per-candidate overlap,
  // phastCons profile). Depends on Cactus alignment outputs.
  return;
}

export const PAGE8_META = {
  id: 'page_conserved_elements',
  stage: 'annotation',
  label: 'conserved elements',
  static: true,
};

export function refreshPage8(state) {
  if (state) _setActiveState(state);
  return renderPage8(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  _setActiveState(legacyState);
  try { refreshPage8(legacyState); }
  catch (e) { console.warn('page_conserved_elements.mount: refreshPage8 threw —', e); }
  if (atlasState.genome) atlasState.genome._page_conserved_elementsState = legacyState;
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}
