// atlases/genome/pages/assembly/page1.js
// =============================================================================
// page1 — Genome Atlas landing / scaffold preview (stage: assembly)
//
// Static HTML fragment (no JS-driven rendering yet). The fragment declares the
// atlas's vision, required cluster-side data layers, a chromosome-overview
// mockup, the planned panel inventory, the phasing roadmap, and cross-references
// to the other three sibling atlases. Layer-status chips (`[data-ga-layer]`)
// stay "⚪ not loaded" in round 1 — they're toggled in later rounds as the
// real layers land.
//
// Source: legacy/Genome_atlas.html lines 199-473 (the entire #page1 body),
// extracted verbatim and reshaped into class-based markup that pairs with
// atlases/genome/css/genome.css. Inline CSS-var references were preserved
// where they reach atlas-core tokens (e.g. var(--panel-2)); pure literal
// inline styles moved to genome.css.
//
// Round 1 status: stub-preserving + lifecycle scaffolding — pattern matched
// to the Inversion Atlas's page5 (the help page), which is the canonical
// "static HTML, no renderer" template. mount() is a true no-op beyond
// setting _pageState; unmount() clears it. Future rounds (phase B+) wire
// real renderers into refreshPage1.
//
// Lineage: Genome Atlas v1 single-page scaffold (kickoff doc 2026-05-07).
// =============================================================================

import { _pageState, _setActiveState } from './page1/_state.js';
import { installPageIndex as _installPageIndex } from '../../shared/page-index.js';

// ---------------------------------------------------------------------------
// Render entry — no-op for the round-1 scaffold.
// ---------------------------------------------------------------------------

/**
 * renderPage1 — round-1 stub. The scaffold is pure declarative HTML with
 * no interactive elements; nothing to do at render time. Future phases:
 *
 *   - phase B: wire chromosome-overview rows to chromosome_map + gene_track
 *              + repeat_track layers (replace the gradient mockups with
 *              real density renders).
 *   - phase C: wire gene-cargo overlay to candidate state from the
 *              Inversion Atlas (cross-atlas via AtlasState.shared.candidate).
 *   - phase D: wire synteny ribbon.
 *   - phase E: wire variant-annotation overlay.
 *
 * Signature follows the Inversion Atlas convention (optional state arg).
 */
export function renderPage1(/* state */) {
  // No-op. Scaffold is static HTML. The [data-ga-layer] chips will be
  // wired in later rounds once the corresponding layers land.
  return;
}

/**
 * PAGE1_META — tab metadata. The `static: true` flag mirrors the
 * Inversion Atlas's page5 meta and signals that mount-time render is a
 * no-op (the loader can skip its first dispatch if it wants).
 */
export const PAGE1_META = {
  id: 'page1',
  stage: 'assembly',
  label: 'scaffold',
  static: true,
};

// ---------------------------------------------------------------------------
// State-aware public wrapper (degenerate variant — same as inversion page5).
// ---------------------------------------------------------------------------

/**
 * Public entry — state-aware wrapper around renderPage1. If `state` is
 * passed, sets _pageState before delegating. Currently degenerate
 * (renderPage1 is a no-op); the wrapper exists so when phase B wires
 * real renderers the lifecycle is already in place.
 */
export function refreshPage1(state) {
  if (state) _setActiveState(state);
  return renderPage1(state || _pageState || {});
}

// ---------------------------------------------------------------------------
// Atlas-router lifecycle.
// ---------------------------------------------------------------------------

/**
 * Mount: called by atlas_router when the user navigates to page1.
 *
 * Builds a minimal legacy-shape state and stashes it under
 * atlasState.genome._page1State for parity with the Inversion Atlas's
 * lifecycle pattern. Calls refreshPage1 — currently no-op but the call
 * runs through the lifecycle so future-phase wiring lands cleanly.
 */
export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  _setActiveState(legacyState);
  _installPageIndex(root, 'page1');

  try { refreshPage1(legacyState); }
  catch (e) { console.warn('page1.mount: refreshPage1 threw —', e); }

  if (atlasState.genome) atlasState.genome._page1State = legacyState;
}

/**
 * Unmount: clear _pageState so post-unmount callbacks see null.
 */
export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}
