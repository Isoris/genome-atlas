// atlases/genome/pages/assembly/page_assembly_stats.js
// =============================================================================
// page_assembly_stats — Assembly stats QC banner (stage: assembly)
//
// Phase-B target: render global QC tiles (BUSCO, N50, gap rate, T2T) + a
// per-chromosome QC table from assembly_stats.json + centromere_telomere.json.
// Round-1 status: scaffold spec only — fragment lists the required layers,
// shows placeholder tiles with dashes, and emits a TODO_MISSING banner for
// the per-chromosome table renderer.
//
// Lifecycle matches page_scaffold (no-op render, mount/unmount preserve _pageState).
// Same template as inversion-atlas/atlases/inversion/pages/comparative/page_genes.js.
// =============================================================================

import { _pageState, _setActiveState } from './page_assembly_stats/_state.js';
import { probeModeB, renderModeBBadge } from '../../../../core/mode_b_badge.js';

export function renderPage2(/* state */) {
  // No-op. Spec page. Phase-B wiring (assembly_stats + centromere_telomere
  // → tiles + table) lands when those layers ship from the cluster-side
  // QC pipeline.
  return;
}

export const PAGE2_META = {
  id: 'page_assembly_stats',
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
  catch (e) { console.warn('page_assembly_stats.mount: refreshPage2 threw —', e); }
  if (atlasState.genome) atlasState.genome._page_assembly_statsState = legacyState;

  // Mode-B probe — non-blocking. Round 1: assembly_stats is CONTRACT-ONLY
  // → badge says "○ data pending" until the cluster QC pipeline ships.
  _renderAssemblyStatsBadge(registry).catch((e) => {
    console.warn('page_assembly_stats.mount: badge probe threw —', e);
  });
}

async function _renderAssemblyStatsBadge(registry) {
  const probe = await probeModeB(registry, 'assembly_stats', {}, {
    extractRows: (p) => {
      if (!p) return null;
      // Either { per_chromosome: [...] } or a flat array; surface either.
      if (Array.isArray(p.per_chromosome)) return p.per_chromosome;
      if (Array.isArray(p.chromosomes))    return p.chromosomes;
      if (Array.isArray(p))                return p;
      return null;
    },
  });
  renderModeBBadge('pasModeBBadge', probe, {
    label:    'assembly stats',
    layerKey: 'assembly_stats',
    compare:  (probeResult) => {
      const globals = probeResult.payload || {};
      const busco = globals.busco_complete_pct ?? globals.busco ?? null;
      const n50   = globals.scaffold_n50_mb    ?? globals.n50_mb ?? null;
      const buscoTag = (busco != null) ? `BUSCO ${Number(busco).toFixed(1)}%` : 'no BUSCO';
      const n50Tag   = (n50   != null) ? `N50 ${Number(n50).toFixed(1)} Mb` : 'no N50';
      return {
        pass: probeResult.n > 0,
        summary: `${probeResult.n} chromosome rows · ${buscoTag} · ${n50Tag}`,
      };
    },
  });
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}
