// atlases/genome/pages/assembly/page_scaffold.js
// =============================================================================
// page_scaffold — Genome Atlas landing / scaffold preview (stage: assembly)
//
// Static HTML fragment (no JS-driven rendering yet). The fragment declares the
// atlas's vision, required cluster-side data layers, a chromosome-overview
// mockup, the planned panel inventory, the phasing roadmap, and cross-references
// to the other three sibling atlases. Layer-status chips (`[data-ga-layer]`)
// stay "⚪ not loaded" in round 1 — they're toggled in later rounds as the
// real layers land.
//
// Source: legacy/Genome_atlas.html lines 199-473 (the entire #page_scaffold body),
// extracted verbatim and reshaped into class-based markup that pairs with
// atlases/genome/css/genome.css. Inline CSS-var references were preserved
// where they reach atlas-core tokens (e.g. var(--panel-2)); pure literal
// inline styles moved to genome.css.
//
// Round 1 status: stub-preserving + lifecycle scaffolding — pattern matched
// to the Inversion Atlas's page_genes (the help page), which is the canonical
// "static HTML, no renderer" template. mount() is a true no-op beyond
// setting _pageState; unmount() clears it. Future rounds (phase B+) wire
// real renderers into refreshPage1.
//
// Lineage: Genome Atlas v1 single-page scaffold (kickoff doc 2026-05-07).
// =============================================================================

import { _pageState, _setActiveState } from './page_scaffold/_state.js';
import { listLayers } from '../../shared/api_client.js';
import { probeModeB, renderModeBBadge, distinctCount } from '../../../../core/mode_b_badge.js';

// ─── Mode-B probe ────────────────────────────────────────────────────────
// Resolves the chromosome_map summary via the registry. Round-1 layer is
// CONTRACT-ONLY → "○ data pending" today; flips to ● when FAI + AGP are
// emitted to data/assembly/chromosome_map.json. Complements the per-chip
// [data-ga-layer] wiring in _lightUpLayerChips by checking the central
// chromosome-map summary directly.
function _extractChromMapRows(payload) {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.chromosomes)) return payload.chromosomes;
  if (Array.isArray(payload.chroms))      return payload.chroms;
  if (Array.isArray(payload.rows))        return payload.rows;
  return null;
}

function _compareChromMap(probeResult) {
  // Total assembled length (Mb) is a useful headline statistic when the
  // payload exposes per-chrom lengths under any of these common keys.
  let totalMb = 0;
  for (const r of probeResult.rows) {
    const len = r && (r.length_bp ?? r.length ?? r.size_bp ?? r.size);
    if (typeof len === 'number' && Number.isFinite(len)) totalMb += len / 1e6;
  }
  const nChroms = distinctCount(probeResult.rows, 'chrom') ||
                  distinctCount(probeResult.rows, 'name') ||
                  probeResult.n;
  return {
    pass: probeResult.n > 0,
    summary: `${nChroms} chromosomes` +
             (totalMb > 0 ? ` · ${totalMb.toFixed(1)} Mb assembled` : ''),
  };
}

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
 * Inversion Atlas's page_genes meta and signals that mount-time render is a
 * no-op (the loader can skip its first dispatch if it wants).
 */
export const PAGE1_META = {
  id: 'page_scaffold',
  stage: 'assembly',
  label: 'scaffold',
  static: true,
};

// ---------------------------------------------------------------------------
// State-aware public wrapper (degenerate variant — same as inversion page_genes).
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
 * Mount: called by atlas_router when the user navigates to page_scaffold.
 *
 * Builds a minimal legacy-shape state and stashes it under
 * atlasState.genome._page_scaffoldState for parity with the Inversion Atlas's
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
  catch (e) { console.warn('page_scaffold.mount: refreshPage1 threw —', e); }

  if (atlasState.genome) atlasState.genome._page_scaffoldState = legacyState;

  // Envelope-aware chip wiring — async, fail-soft.
  _lightUpLayerChips(root).catch(
    (e) => console.warn('page_scaffold.mount: _lightUpLayerChips threw —', e),
  );

  // Live page-roster: fetch manifest.json relative to this module and
  // render one row per page, grouped by stage. Fail-soft: card stays
  // hidden when the manifest can't be fetched.
  _renderPageRoster(root).catch(
    (e) => console.warn('page_scaffold.mount: _renderPageRoster threw —', e),
  );

  // Mode-B probe — non-blocking. Round-1 layer is CONTRACT-ONLY so this
  // routinely reports "○ data pending" today; auto-flips to ● when the
  // chromosome_map JSON ships.
  probeModeB(registry, 'chromosome_map', null, { extractRows: _extractChromMapRows })
    .then((probe) => renderModeBBadge('psModeBBadge', probe, {
      label:    'chromosome map',
      layerKey: 'chromosome_map',
      compare:  _compareChromMap,
    }))
    .catch((e) => {
      console.warn('page_scaffold.mount: Mode-B probe threw —', e);
    });
}

// ---------------------------------------------------------------------------
// Live page-roster (added 2026-05-27).
//
// Fetches manifest.json at mount time and renders one row per page, grouped
// by stage (assembly → annotation → comparative). Each row shows label,
// page-id code, and tooltip excerpt. Card stays hidden when the manifest
// fetch fails — page_scaffold then renders identically to its earlier shape.
// ---------------------------------------------------------------------------

const _STAGE_ORDER = ['assembly', 'annotation', 'comparative'];

function _escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function _renderPageRoster(root) {
  const card = (root && root.querySelector
    ? root.querySelector('#pageScaffoldRosterCard')
    : document.getElementById('pageScaffoldRosterCard'));
  const slot = (root && root.querySelector
    ? root.querySelector('#pageScaffoldRosterSlot')
    : document.getElementById('pageScaffoldRosterSlot'));
  if (!card || !slot) return;
  let manifest;
  try {
    const url = new URL('../../manifest.json', import.meta.url);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    manifest = await resp.json();
  } catch (_e) {
    // Card stays hidden on fetch failure — landing page renders as before.
    return;
  }
  const pages = Array.isArray(manifest && manifest.pages) ? manifest.pages : [];
  if (!pages.length) return;

  // Group by stage in canonical order; any unknown stage falls to the end.
  const byStage = new Map();
  for (const p of pages) {
    const stage = String(p.stage || 'other');
    let arr = byStage.get(stage);
    if (!arr) { arr = []; byStage.set(stage, arr); }
    arr.push(p);
  }
  const stages = Array.from(byStage.keys()).sort(
    (a, b) => (_STAGE_ORDER.indexOf(a) + 1000 * (_STAGE_ORDER.indexOf(a) < 0)) -
              (_STAGE_ORDER.indexOf(b) + 1000 * (_STAGE_ORDER.indexOf(b) < 0)),
  );

  const parts = [];
  for (const stage of stages) {
    parts.push(
      `<div class="ga-roster-stage">`,
      `<div class="ga-roster-stage-header">`,
      `<span class="ga-roster-stage-tag" data-stage="${_escHtml(stage)}">${_escHtml(stage)}</span>`,
      `<span class="ga-roster-stage-count">${byStage.get(stage).length} page${byStage.get(stage).length === 1 ? '' : 's'}</span>`,
      `</div>`,
      `<div class="ga-roster-grid">`,
    );
    for (const p of byStage.get(stage)) {
      const id = _escHtml(p.id || '');
      const label = _escHtml(p.label || p.id || '');
      const tt = _escHtml(p.tooltip || '');
      parts.push(
        `<div class="ga-roster-row" data-page-id="${id}">`,
        `<div class="ga-roster-label">${label}</div>`,
        `<div class="ga-roster-id"><code>${id}</code></div>`,
        `<div class="ga-roster-tt ga-dim">${tt}</div>`,
        `</div>`,
      );
    }
    parts.push(`</div>`, `</div>`);
  }
  slot.innerHTML = parts.join('');

  const count = (root && root.querySelector
    ? root.querySelector('#pageScaffoldRosterCount')
    : document.getElementById('pageScaffoldRosterCount'));
  if (count) count.textContent = `${pages.length} pages · ${stages.length} stages`;

  card.hidden = false;
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
