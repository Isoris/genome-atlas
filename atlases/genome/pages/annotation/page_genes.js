// atlases/genome/pages/annotation/page_genes.js
// =============================================================================
// page_genes — Genes (stage: annotation)
//
// Three views planned: genome-wide gene density, per-chromosome gene track,
// gene cargo per inversion candidate. Round-1 scaffold only.
// =============================================================================

import { _pageState, _setActiveState } from './page_genes/_state.js';

export function renderPage5(/* state */) {
  // No-op. Phase B wires views 1+2 (density + track); phase C wires view 3
  // (cargo per candidate via shared.candidateList).
  return;
}

export const PAGE5_META = {
  id: 'page_genes',
  stage: 'annotation',
  label: 'genes',
  static: true,
};

export function refreshPage5(state) {
  if (state) _setActiveState(state);
  return renderPage5(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  _setActiveState(legacyState);
  try { refreshPage5(legacyState); }
  catch (e) { console.warn('page_genes.mount: refreshPage5 threw —', e); }
  if (atlasState.genome) atlasState.genome._page_genesState = legacyState;
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}
