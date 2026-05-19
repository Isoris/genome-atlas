// atlases/genome/pages/annotation/page_variant_annotations.js
// =============================================================================
// page_variant_annotations — Variant annotations (stage: annotation)
//
// Phase-E (final phase) target: SnpEff / VEP impact category overlay per
// inversion candidate. Round-1 scaffold only.
// =============================================================================

import { _pageState, _setActiveState } from './page_variant_annotations/_state.js';

export function renderPage7(/* state */) {
  // No-op. Phase E wires three views (tally, impact bar, HIGH-impact list).
  // Depends on MODULE_CONSERVATION outputs.
  return;
}

export const PAGE7_META = {
  id: 'page_variant_annotations',
  stage: 'annotation',
  label: 'variant annotations',
  static: true,
};

export function refreshPage7(state) {
  if (state) _setActiveState(state);
  return renderPage7(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  _setActiveState(legacyState);
  try { refreshPage7(legacyState); }
  catch (e) { console.warn('page_variant_annotations.mount: refreshPage7 threw —', e); }
  if (atlasState.genome) atlasState.genome._page_variant_annotationsState = legacyState;
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}
