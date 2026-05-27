// atlases/genome/pages/comparative/page_orthologues.js
// =============================================================================
// page_orthologues — Orthologues, focal vs. non-focal (stage: comparative)
//
// Three tables: summary (one row per non-focal genome), per-focal-chrom
// breakdown (%1:1 conservation), gene-level explorer (filterable, paginated).
//
// Focal genome is selectable; the selector reads/writes shared.focalGenome
// so page_synteny's Oxford-grid row axis stays in sync. The gene-level filter
// runs over the rows currently in the DOM (round 1) — phase D swaps in
// the lazy-loaded per-pair fetch.
// =============================================================================

import { _pageState, _setActiveState } from './page_orthologues/_state.js';
import { ensureInstalled as ensureRouterBridge } from '../../shared/_router_bridge.js';
import { probeModeB, renderModeBBadge, distinctCount } from '../../../../core/mode_b_badge.js';

// ─── Mode-B probe ────────────────────────────────────────────────────────
// Resolves ortholog_tables for the active focalGenome (templated). Comparator
// surfaces table row count + non-focal species coverage. Round-1 disk state
// is empty → "○ data pending" until OrthoFinder summary tables ship.
function _extractOrthologRows(payload) {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload;
  // OrthoFinder's per-focal JSON usually keys rows under `rows` / `pairs` /
  // `by_species`; multi-key fallback covers the variants seen in the wild.
  if (Array.isArray(payload.rows))        return payload.rows;
  if (Array.isArray(payload.pairs))       return payload.pairs;
  if (Array.isArray(payload.by_species))  return payload.by_species;
  if (Array.isArray(payload.summary))     return payload.summary;
  return null;
}

function _compareOrthologs(focalGenome) {
  return (probeResult) => {
    // Try a few common species-id column names — OrthoFinder, OMA, and
    // ad-hoc exports each use different conventions.
    let nSpecies = distinctCount(probeResult.rows, 'non_focal_id');
    if (nSpecies === 0) nSpecies = distinctCount(probeResult.rows, 'species_id');
    if (nSpecies === 0) nSpecies = distinctCount(probeResult.rows, 'genome_id');
    return {
      pass: probeResult.n > 0,
      summary: `focal ${focalGenome} · ${probeResult.n} table rows` +
               (nSpecies > 0 ? ` · ${nSpecies} non-focal species` : ''),
    };
  };
}

// Host-atlas-aware state bucket. Router stamps atlasState.shared.currentPage.
// atlas_id on every navigate so the module reads/writes _page_*State under
// whichever atlas mounted it (genome at home; cross-species when mounted
// from the manifest cross-reference). Defaults to 'genome' for back-compat.
function _hostBucket(atlasState) {
  if (!atlasState) return null;
  const aid = (atlasState.shared && atlasState.shared.currentPage
    && atlasState.shared.currentPage.atlas_id) || 'genome';
  if (!atlasState[aid]) atlasState[aid] = {};
  return atlasState[aid];
}

export function renderPage13(/* state */) {
  // No-op. Phase D fetches data/comparative/orthologs/<focal>.json and
  // populates Views 1+2; per-pair files hydrate View 3 column-by-column
  // on reveal. Round 1 ships mock rows in the HTML.
  return;
}

export const PAGE13_META = {
  id: 'page_orthologues',
  stage: 'comparative',
  label: 'orthologues',
  static: true,
};

export function refreshPage13(state) {
  if (state) _setActiveState(state);
  return renderPage13(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  // Same defensive install as page_synteny — guarantees the bridge is up
  // before _applyIncomingFilter reads the slots it might have populated.
  try { ensureRouterBridge(atlasState); }
  catch (e) { console.warn('page_orthologues.mount: ensureRouterBridge threw —', e); }

  const legacyState = _buildLegacyState(atlasState);
  legacyState.focalGenome = legacyState.focalGenome || _readSharedFocal(atlasState) || 'cgar';
  _setActiveState(legacyState);
  try { refreshPage13(legacyState); }
  catch (e) { console.warn('page_orthologues.mount: refreshPage13 threw —', e); }
  _wireFocalSelector(root, legacyState, atlasState);
  _wireSearchFilter(root, legacyState);
  _applyIncomingFilter(root, legacyState, atlasState);
  const bucket = _hostBucket(atlasState);
  if (bucket) bucket._page_orthologuesState = legacyState;

  // Mode-B probe — non-blocking. Round-1 layer is CONTRACT-ONLY so this
  // routinely reports "○ data pending"; auto-flips to ● when OrthoFinder
  // summary tables ship to data/comparative/orthologs/<focal_id>.json.
  probeModeB(registry, 'ortholog_tables', { focal_id: legacyState.focalGenome }, {
    extractRows: _extractOrthologRows,
  })
    .then((probe) => renderModeBBadge('poModeBBadge', probe, {
      label:    'ortholog tables',
      layerKey: 'ortholog_tables',
      context:  legacyState.focalGenome,
      compare:  _compareOrthologs(legacyState.focalGenome),
    }))
    .catch((e) => {
      console.warn('page_orthologues.mount: Mode-B probe threw —', e);
    });
}

export async function unmount(root) {
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = _hostBucket(atlasState) || {};
  return Object.assign({}, ga);
}

function _readSharedFocal(atlasState) {
  return (atlasState && atlasState.shared && atlasState.shared.focalGenome) || null;
}
function _writeSharedFocal(atlasState, focal) {
  if (!atlasState) return;
  atlasState.shared = atlasState.shared || {};
  atlasState.shared.focalGenome = focal;
}

// Focal-genome dropdown. On change, store on _pageState.focalGenome AND
// on shared.focalGenome so page_synteny's Oxford grid follows.
function _wireFocalSelector(root, state, atlasState) {
  if (!root || !root.querySelector) return;
  const sel = root.querySelector('[data-ga-ortho-focal]');
  if (!sel) return;
  if (state.focalGenome) sel.value = state.focalGenome;
  sel.addEventListener('change', () => {
    state.focalGenome = sel.value;
    _writeSharedFocal(atlasState, sel.value);
    if (typeof console !== 'undefined') {
      console.debug('page_orthologues focal genome →', sel.value);
    }
    // Phase D: fetch data/comparative/orthologs/<focal>.json and refresh
    // Views 1 + 2; View 3's per-pair caches are invalidated.
  });
}

// Read incoming pre-filter slots from shared (set by page_synteny's Oxford-grid
// gestures): drilledChrom (axis click) and drilledPair (cell dblclick or
// the popover "open" link). When present:
//   • Sync focal genome.
//   • Pre-fill the gene-level explorer search box with a chrom prefix
//     (e.g. "CGAR.LG01.") so View 3 narrows to that chrom.
//   • Add data-ga-ortho-highlight = "<nonfocal_id>" on the summary table
//     so a CSS rule can flash the matching row.
// The slot is consumed (cleared) after applying so a later mount won't
// re-apply stale state.
function _applyIncomingFilter(root, state, atlasState) {
  const shared = (atlasState && atlasState.shared) || {};
  const dc = shared.drilledChrom;
  const dp = shared.drilledPair;
  if (!dc && !dp) return;

  const chrom = (dc && dc.chrom_id) || (dp && dp.chrom_a);
  const focal = (dc && dc.genome_id) || (dp && dp.a_id);
  const nonFocal = dp && dp.b_id;

  if (focal) {
    state.focalGenome = focal;
    const sel = root.querySelector('[data-ga-ortho-focal]');
    if (sel) sel.value = focal;
  }
  if (chrom) {
    const prefix = (focal ? focal.toUpperCase() : '') + '.' + chrom + '.';
    const input = root.querySelector('[data-ga-ortho-search]');
    if (input) {
      input.value = prefix;
      input.dispatchEvent(new Event('input'));
    }
  }
  if (nonFocal) {
    const summary = root.querySelector('.ga-ortho-summary');
    if (summary) {
      summary.setAttribute('data-ga-ortho-highlight', nonFocal);
      // Phase-D will stamp data-ga-ortho-id="<nonfocal>" on each summary
      // row; here we tag the matching row with .ga-ortho-flash to trigger
      // the one-shot fade. In round 1 the mock rows carry no id, so this
      // is a no-op on the spec page — kept here so the wiring is in place.
      const match = summary.querySelector('.ga-ortho-summary-row[data-ga-ortho-id="' + nonFocal + '"]');
      if (match) {
        match.classList.add('ga-ortho-flash');
        setTimeout(() => match.classList.remove('ga-ortho-flash'), 1600);
      }
    }
  }

  // Consume — don't replay on next mount.
  if (atlasState && atlasState.shared) {
    delete atlasState.shared.drilledChrom;
    delete atlasState.shared.drilledPair;
    delete atlasState.shared.pendingPage;
  }
  if (typeof console !== 'undefined') {
    console.debug('page_orthologues incoming filter applied', { focal: focal, chrom: chrom, nonFocal: nonFocal });
  }
}

// View 3 filter input. Round-1 implementation walks the rows currently
// in the DOM and toggles a hidden class. Updates the count chip.
function _wireSearchFilter(root, state) {
  if (!root || !root.querySelectorAll) return;
  const input = root.querySelector('[data-ga-ortho-search]');
  const count = root.querySelector('[data-ga-ortho-count]');
  const rows = root.querySelectorAll('.ga-ortho-genes-row');
  if (!input || !rows.length) return;

  const total = rows.length;
  const apply = () => {
    const q = (input.value || '').trim().toLowerCase();
    let shown = 0;
    rows.forEach((row) => {
      const txt = row.textContent.toLowerCase();
      const hit = q === '' || txt.indexOf(q) !== -1;
      row.style.display = hit ? '' : 'none';
      if (hit) shown += 1;
    });
    if (count) count.textContent = 'showing ' + shown + ' / ' + total;
  };
  input.addEventListener('input', apply);
}
