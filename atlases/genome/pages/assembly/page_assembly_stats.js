// atlases/genome/pages/assembly/page_assembly_stats.js
// =============================================================================
// page_assembly_stats — Assembly QC banner + per-chromosome table.
//
// Reads `assembly_stats` (JSON layer) and renders:
//   - 6 global QC tiles (BUSCO %, contig N50, scaffold N50, gap rate, T2T %, total length)
//   - Per-chromosome QC table (one row per chrom; sortable)
//
// Schema per atlases/genome/registries/schemas/schema_out/assembly_stats_v1.schema.json:
//   {
//     haplotype: string,
//     global: { busco_pct, contig_n50, scaffold_n50, gap_rate, total_length_bp, t2t_pct },
//     per_chrom: [{ chrom, length_bp, gaps, centromere, telomere_l, telomere_r, t2t, busco_pct, n50 }]
//   }
//
// Page is the OUT-adapter producer for `genome.assembly_stats` consumed by
// the inversion atlas. IN-adapters: none (root producer).
// =============================================================================

import { _pageState, _setActiveState } from './page_assembly_stats/_state.js';
import { probeModeB, renderModeBBadge } from '../../../../core/mode_b_badge.js';

const _state = {
  payload: null,
  perChrom: [],
  view: [],
  sortKey: 'chrom',
  sortDir: 1,
};

// ----- Formatting helpers ------------------------------------------------
function _fmtMb(bp) {
  if (!Number.isFinite(bp)) return '—';
  return (bp / 1e6).toFixed(2);
}
function _fmtGb(bp) {
  if (!Number.isFinite(bp)) return '—';
  return (bp / 1e9).toFixed(2);
}
function _fmtPct(v) {
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(2);
}
function _fmtInt(v) {
  if (!Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString();
}
function _fmtGapRate(v) {
  // The schema treats gap_rate as a fraction in [0, 1]. Display as N's per 100 kbp.
  if (!Number.isFinite(v)) return '—';
  return (v * 1e5).toFixed(1);
}
function _fmtT2T(v) {
  if (v === true)  return '✓';
  if (v === false) return '·';
  return '?';
}
function _fmtTelo(v) {
  if (v === true)  return '✓';
  if (v === false) return '·';
  if (v == null)   return '?';
  return String(v);
}
function _fmtCent(v) {
  if (v == null) return '?';
  if (typeof v === 'boolean') return v ? '✓' : '·';
  if (typeof v === 'object')  return v.mb != null ? `${Number(v.mb).toFixed(1)}` : '✓';
  return String(v);
}
function _escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ----- Tile renderer -----------------------------------------------------
function _setTile(key, value, hint) {
  const tile = document.querySelector(`#pasTileGrid .ga-tile[data-pas-tile="${key}"]`);
  if (!tile) return;
  const valSlot = tile.querySelector('.ga-tile-value');
  if (valSlot) valSlot.textContent = value;
  if (hint) {
    const subSlot = tile.querySelector('.ga-tile-sub');
    if (subSlot) subSlot.textContent = hint;
  }
}

function _renderGlobalTiles(payload) {
  const g = (payload && payload.global) || {};
  _setTile('busco_pct',      _fmtPct(g.busco_pct) + ' %');
  _setTile('contig_n50',     _fmtMb(g.contig_n50) + ' Mb');
  _setTile('scaffold_n50',   _fmtMb(g.scaffold_n50) + ' Mb');
  _setTile('gap_rate',       _fmtGapRate(g.gap_rate));
  _setTile('t2t_pct',        _fmtPct(g.t2t_pct) + ' %');
  _setTile('total_length_bp',_fmtGb(g.total_length_bp) + ' Gb');

  const srcSlot = document.getElementById('pasGlobalSrc');
  if (srcSlot) {
    const hap = payload && payload.haplotype;
    const src = payload && payload.source;
    const parts = [];
    if (hap) parts.push(`hap: ${hap}`);
    if (src) parts.push(`src: ${src}`);
    srcSlot.textContent = parts.length ? parts.join(' · ') : 'live';
  }
}

// ----- Per-chrom table ---------------------------------------------------
function _applyView() {
  const rows = _state.perChrom.slice();
  const k = _state.sortKey, dir = _state.sortDir;
  rows.sort((a, b) => {
    const av = a[k], bv = b[k];
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
  });
  _state.view = rows;
}

function _renderTable() {
  const tbody = document.querySelector('#pasChromTable tbody');
  const countSlot = document.getElementById('pasChromCount');
  if (!tbody) return;
  if (!_state.view.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="ga-dim" style="text-align:center; padding:18px;">no per-chrom rows in payload.</td></tr>';
    if (countSlot) countSlot.textContent = '0 rows';
    return;
  }
  const html = _state.view.map(r =>
    `<tr>` +
    `<td class="ga-cell-id">${_escapeHtml(r.chrom)}</td>` +
    `<td class="ga-cell-num">${_fmtMb(r.length_bp)}</td>` +
    `<td class="ga-cell-num">${_fmtMb(r.n50)}</td>` +
    `<td class="ga-cell-num">${_fmtPct(r.busco_pct)}</td>` +
    `<td class="ga-cell-num">${_fmtInt(r.gaps)}</td>` +
    `<td class="ga-cell-flag">${_fmtCent(r.centromere)}</td>` +
    `<td class="ga-cell-flag">${_fmtTelo(r.telomere_l)}</td>` +
    `<td class="ga-cell-flag">${_fmtTelo(r.telomere_r)}</td>` +
    `<td class="ga-cell-flag">${_fmtT2T(r.t2t)}</td>` +
    `</tr>`
  ).join('');
  tbody.innerHTML = html;
  if (countSlot) countSlot.textContent = `${_state.view.length} rows`;
  _refreshSortArrows();
}

function _refreshSortArrows() {
  document.querySelectorAll('#pasChromTable thead th').forEach(th => {
    th.classList.remove('ga-sort-asc', 'ga-sort-desc');
    if (th.dataset.sortKey === _state.sortKey) {
      th.classList.add(_state.sortDir === 1 ? 'ga-sort-asc' : 'ga-sort-desc');
    }
  });
}

function _wireTable() {
  document.querySelectorAll('#pasChromTable thead th').forEach(th => {
    th.addEventListener('click', () => {
      const k = th.dataset.sortKey;
      if (!k) return;
      if (_state.sortKey === k) {
        _state.sortDir = -_state.sortDir;
      } else {
        _state.sortKey = k;
        _state.sortDir = (th.dataset.sortKind === 'num') ? -1 : 1;
      }
      _applyView();
      _renderTable();
    });
  });
}

// ----- Mode-B badge ------------------------------------------------------
async function _renderAssemblyStatsBadge(registry) {
  const probe = await probeModeB(registry, 'assembly_stats', {}, {
    // The schema declares `per_chrom`. Older payloads may use
    // per_chromosome / chromosomes; keep all three as fallbacks so the
    // probe doesn't fail soft just because of a naming variant.
    extractRows: (p) => {
      if (!p) return null;
      if (Array.isArray(p.per_chrom))       return p.per_chrom;
      if (Array.isArray(p.per_chromosome))  return p.per_chromosome;
      if (Array.isArray(p.chromosomes))     return p.chromosomes;
      if (Array.isArray(p))                 return p;
      return null;
    },
  });
  renderModeBBadge('pasModeBBadge', probe, {
    label:    'assembly stats',
    layerKey: 'assembly_stats',
    compare:  (r) => {
      const payload = r.payload || {};
      const g = payload.global || {};
      const busco = Number.isFinite(g.busco_pct)    ? `BUSCO ${g.busco_pct.toFixed(1)}%` : 'no BUSCO';
      const n50   = Number.isFinite(g.scaffold_n50) ? `scaff N50 ${(g.scaffold_n50/1e6).toFixed(1)} Mb` : 'no N50';
      const hap   = payload.haplotype ? ` · hap ${payload.haplotype}` : '';
      return {
        pass: r.n > 0,
        summary: `${r.n} chrom rows · ${busco} · ${n50}${hap}`,
      };
    },
  });
  return probe;
}

// ----- Lifecycle ---------------------------------------------------------
export const PAGE2_META = {
  id: 'page_assembly_stats',
  stage: 'assembly',
  label: 'assembly stats',
  static: false,
};

export function refreshPage2(state) {
  if (state) _setActiveState(state);
  // No-op renderer kept for compatibility with the legacy page-2 hook —
  // the real render runs inside mount() after the layer probe resolves.
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  _setActiveState(legacyState);
  if (atlasState && atlasState.genome) atlasState.genome._page_assembly_statsState = legacyState;

  _state.payload = null;
  _state.perChrom = [];
  _state.view = [];
  _state.sortKey = 'chrom';
  _state.sortDir = 1;
  _wireTable();

  // Probe the layer. The Mode-B badge renderer surfaces a clean "data
  // pending" state when the cluster-side QC pipeline hasn't shipped
  // assembly_stats.json yet — page tiles stay as dashes in that case.
  let probe = null;
  try {
    probe = await _renderAssemblyStatsBadge(registry);
  } catch (e) {
    console.warn('page_assembly_stats.mount: badge probe threw —', e);
  }
  if (!probe || !probe.ok || !probe.payload) return;

  _state.payload = probe.payload;
  _state.perChrom = Array.isArray(probe.rows) ? probe.rows : [];
  _renderGlobalTiles(probe.payload);
  _applyView();
  _renderTable();
}

export async function unmount(root) {
  _setActiveState(null);
  _state.payload = null;
  _state.perChrom = [];
  _state.view = [];
}

function _buildLegacyState(atlasState) {
  const ga = (atlasState && atlasState.genome) || {};
  return Object.assign({}, ga);
}
