// atlases/genome/pages/comparative/page_ancestral_karyotype.js
// =============================================================================
// page_ancestral_karyotype — Ancestral karyotype (stage: comparative)
//
// Phase-D target: ancestral karyotype panel + phylogeny-with-events +
// per-element descent map. Most likely Supplementary Note in the assembly
// paper. Round-1 scaffold only.
// =============================================================================

import { _pageState, _setActiveState } from './page_ancestral_karyotype/_state.js';

export function renderPage10(/* state */) {
  // No-op. Three views planned. Depends on Cactus alignment + phylogeny.
  return;
}

export const PAGE10_META = {
  id: 'page_ancestral_karyotype',
  stage: 'comparative',
  label: 'ancestral karyotype',
  static: true,
};

export function refreshPage10(state) {
  if (state) _setActiveState(state);
  return renderPage10(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  _setActiveState(legacyState);
  try { refreshPage10(legacyState); }
  catch (e) { console.warn('page_ancestral_karyotype.mount: refreshPage10 threw —', e); }
  if (atlasState.genome) atlasState.genome._page_ancestral_karyotypeState = legacyState;
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}
