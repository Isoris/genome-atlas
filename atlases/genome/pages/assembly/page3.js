// atlases/genome/pages/assembly/page3.js
// =============================================================================
// page3 — Chromosome overview, length-scaled strip (stage: assembly)
//
// Phase-B target (the Genome Atlas's primary deliverable): one row per chrom,
// stacked sub-tracks (gene density, repeat density, conserved-element density,
// cohort overlay from the Inversion Atlas's candidates_registry).
//
// Round-1 status: scaffold spec only. Mockup gradient bars stand in for real
// density tracks. The active-candidate highlight on LG28 is hardcoded —
// future phases read shared.candidate / shared.activeChrom.
// =============================================================================

import { _pageState, _setActiveState } from './page3/_state.js';

export function renderPage3(/* state */) {
  // No-op. Spec page. Phase-B wiring will replace mockup gradients with real
  // density renders from chromosome_map + gene_track + repeat_track +
  // conserved_elements.
  return;
}

export const PAGE3_META = {
  id: 'page3',
  stage: 'assembly',
  label: 'chromosome overview',
  static: true,
};

export function refreshPage3(state) {
  if (state) _setActiveState(state);
  return renderPage3(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  _setActiveState(legacyState);
  try { refreshPage3(legacyState); }
  catch (e) { console.warn('page3.mount: refreshPage3 threw —', e); }
  if (atlasState.genome) atlasState.genome._page3State = legacyState;
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}
