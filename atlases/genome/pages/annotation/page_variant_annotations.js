// atlases/genome/pages/annotation/page_variant_annotations.js
// =============================================================================
// page_variant_annotations — SnpEff / VEP impact overlay (stage: annotation).
//
// Replicates the page_genes template:
//   1. probeModeB(registry, 'variant_annotations')
//   2. renderModeBBadge
//   3. View 1 — impact-class distribution bar chart (HIGH / MODERATE / LOW / MODIFIER)
//   4. View 2 — per-candidate deleterious burden table (cross-atlas read of
//      inversion.candidates_v1; counts variants of each impact class per span)
//
// Tolerant column matching: variant_annotations ships as a SnpEff-style TSV
// or a normalised JSON. Either way the extractor flattens to:
//   { chrom, pos_bp, impact, effect, gene_name, gene_id, allele }
// =============================================================================

import { probeModeB, renderModeBBadge } from '../../../../core/mode_b_badge.js';
import { _pageState, _setActiveState } from './page_variant_annotations/_state.js';

// ----- Column synonyms ---------------------------------------------------
const CHROM_KEYS  = ['chrom', 'chromosome', 'chr', 'seqid'];
const POS_KEYS    = ['pos_bp', 'pos', 'position', 'start', 'start_bp'];
const IMPACT_KEYS = ['impact', 'impact_class', 'Impact', 'IMPACT', 'severity'];
const EFFECT_KEYS = ['effect', 'consequence', 'Effect', 'annotation'];
const GENE_KEYS   = ['gene_name', 'gene', 'Gene', 'symbol'];
const GID_KEYS    = ['gene_id', 'GeneID', 'gene_ID'];
const ALLELE_KEYS = ['allele', 'alt', 'ALT'];

const IMPACT_ORDER  = ['HIGH', 'MODERATE', 'LOW', 'MODIFIER'];
const IMPACT_COLORS = {
  HIGH:     '#ef4444',  // red-500
  MODERATE: '#f97316',  // orange-500
  LOW:      '#eab308',  // yellow-500
  MODIFIER: '#94a3b8',  // slate-500
};

function _pickKey(rows, keys) {
  if (!rows || !rows.length) return null;
  const first = rows[0] || {};
  for (const k of keys) if (k in first) return k;
  return null;
}
function _toNum(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
function _esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _fmtInt(v) {
  if (!Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString();
}
function _fmtMb(bp) {
  if (!Number.isFinite(bp)) return '—';
  return (bp / 1e6).toFixed(2);
}
function _normalizeImpact(s) {
  const u = String(s || '').toUpperCase().trim();
  if (IMPACT_ORDER.indexOf(u) >= 0) return u;
  return 'MODIFIER';
}

// ----- Page-local state --------------------------------------------------
const _state = {
  variants: [],         // [{ chrom, pos_bp, impact, effect, gene_name }]
  impactCounts: [],     // [{ impact, count }]
  burden: [],           // [{ candidate_id, chrom, start_bp, end_bp, n_high, n_moderate, n_low, n_modifier, n_total }]
  burdenView: [],
  burdenFilter: '',
  burdenSort: 'n_high',
  registry: null,
};

// ----- Normalise + aggregate ---------------------------------------------
function _normalizeVariants(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const cCol = _pickKey(rows, CHROM_KEYS);
  const pCol = _pickKey(rows, POS_KEYS);
  const iCol = _pickKey(rows, IMPACT_KEYS);
  const eCol = _pickKey(rows, EFFECT_KEYS);
  const gCol = _pickKey(rows, GENE_KEYS);
  if (!cCol || !pCol) return [];
  const out = [];
  for (const r of rows) {
    const chrom  = r[cCol];
    const pos_bp = _toNum(r[pCol]);
    if (chrom == null || pos_bp == null) continue;
    out.push({
      chrom:     String(chrom),
      pos_bp,
      impact:    iCol ? _normalizeImpact(r[iCol]) : 'MODIFIER',
      effect:    eCol ? String(r[eCol] || '')    : '',
      gene_name: gCol ? String(r[gCol] || '')    : '',
    });
  }
  return out;
}

function _aggregateImpacts(variants) {
  const counts = { HIGH: 0, MODERATE: 0, LOW: 0, MODIFIER: 0 };
  for (const v of variants) counts[v.impact]++;
  return IMPACT_ORDER.map(k => ({ impact: k, count: counts[k] }));
}

function _buildBurden(variants, candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return [];
  const byChrom = new Map();
  for (const v of variants) {
    const arr = byChrom.get(v.chrom) || [];
    arr.push(v);
    byChrom.set(v.chrom, arr);
  }
  for (const arr of byChrom.values()) arr.sort((a, b) => a.pos_bp - b.pos_bp);

  const out = [];
  for (const cand of candidates) {
    if (!cand || !cand.id) continue;
    const arr = byChrom.get(cand.chrom) || [];
    const lo = Number.isFinite(cand.start_bp) ? cand.start_bp : 0;
    const hi = Number.isFinite(cand.end_bp)   ? cand.end_bp   : 0;
    const counts = { HIGH: 0, MODERATE: 0, LOW: 0, MODIFIER: 0 };
    for (const v of arr) {
      if (v.pos_bp < lo) continue;
      if (v.pos_bp > hi) break;
      counts[v.impact]++;
    }
    out.push({
      candidate_id: cand.id,
      chrom:        cand.chrom || '',
      start_bp:     lo,
      end_bp:       hi,
      n_high:       counts.HIGH,
      n_moderate:   counts.MODERATE,
      n_low:        counts.LOW,
      n_modifier:   counts.MODIFIER,
      n_total:      counts.HIGH + counts.MODERATE + counts.LOW + counts.MODIFIER,
    });
  }
  return out;
}

// ----- Renderers ---------------------------------------------------------
function _renderStatStrip() {
  const slot = document.getElementById('pageVarAnnStats');
  if (!slot) return;
  const v = _state.variants;
  if (!v.length) { slot.innerHTML = ''; return; }
  const counts = { HIGH: 0, MODERATE: 0, LOW: 0, MODIFIER: 0 };
  for (const r of v) counts[r.impact]++;
  const cell = (lbl, val) =>
    `<div class="ga-stat-cell"><div class="ga-stat-lbl">${lbl}</div>` +
    `<div class="ga-stat-val">${val}</div></div>`;
  slot.innerHTML = [
    cell('variants',       _fmtInt(v.length)),
    cell('HIGH',           _fmtInt(counts.HIGH)),
    cell('MODERATE',       _fmtInt(counts.MODERATE)),
    cell('LOW',            _fmtInt(counts.LOW)),
    cell('MODIFIER',       _fmtInt(counts.MODIFIER)),
  ].join('');
}

const IMPACT_W = 540;
const IMPACT_BAR_H = 32;
const IMPACT_PAD_L = 100;
const IMPACT_PAD_R = 80;
const IMPACT_PAD_T = 10;
const IMPACT_PAD_B = 6;

function _renderImpactChart() {
  const slot = document.getElementById('pageVarAnnImpactSlot');
  const card = document.getElementById('pageVarAnnImpactCard');
  const count = document.getElementById('pageVarAnnImpactCount');
  if (!slot || !card) return;
  const rows = _state.impactCounts;
  if (!rows.length) { slot.innerHTML = ''; card.hidden = true; return; }
  card.hidden = false;
  if (count) count.textContent = `${IMPACT_ORDER.length} impact classes`;

  const maxC = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  const innerW = IMPACT_W - IMPACT_PAD_L - IMPACT_PAD_R;
  const innerH = rows.length * IMPACT_BAR_H;
  const H = innerH + IMPACT_PAD_T + IMPACT_PAD_B;
  const xFor = (n) => IMPACT_PAD_L + (n / maxC) * innerW;

  const parts = [`<svg class="ga-density-svg" viewBox="0 0 ${IMPACT_W} ${H}" preserveAspectRatio="xMinYMin meet">`];
  rows.forEach((r, i) => {
    const y = IMPACT_PAD_T + i * IMPACT_BAR_H + 4;
    const xEnd = xFor(r.count);
    const w = Math.max(1, xEnd - IMPACT_PAD_L);
    const color = IMPACT_COLORS[r.impact] || '#888';
    parts.push(
      `<text class="ga-density-label" x="${IMPACT_PAD_L - 8}" y="${y + (IMPACT_BAR_H - 8) / 2 + 5}" text-anchor="end">${_esc(r.impact)}</text>`,
      `<rect x="${IMPACT_PAD_L}" y="${y}" width="${w}" height="${IMPACT_BAR_H - 8}" fill="${color}" fill-opacity="0.7" stroke="${color}" stroke-width="1">` +
        `<title>${_esc(r.impact)}: ${_fmtInt(r.count)}</title>` +
      `</rect>`,
      `<text class="ga-density-val" x="${xEnd + 6}" y="${y + (IMPACT_BAR_H - 8) / 2 + 5}">${_fmtInt(r.count)}</text>`,
    );
  });
  parts.push('</svg>');
  slot.innerHTML = parts.join('');
}

function _applyBurden() {
  const q = _state.burdenFilter.toLowerCase();
  let v = q
    ? _state.burden.filter(r => r.candidate_id.toLowerCase().includes(q))
    : _state.burden.slice();
  const k = _state.burdenSort;
  v.sort((a, b) => {
    if (k === 'candidate_id') return a.candidate_id.localeCompare(b.candidate_id);
    return b[k] - a[k];
  });
  _state.burdenView = v;
}

function _renderBurden() {
  const slot = document.getElementById('pageVarAnnBurdenSlot');
  const card = document.getElementById('pageVarAnnBurdenCard');
  const count = document.getElementById('pageVarAnnBurdenCount');
  if (!slot || !card) return;
  if (!_state.burden.length) { card.hidden = true; return; }
  card.hidden = false;
  const rows = _state.burdenView;
  if (count) count.textContent = `${rows.length} of ${_state.burden.length}`;
  if (!rows.length) {
    slot.innerHTML = '<span class="ga-hint">no candidates match.</span>';
    return;
  }
  const lines = ['<table class="ga-table"><thead><tr>',
    '<th>candidate</th><th>chrom</th><th class="ga-num">span (Mb)</th>',
    '<th class="ga-num">HIGH</th><th class="ga-num">MODERATE</th>',
    '<th class="ga-num">LOW</th><th class="ga-num">MODIFIER</th>',
    '<th class="ga-num">total</th></tr></thead><tbody>'];
  for (const r of rows) {
    lines.push('<tr>' +
      `<td><code>${_esc(r.candidate_id)}</code></td>` +
      `<td>${_esc(r.chrom)}</td>` +
      `<td class="ga-num">${_fmtMb(r.start_bp)} – ${_fmtMb(r.end_bp)}</td>` +
      `<td class="ga-num" style="color:${IMPACT_COLORS.HIGH}">${_fmtInt(r.n_high)}</td>` +
      `<td class="ga-num" style="color:${IMPACT_COLORS.MODERATE}">${_fmtInt(r.n_moderate)}</td>` +
      `<td class="ga-num" style="color:${IMPACT_COLORS.LOW}">${_fmtInt(r.n_low)}</td>` +
      `<td class="ga-num ga-dim">${_fmtInt(r.n_modifier)}</td>` +
      `<td class="ga-num">${_fmtInt(r.n_total)}</td>` +
      '</tr>');
  }
  lines.push('</tbody></table>');
  slot.innerHTML = lines.join('');
}

// ----- TSV exports -------------------------------------------------------
function _exportTsv(filename, header, rows, project) {
  const lines = [header.join('\t')];
  for (const r of rows) lines.push(project(r).map(v => String(v ?? '')).join('\t'));
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/tab-separated-values' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function _exportImpact() {
  _exportTsv(
    `variant_impact_${Date.now()}.tsv`,
    ['impact', 'count'],
    _state.impactCounts,
    r => [r.impact, r.count],
  );
}
function _exportBurden() {
  _exportTsv(
    `variant_burden_${Date.now()}.tsv`,
    ['candidate_id', 'chrom', 'start_bp', 'end_bp', 'n_high', 'n_moderate', 'n_low', 'n_modifier', 'n_total'],
    _state.burdenView,
    r => [r.candidate_id, r.chrom, r.start_bp, r.end_bp, r.n_high, r.n_moderate, r.n_low, r.n_modifier, r.n_total],
  );
}

// ----- Wiring ------------------------------------------------------------
function _wire() {
  const search = document.getElementById('pageVarAnnBurdenSearch');
  if (search) search.addEventListener('input', (e) => {
    _state.burdenFilter = e.target.value || '';
    _applyBurden();
    _renderBurden();
  });
  const sort = document.getElementById('pageVarAnnBurdenSort');
  if (sort) sort.addEventListener('change', (e) => {
    _state.burdenSort = e.target.value || 'n_high';
    _applyBurden();
    _renderBurden();
  });
  const ie = document.getElementById('pageVarAnnImpactExportBtn');
  if (ie) ie.addEventListener('click', _exportImpact);
  const be = document.getElementById('pageVarAnnBurdenExportBtn');
  if (be) be.addEventListener('click', _exportBurden);
}

function _compare(probeResult) {
  if (!probeResult.rows || !probeResult.rows.length) {
    return { pass: false, summary: 'variant_annotations returned no rows' };
  }
  return { pass: true, summary: `${probeResult.n} variant rows` };
}

// ----- Lifecycle ---------------------------------------------------------
export async function mount(root, atlasState, registry) {
  _state.variants = [];
  _state.impactCounts = [];
  _state.burden = [];
  _state.burdenView = [];
  _state.burdenFilter = '';
  _state.burdenSort = 'n_high';
  _state.registry = registry || null;
  _setActiveState(_state);
  _wire();

  const probe = await probeModeB(registry, 'variant_annotations');
  renderModeBBadge('pageVarAnnBadge', probe, {
    label:    'variant_annotations source',
    layerKey: 'variant_annotations',
    compare:  _compare,
  });

  if (!probe.ok || !probe.rows || !probe.rows.length) return;

  _state.variants = _normalizeVariants(probe.rows);
  _state.impactCounts = _aggregateImpacts(_state.variants);
  _renderStatStrip();
  _renderImpactChart();

  try {
    const cands = await registry.resolve('inversion.candidates_v1');
    const rows = Array.isArray(cands) ? cands
               : (cands && Array.isArray(cands.candidates)) ? cands.candidates
               : (cands && Array.isArray(cands.rows)) ? cands.rows
               : [];
    if (rows.length) {
      _state.burden = _buildBurden(_state.variants, rows);
      _applyBurden();
      _renderBurden();
    }
  } catch (e) {
    console.debug('page_variant_annotations: inversion.candidates_v1 unavailable —', e && e.message);
  }
}

export async function unmount(root) {
  _setActiveState(null);
  _state.variants = [];
  _state.impactCounts = [];
  _state.burden = [];
  _state.burdenView = [];
}

// ----- Legacy compat -----------------------------------------------------
export function renderPage7() { return; }
export function refreshPage7(state) {
  if (state) _setActiveState(state);
  return renderPage7();
}
export const PAGE7_META = {
  id: 'page_variant_annotations',
  stage: 'annotation',
  label: 'variant annotations',
  static: false,
};
