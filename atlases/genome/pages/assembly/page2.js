// atlases/genome/pages/assembly/page2.js
// =============================================================================
// page2 — Assembly stats QC banner (stage: assembly)
//
// Phase-B target: render global QC tiles (BUSCO, N50, gap rate, T2T) + a
// per-chromosome QC table from assembly_stats.json + centromere_telomere.json.
// Round-1 status: scaffold spec only — fragment lists the required layers,
// shows placeholder tiles with dashes, and emits a TODO_MISSING banner for
// the per-chromosome table renderer.
//
// Lifecycle matches page1 (no-op render, mount/unmount preserve _pageState).
// Same template as inversion-atlas/atlases/inversion/pages/comparative/page5.js.
// =============================================================================

import { _pageState, _setActiveState } from './page2/_state.js';

export function renderPage2(/* state */) {
  // No-op. Spec page. Phase-B wiring (assembly_stats + centromere_telomere
  // → tiles + table) lands when those layers ship from the cluster-side
  // QC pipeline.
  return;
}

export const PAGE2_META = {
  id: 'page2',
  stage: 'assembly',
  label: 'assembly stats',
  static: true,
};

export function refreshPage2(state) {
  if (state) _setActiveState(state);
  return renderPage2(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  _setActiveState(legacyState);
  try { refreshPage2(legacyState); }
  catch (e) { console.warn('page2.mount: refreshPage2 threw —', e); }
  if (atlasState.genome) atlasState.genome._page2State = legacyState;
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}
