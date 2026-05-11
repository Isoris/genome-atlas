// atlases/genome/pages/assembly/page4.js
// =============================================================================
// page4 — Assembly methods (stage: assembly)
//
// Pure documentation page — describes the HiFi + Hi-C + ONT haplotype-
// resolved assembly pipeline that produced the F₁ reference. No data
// layers, no renderer. Round 1 ships the final shape (no phase B/C
// upgrade planned).
// =============================================================================

import { _pageState, _setActiveState } from './page4/_state.js';

export function renderPage4(/* state */) {
  // No-op. Documentation page; static HTML.
  return;
}

export const PAGE4_META = {
  id: 'page4',
  stage: 'assembly',
  label: 'assembly methods',
  static: true,
};

export function refreshPage4(state) {
  if (state) _setActiveState(state);
  return renderPage4(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  _setActiveState(legacyState);
  try { refreshPage4(legacyState); }
  catch (e) { console.warn('page4.mount: refreshPage4 threw —', e); }
  if (atlasState.genome) atlasState.genome._page4State = legacyState;
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}
