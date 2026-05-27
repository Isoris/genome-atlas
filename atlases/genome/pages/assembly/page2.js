// atlases/genome/pages/assembly/page2.js
// =============================================================================
// page2 — Assembly stats QC banner (stage: assembly)
//
// Renders two artefacts:
//   1. The headline QC tile banner (BUSCO single-copy %, contig N50, scaffold
//      N50, gap rate per 100 kbp, T2T-completeness count, total length).
//   2. The per-chromosome QC table — one row per (haplotype, chrom) with
//      length, GC %, gap count, N bases, centromere/telomere presence, and a
//      combined T2T-completeness chip. Sortable headers; haplotype filter.
//
// Reads:
//   state.layers.assembly_stats — { global, per_chrom: [...] }
//   state.layers.centromere_telomere — optional overlay keyed by chrom_id
//
// Until either layer lands, the renderer falls back to a baked-in F₁ hybrid
// sample (Gar 28 + Mac 27 chroms). Pure ESM / no d3.
// =============================================================================

import { _pageState, _setActiveState } from './page2/_state.js';
import { installRouter as _installCrossAtlasRouter, onActiveChrom as _onActiveChrom, getActiveChrom as _getActiveChrom } from '../../shared/cross-atlas.js';
import { installActivePill as _installActivePill } from '../../shared/active-pill.js';
import { installPageIndex as _installPageIndex } from '../../shared/page-index.js';

// ---------------------------------------------------------------------------
// Sample dataset (fallback). Deterministic per-chrom values.
// ---------------------------------------------------------------------------

function _seedRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _samplePerChrom(hap, count, lenBase, seed) {
  const rng = _seedRng(seed);
  const out = [];
  for (let i = 1; i <= count; i++) {
    const len = Math.floor(lenBase * (0.55 + 0.95 * rng()));
    const gc = 40 + 4 * rng();
    const gaps = Math.floor(rng() * 22);
    const nBases = Math.floor(rng() * 50_000);
    // 80% of chroms have both telomeres + centromere → T2T = full.
    const r = rng();
    const has_centromere = r < 0.92;
    const tel5 = rng() < 0.88;
    const tel3 = rng() < 0.85;
    out.push({
      hap,
      chrom: `${hap}_${i}`,
      length_bp: len,
      gc_pct: +gc.toFixed(2),
      gap_count: gaps,
      n_bases: nBases,
      has_centromere,
      telomere_5p: tel5,
      telomere_3p: tel3,
    });
  }
  return out;
}

const ASSEMBLY_STATS_FALLBACK = (() => {
  const garChroms = _samplePerChrom('Gar', 28, 36_000_000, 17);
  const macChroms = _samplePerChrom('Mac', 27, 38_500_000, 29);
  const all = garChroms.concat(macChroms);
  const totalLen = all.reduce((s, c) => s + c.length_bp, 0);
  // Approximate N50: sort lengths desc, accumulate until ≥ 50% of total.
  const lens = all.map((c) => c.length_bp).sort((a, b) => b - a);
  let cum = 0; let n50 = 0;
  for (const L of lens) { cum += L; if (cum >= totalLen / 2) { n50 = L; break; } }
  const t2tCount = all.filter((c) => c.has_centromere && c.telomere_5p && c.telomere_3p).length;
  return {
    global: {
      busco_single_copy_pct: 96.4,
      busco_n_total: 3640,
      busco_lineage: 'actinopterygii_odb10',
      contig_n50_bp: 18_500_000,
      scaffold_n50_bp: n50,
      gap_rate_per_100kb: 1.4,
      t2t_count: t2tCount,
      t2t_total: all.length,
      total_length_bp: totalLen,
      haploids: ['Gar', 'Mac'],
    },
    per_chrom: all,
  };
})();

// ---------------------------------------------------------------------------
// Public lifecycle.
// ---------------------------------------------------------------------------

export function renderPage2(state) {
  const root = (state && state.root) || document;
  if (!root.querySelector) return;
  _renderTiles(root, state || {});
  _renderQcTable(root, state || {});
}

export const PAGE2_META = {
  id: 'page2',
  stage: 'assembly',
  label: 'assembly stats',
  static: false,
};

export function refreshPage2(state) {
  if (state) _setActiveState(state);
  return renderPage2(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  legacyState.root = root || document;
  _setActiveState(legacyState);
  _installCrossAtlasRouter();
  _installActivePill();
  _installPageIndex(root, 'page2');
  try { renderPage2(legacyState); }
  catch (e) { console.warn('page2.mount: renderPage2 threw —', e); }
  _applyActiveChromToQc(root, _getActiveChrom());
  if (root && !root.__gaPage2ChromSub) {
    root.__gaPage2ChromSub = _onActiveChrom(({ chrom, hap }) => {
      _applyActiveChromToQc(root, chrom ? { chrom, hap } : null);
    });
  }
  if (atlasState.genome) atlasState.genome._page2State = legacyState;
}

function _applyActiveChromToQc(root, active) {
  if (!root || !root.querySelectorAll) return;
  const id = active && active.chrom;
  let target = null;
  root.querySelectorAll('.ga-qc-tr').forEach((tr) => {
    const match = id != null && tr.getAttribute('data-ga-qc-chrom') === id;
    tr.classList.toggle('is-active', match);
    if (match) target = tr;
  });
  if (target && target.scrollIntoView) {
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

export async function unmount(root) {
  if (root && root.querySelector) {
    const host = root.querySelector('[data-ga-qc-table]');
    if (host && host.__gaQc && host.__gaQc.destroy) host.__gaQc.destroy();
  }
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}

// ---------------------------------------------------------------------------
// Tiles.
// ---------------------------------------------------------------------------

function _resolveStats(state) {
  const layer = state && state.layers && state.layers.assembly_stats;
  if (layer && layer.global && Array.isArray(layer.per_chrom)) return layer;
  return ASSEMBLY_STATS_FALLBACK;
}

function _renderTiles(root, state) {
  const card = root.querySelector('[data-ga-card="qc-banner"]');
  if (!card) return;
  const stats = _resolveStats(state);
  const g = stats.global || {};

  const tag = card.querySelector('[data-ga-qc-source]');
  if (tag) tag.textContent = (state.layers && state.layers.assembly_stats)
    ? 'assembly_stats · loaded'
    : 'sample data';

  const set = (key, value) => {
    const el = card.querySelector(`[data-ga-tile="${key}"]`);
    if (el) el.textContent = value;
  };

  set('busco_pct',  g.busco_single_copy_pct != null ? `${(+g.busco_single_copy_pct).toFixed(1)} %` : '—');
  set('busco_sub',  `${g.busco_lineage || '—'} · n=${g.busco_n_total ?? '—'}`);
  set('contig_n50',   _fmtBp(g.contig_n50_bp));
  set('scaffold_n50', _fmtBp(g.scaffold_n50_bp));
  set('gap_rate',     g.gap_rate_per_100kb != null ? (+g.gap_rate_per_100kb).toFixed(2) : '—');
  set('t2t_count',    `${g.t2t_count ?? '—'} / ${g.t2t_total ?? '—'}`);
  set('total_length', _fmtBp(g.total_length_bp));
  set('total_length_sub', (g.haploids || []).join(' + ') + ' haploids');
}

// ---------------------------------------------------------------------------
// Per-chromosome QC table.
// ---------------------------------------------------------------------------

const QC_COLUMNS = [
  { key: 'hap',          label: 'hap',     numeric: false },
  { key: 'chrom',        label: 'chrom',   numeric: false },
  { key: 'length_bp',    label: 'length',  numeric: true,  fmt: _fmtBp },
  { key: 'gc_pct',       label: 'GC %',    numeric: true,  fmt: (v) => v != null ? (+v).toFixed(2) : '—' },
  { key: 'gap_count',    label: 'gaps',    numeric: true,  fmt: (v) => v ?? '—' },
  { key: 'n_bases',      label: 'N bases', numeric: true,  fmt: (v) => v != null ? v.toLocaleString() : '—' },
  { key: 'has_centromere', label: 'cen.',  numeric: false, fmt: _chip },
  { key: 'telomere_5p',  label: "5′ tel",  numeric: false, fmt: _chip },
  { key: 'telomere_3p',  label: "3′ tel",  numeric: false, fmt: _chip },
  { key: '_t2t',         label: 'T2T',     numeric: false, fmt: _t2tChip },
];

function _renderQcTable(root, state) {
  const card = root.querySelector('[data-ga-card="qc-table"]');
  if (!card) return;
  const host = card.querySelector('[data-ga-qc-table]');
  if (!host) return;
  if (host.__gaQc && host.__gaQc.destroy) host.__gaQc.destroy();

  const stats = _resolveStats(state);
  const rows = (stats.per_chrom || []).map((r) => Object.assign({
    _t2t: (r.has_centromere ? 1 : 0) + (r.telomere_5p ? 1 : 0) + (r.telomere_3p ? 1 : 0),
  }, r));

  const ctx = {
    card,
    host,
    rows,
    hapFilter: 'all',
    sortKey: 'chrom',
    sortDir: 1,    // 1 = asc, -1 = desc
    _onHeaderClick: null,
    _onRowClick: null,
    _onToolbarClick: null,
    destroy() {
      if (this._onToolbarClick) {
        card.querySelectorAll('[data-ga-qc-hap]').forEach((b) => {
          b.removeEventListener('click', this._onToolbarClick);
        });
      }
      host.__gaQc = null;
    },
  };

  ctx._onToolbarClick = (ev) => {
    const btn = ev.currentTarget;
    if (!btn) return;
    ctx.hapFilter = btn.getAttribute('data-ga-qc-hap');
    card.querySelectorAll('[data-ga-qc-hap]').forEach((b) => {
      b.classList.toggle('is-active', b === btn);
    });
    _draw(ctx);
  };
  card.querySelectorAll('[data-ga-qc-hap]').forEach((b) => {
    b.addEventListener('click', ctx._onToolbarClick);
  });

  host.__gaQc = ctx;
  _draw(ctx);
}

function _draw(ctx) {
  const filtered = ctx.hapFilter === 'all'
    ? ctx.rows.slice()
    : ctx.rows.filter((r) => r.hap === ctx.hapFilter);
  const col = QC_COLUMNS.find((c) => c.key === ctx.sortKey) || QC_COLUMNS[1];
  filtered.sort((a, b) => {
    const va = a[ctx.sortKey];
    const vb = b[ctx.sortKey];
    if (col.numeric) return ((+va || 0) - (+vb || 0)) * ctx.sortDir;
    return String(va).localeCompare(String(vb), undefined, { numeric: true }) * ctx.sortDir;
  });

  // Summary chip.
  const summary = ctx.card.querySelector('[data-ga-qc-summary]');
  if (summary) {
    const totalLen = filtered.reduce((s, r) => s + (r.length_bp || 0), 0);
    summary.textContent = `${filtered.length} rows · ${_fmtBp(totalLen)} total`;
  }

  // Rebuild the table DOM in one pass.
  while (ctx.host.firstChild) ctx.host.removeChild(ctx.host.firstChild);
  const table = document.createElement('table');
  table.className = 'ga-qc-table';

  // Header.
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  QC_COLUMNS.forEach((c) => {
    const th = document.createElement('th');
    th.className = 'ga-qc-th' + (c.numeric ? ' is-num' : '') + (ctx.sortKey === c.key ? ' is-sorted' : '');
    th.setAttribute('data-ga-qc-sort', c.key);
    th.textContent = c.label + (ctx.sortKey === c.key ? (ctx.sortDir > 0 ? ' ▲' : ' ▼') : '');
    th.addEventListener('click', () => {
      if (ctx.sortKey === c.key) ctx.sortDir = -ctx.sortDir;
      else { ctx.sortKey = c.key; ctx.sortDir = 1; }
      _draw(ctx);
    });
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  // Body.
  const tbody = document.createElement('tbody');
  filtered.forEach((row) => {
    const tr = document.createElement('tr');
    tr.className = 'ga-qc-tr';
    tr.setAttribute('data-ga-qc-chrom', row.chrom);
    tr.addEventListener('click', () => {
      // Emit a custom event so the atlas shell can route to page3 at this chrom.
      const ev = new CustomEvent('ga-qc-chrom-click', {
        bubbles: true,
        detail: { hap: row.hap, chrom: row.chrom },
      });
      tr.dispatchEvent(ev);
    });
    QC_COLUMNS.forEach((c) => {
      const td = document.createElement('td');
      td.className = 'ga-qc-td' + (c.numeric ? ' is-num' : '');
      const raw = row[c.key];
      const out = c.fmt ? c.fmt(raw, row) : (raw == null ? '—' : String(raw));
      // Allow chip formatters to return small HTML; we only emit known
      // single-element strings, so this is safe.
      if (typeof out === 'string' && out.includes('<')) td.innerHTML = out;
      else td.textContent = out;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  ctx.host.appendChild(table);
}

// Visual chip helpers.
function _chip(v) {
  return v ? '<span class="ga-qc-chip is-on">●</span>'
           : '<span class="ga-qc-chip is-off">○</span>';
}
function _t2tChip(v) {
  // v is the sum of (centromere + 5p + 3p) booleans → 0..3
  if (v >= 3) return '<span class="ga-qc-chip ga-qc-t2t is-full">●</span>';
  if (v >= 1) return '<span class="ga-qc-chip ga-qc-t2t is-partial">◐</span>';
  return '<span class="ga-qc-chip ga-qc-t2t is-empty">○</span>';
}

function _fmtBp(bp) {
  if (bp == null || !isFinite(bp)) return '—';
  if (bp >= 1e9) return (bp / 1e9).toFixed(2) + ' Gb';
  if (bp >= 1e6) return (bp / 1e6).toFixed(1) + ' Mb';
  if (bp >= 1e3) return (bp / 1e3).toFixed(0) + ' kb';
  return `${bp} bp`;
}
