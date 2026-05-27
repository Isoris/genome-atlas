// atlases/genome/pages/assembly/page_assembly_methods.js
// =============================================================================
// page_assembly_methods — Assembly methods (stage: assembly)
//
// Pure documentation page — describes the HiFi + Hi-C + ONT haplotype-
// resolved assembly pipeline that produced the F₁ reference. No data
// layers, no renderer. Round 1 ships the final shape (no phase B/C
// upgrade planned).
// =============================================================================

import { _pageState, _setActiveState } from './page_assembly_methods/_state.js';
import { installPageIndex as _installPageIndex } from '../../shared/page-index.js';

export function renderPage4(/* state */) {
  // No-op. Documentation page; static HTML.
  return;
}

export const PAGE4_META = {
  id: 'page_assembly_methods',
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
  _installPageIndex(root, 'page_assembly_methods');
  try { refreshPage4(legacyState); }
  catch (e) { console.warn('page_assembly_methods.mount: refreshPage4 threw —', e); }
  if (atlasState.genome) atlasState.genome._page_assembly_methodsState = legacyState;
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}
