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
import { listLayers } from '../../shared/api_client.js';

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

// ---------------------------------------------------------------------------
// Envelope-aware layer-chip wiring (2026-05-14).
// ---------------------------------------------------------------------------
// page1.html ships 8 `[data-ga-layer]` chips that the original scaffold
// comment said would be "toggled in later rounds as the real layers
// land". This is the first such wiring: when the action pipeline has
// produced a `staging_genome_table_v0` envelope whose `payload.subject`
// matches a chip's data-ga-layer attribute, the chip flips from
// "⚪ not loaded" to "● <layer_id>" and its title carries the action_id
// for provenance.
//
// Subject convention (set by the import_table action's manifest.target.subject):
//   assembly_stats / chromosome_map / gene_track / repeat_track /
//   conserved_elements / synteny_blocks / centromere_telomere /
//   variant_annotations
//
// Fail-soft: any error (server offline, CORS, malformed envelope) leaves
// every chip in its scaffold state. The page is interactive immediately;
// the chips update asynchronously when the probe resolves.

async function _lightUpLayerChips(root) {
  let list;
  try {
    list = await listLayers({
      layer_type: 'genome_table',
      stage:      'staging',
      limit:      200,
    });
  } catch (_e) { return; }

  const chips = (root && typeof root.querySelectorAll === 'function')
    ? root.querySelectorAll('[data-ga-layer]')
    : (typeof document !== 'undefined'
        ? document.querySelectorAll('[data-ga-layer]')
        : []);
  if (!chips || chips.length === 0) return;

  // Build subject → [index_row] map. Most-recent envelope wins per subject.
  const bySubject = new Map();
  for (const row of (list && list.layers) || []) {
    // The index doesn't carry payload.subject; we have to read each envelope
    // to learn its subject. Skip this in the lightweight chip pass — instead
    // match on a heuristic: subject is the trailing tag in `layer_id` after
    // the dataset_id segment, OR can be looked up via getLayer (chatty).
    // For round-1 wiring we use the heuristic; round-2 may fetch envelopes.
    const id = row.layer_id || '';
    bySubject.set(_subjectFromLayerId(id), row);
  }

  for (const chip of chips) {
    const subject = chip.getAttribute('data-ga-layer');
    const row = bySubject.get(subject);
    if (!row) continue;
    chip.textContent = `● ${row.layer_id}`;
    chip.title =
      `layer_type=${row.layer_type}\n` +
      `dataset_id=${row.dataset_id || '?'}\n` +
      `stage=${row.stage}\n` +
      `created_at=${row.created_at || '?'}`;
    // Update the class so styling can switch from "⚪ not loaded" to live.
    chip.classList.remove('ga-layer-not-loaded');
    chip.classList.add('ga-layer-loaded');
  }
}

// The layer_id pattern produced by genome-atlas's dispatcher is
// `<layer_type>_<dataset_id>[_<chrom>]_<action_suffix>`. The 3-char suffix
// isn't a subject — what we actually want is the manifest's target.subject,
// which is stored in payload.subject. The index row doesn't carry payload,
// so for this round-1 wiring we look for the subject as a substring of the
// layer_id (which it isn't unless someone embeds it manually). The safer
// path is exposed for round-2 wiring: call getLayer(layer_id) on each row
// and read payload.subject. Until then, this helper returns the empty
// string and no chips light up unless the index carries a subject hint.
function _subjectFromLayerId(layer_id) {
  // Match against the 8 known subjects as substrings (defensive — the
  // user can use a subject-embedding layer_id convention if they want).
  const KNOWN = [
    'assembly_stats', 'chromosome_map', 'gene_track', 'repeat_track',
    'conserved_elements', 'synteny_blocks', 'centromere_telomere',
    'variant_annotations',
  ];
  for (const s of KNOWN) {
    if (layer_id.indexOf(s) >= 0) return s;
  }
  return '';
}

/**
 * Mount: called by atlas_router when the user navigates to page1.
 *
 * Builds a minimal legacy-shape state and stashes it under
 * atlasState.genome._page1State for parity with the Inversion Atlas's
 * lifecycle pattern. Calls refreshPage1 — currently no-op but the call
 * runs through the lifecycle so future-phase wiring lands cleanly.
 *
 * After the synchronous render, asynchronously probes the action pipeline
 * for genome_table envelopes and lights up matching [data-ga-layer] chips.
 * Fail-soft: any error leaves chips in their scaffold state.
 */
export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  _setActiveState(legacyState);

  try { refreshPage1(legacyState); }
  catch (e) { console.warn('page1.mount: refreshPage1 threw —', e); }

  if (atlasState.genome) atlasState.genome._page1State = legacyState;

  // Envelope-aware chip wiring — async, fail-soft.
  _lightUpLayerChips(root).catch(
    (e) => console.warn('page1.mount: _lightUpLayerChips threw —', e),
  );
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
