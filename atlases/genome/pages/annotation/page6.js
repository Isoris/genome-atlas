// atlases/genome/pages/annotation/page6.js
// =============================================================================
// page6 — Repeats / TE landscape (stage: annotation)
//
// Three views planned: per-class composition, per-chrom density heatmap,
// breakpoint enrichment per inversion candidate (Spalax focal-vs-bg). Round 1
// scaffold only.
// =============================================================================

import { _pageState, _setActiveState } from './page6/_state.js';

export function renderPage6(/* state */) {
  // No-op. Phase B wires composition + density heatmap; the breakpoint
  // enrichment view depends on shared.candidateList from the Inversion Atlas.
  return;
}

export const PAGE6_META = {
  id: 'page6',
  stage: 'annotation',
  label: 'repeats / TE',
  static: true,
};

export function refreshPage6(state) {
  if (state) _setActiveState(state);
  return renderPage6(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  _setActiveState(legacyState);
  try { refreshPage6(legacyState); }
  catch (e) { console.warn('page6.mount: refreshPage6 threw —', e); }
  if (atlasState.genome) atlasState.genome._page6State = legacyState;
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}
