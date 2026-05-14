// atlases/genome/pages/annotation/page12.js
// =============================================================================
// page12 — NCO / gene conversion, per inversion candidate (stage: annotation)
//
// Sister page to page11. Two views around one inversion candidate at a time:
// tract ideogram (green NCO ticks on the left, yellow GC ticks on the right,
// candidate span as a translucent band) and tract rate vs. relative telomere
// distance (LOESS curve + 95% CI band per kind).
//
// The active candidate is read from shared.candidate; the renderer fetches
// data/annotation/nco_gc/<candidate_id>.json.
//
// Round-1 status: spec only.
// =============================================================================

import { _pageState, _setActiveState } from './page12/_state.js';

export function renderPage12(/* state */) {
  // No-op. Phase C wires View 1 (ideogram) + View 2 (telomere curve) from
  // nco_gc_track. No optional cards on this page in round 1.
  return;
}

export const PAGE12_META = {
  id: 'page12',
  stage: 'annotation',
  label: 'NCO / gene conversion',
  static: true,
};

export function refreshPage12(state) {
  if (state) _setActiveState(state);
  return renderPage12(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  _setActiveState(legacyState);
  try { refreshPage12(legacyState); }
  catch (e) { console.warn('page12.mount: refreshPage12 threw —', e); }
  if (atlasState.genome) atlasState.genome._page12State = legacyState;
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}
