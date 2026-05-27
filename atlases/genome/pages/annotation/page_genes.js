// atlases/genome/pages/annotation/page_genes.js
// =============================================================================
// page_genes — Genes (stage: annotation).
//
// REFERENCE TEMPLATE: this is the canonical fill-in pattern for the 5 genome
// stub pages (page_variant_annotations, page_conserved_elements,
// page_chromosome_overview, page_ancestral_karyotype + this one). Same shape:
//   1. probeModeB the declared layer
//   2. renderModeBBadge with a tolerant compare()
//   3. render stat strip + 1-N visualisation cards
//   4. (when applicable) cross-atlas read for the per-candidate cargo
//
// Three views (per the HTML spec cards below):
//   View 1 — genome-wide density (bar chart, one bar per chrom)
//   View 2 — per-chrom gene track (phase B, not implemented here)
//   View 3 — gene cargo per inversion candidate (cross-atlas read of
//            inversion.candidates_v1; counts overlapping genes per span)
//
// Tolerant column matching: gene_track ships as either a GFF (cluster output)
// or a normalised TSV (post-extractor). The extractor flattens both into:
//   { chrom, start_bp, end_bp, gene_id, gene_name, strand, biotype }
// =============================================================================

import { probeModeB, renderModeBBadge } from '../../../../core/mode_b_badge.js';
import { _pageState, _setActiveState } from './page_genes/_state.js';

// ----- Column synonyms (tolerant matching) -------------------------------
const CHROM_KEYS   = ['chrom', 'chromosome', 'chr', 'seqid', 'seqname'];
const START_KEYS   = ['start_bp', 'start', 'gene_start', 'tx_start'];
const END_KEYS     = ['end_bp', 'end', 'gene_end', 'tx_end'];
const GID_KEYS     = ['gene_id', 'id', 'GeneID', 'ID'];
const GNAME_KEYS   = ['gene_name', 'name', 'Name', 'symbol'];
const STRAND_KEYS  = ['strand', 'Strand', 'sense'];
const BIOTYPE_KEYS = ['biotype', 'gene_biotype', 'type', 'feature'];

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

// ----- Page-local state --------------------------------------------------
const _state = {
  genes: [],          // normalised gene rows
  perChrom: [],       // [{ chrom, count, length_bp }]
  perChromView: [],
  cargo: [],          // [{ candidate_id, chrom, start_bp, end_bp, gene_count, gene_names[] }]
  cargoView: [],
  cargoFilter: '',
  densitySort: 'count',
  trackChrom: '',     // currently selected chrom for View 2
  trackGenes: [],     // genes on trackChrom, sorted by start_bp
  registry: null,
};

// ----- Normalise + aggregate ---------------------------------------------
function _normalizeGenes(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const cCol = _pickKey(rows, CHROM_KEYS);
  const sCol = _pickKey(rows, START_KEYS);
  const eCol = _pickKey(rows, END_KEYS);
  const gCol = _pickKey(rows, GID_KEYS);
  const nCol = _pickKey(rows, GNAME_KEYS);
  const tCol = _pickKey(rows, STRAND_KEYS);
  const bCol = _pickKey(rows, BIOTYPE_KEYS);
  if (!cCol || !sCol || !eCol) return [];
  const out = [];
  for (const r of rows) {
    // GFF / GTF: only emit `gene` feature rows; skip transcripts/CDS/exons.
    if (bCol && r[bCol]) {
      const b = String(r[bCol]).toLowerCase();
      if (b === 'transcript' || b === 'cds' || b === 'exon' || b === 'mrna') continue;
    }
    const chrom    = r[cCol];
    const start_bp = _toNum(r[sCol]);
    const end_bp   = _toNum(r[eCol]);
    if (chrom == null || start_bp == null || end_bp == null) continue;
    out.push({
      chrom:     String(chrom),
      start_bp,
      end_bp,
      gene_id:   gCol ? String(r[gCol] || '') : '',
      gene_name: nCol ? String(r[nCol] || '') : '',
      strand:    tCol ? String(r[tCol] || '') : '',
      biotype:   bCol ? String(r[bCol] || 'gene') : 'gene',
    });
  }
  return out;
}

function _aggregatePerChrom(genes) {
  const counts = new Map();   // chrom -> { count, length_bp }
  for (const g of genes) {
    const entry = counts.get(g.chrom) || { count: 0, length_bp: 0 };
    entry.count++;
    if (g.end_bp > entry.length_bp) entry.length_bp = g.end_bp;
    counts.set(g.chrom, entry);
  }
  return Array.from(counts.entries()).map(([chrom, v]) => ({
    chrom, count: v.count, length_bp: v.length_bp,
  }));
}

// Cross-atlas: build per-candidate cargo by overlapping genes against
// inversion.candidates_v1 spans. O(C * G) with chrom bucketing; fine for
// ~few hundred candidates × ~30 k genes.
function _buildCargo(genes, candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return [];
  const byChrom = new Map();
  for (const g of genes) {
    const arr = byChrom.get(g.chrom) || [];
    arr.push(g);
    byChrom.set(g.chrom, arr);
  }
  for (const arr of byChrom.values()) arr.sort((a, b) => a.start_bp - b.start_bp);

  const out = [];
  for (const cand of candidates) {
    if (!cand || !cand.id) continue;
    const arr = byChrom.get(cand.chrom) || [];
    const lo = Number.isFinite(cand.start_bp) ? cand.start_bp : 0;
    const hi = Number.isFinite(cand.end_bp)   ? cand.end_bp   : 0;
    const hits = arr.filter(g => g.end_bp >= lo && g.start_bp <= hi);
    out.push({
      candidate_id: cand.id,
      chrom:        cand.chrom || '',
      start_bp:     lo,
      end_bp:       hi,
      length_bp:    Math.max(0, hi - lo),
      gene_count:   hits.length,
      gene_names:   hits.slice(0, 12).map(g => g.gene_name || g.gene_id).filter(Boolean),
      truncated:    hits.length > 12,
    });
  }
  return out;
}

// ----- Renderers ---------------------------------------------------------
function _renderStatStrip() {
  const slot = document.getElementById('pageGenesStats');
  if (!slot) return;
  const genes = _state.genes;
  if (!genes.length) { slot.innerHTML = ''; return; }
  const chroms = new Set(genes.map(g => g.chrom));
  const cell = (lbl, val) =>
    `<div class="ga-stat-cell"><div class="ga-stat-lbl">${lbl}</div>` +
    `<div class="ga-stat-val">${val}</div></div>`;
  slot.innerHTML = [
    cell('genes',          _fmtInt(genes.length)),
    cell('chroms',         _fmtInt(chroms.size)),
    cell('mean per chrom', _fmtInt(genes.length / Math.max(1, chroms.size))),
  ].join('');
}

const DENSITY_W = 720;
const DENSITY_BAR_H = 14;
const DENSITY_PAD_L = 90;
const DENSITY_PAD_R = 60;
const DENSITY_PAD_T = 14;
const DENSITY_PAD_B = 8;

function _renderDensity() {
  const slot = document.getElementById('pageGenesDensitySlot');
  const card = document.getElementById('pageGenesDensityCard');
  const count = document.getElementById('pageGenesDensityCount');
  if (!slot || !card) return;
  const rows = _state.perChromView;
  if (!rows.length) { slot.innerHTML = ''; card.hidden = true; return; }
  card.hidden = false;
  if (count) count.textContent = `${rows.length} chroms`;

  const maxCount = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  const innerW = DENSITY_W - DENSITY_PAD_L - DENSITY_PAD_R;
  const innerH = rows.length * DENSITY_BAR_H;
  const H = innerH + DENSITY_PAD_T + DENSITY_PAD_B;
  const xFor = (n) => DENSITY_PAD_L + (n / maxCount) * innerW;

  const parts = [`<svg class="ga-density-svg" viewBox="0 0 ${DENSITY_W} ${H}" preserveAspectRatio="xMinYMin meet">`];
  rows.forEach((r, i) => {
    const y = DENSITY_PAD_T + i * DENSITY_BAR_H + 1;
    const xEnd = xFor(r.count);
    const w = Math.max(1, xEnd - DENSITY_PAD_L);
    parts.push(
      `<text class="ga-density-label" x="${DENSITY_PAD_L - 6}" y="${y + DENSITY_BAR_H / 2 + 3}" text-anchor="end">${_esc(r.chrom)}</text>`,
      `<rect class="ga-density-bar" x="${DENSITY_PAD_L}" y="${y}" width="${w}" height="${DENSITY_BAR_H - 2}">` +
        `<title>${_esc(r.chrom)} · ${_fmtInt(r.count)} genes · ${_fmtMb(r.length_bp)} Mb</title>` +
      `</rect>`,
      `<text class="ga-density-val" x="${xEnd + 4}" y="${y + DENSITY_BAR_H / 2 + 3}">${_fmtInt(r.count)}</text>`,
    );
  });
  parts.push('</svg>');
  slot.innerHTML = parts.join('');
}

function _applyDensitySort() {
  const rows = _state.perChrom.slice();
  const k = _state.densitySort;
  rows.sort((a, b) => {
    if (k === 'chrom')  return String(a.chrom).localeCompare(String(b.chrom));
    if (k === 'length') return b.length_bp - a.length_bp;
    return b.count - a.count;
  });
  _state.perChromView = rows;
}

function _renderCargo() {
  const slot = document.getElementById('pageGenesCargoSlot');
  const card = document.getElementById('pageGenesCargoCard');
  const count = document.getElementById('pageGenesCargoCount');
  if (!slot || !card) return;
  const rows = _state.cargoView;
  if (!_state.cargo.length) { card.hidden = true; return; }
  card.hidden = false;
  if (count) count.textContent = `${rows.length} of ${_state.cargo.length}`;
  if (!rows.length) {
    slot.innerHTML = '<span class="ga-hint">no candidates match.</span>';
    return;
  }
  const lines = ['<table class="ga-table"><thead><tr>',
    '<th>candidate</th><th>chrom</th><th class="ga-num">span (Mb)</th>',
    '<th class="ga-num">length (Mb)</th><th class="ga-num">gene count</th>',
    '<th>genes (first 12)</th></tr></thead><tbody>'];
  for (const r of rows) {
    lines.push('<tr>' +
      `<td><code>${_esc(r.candidate_id)}</code></td>` +
      `<td>${_esc(r.chrom)}</td>` +
      `<td class="ga-num">${_fmtMb(r.start_bp)} – ${_fmtMb(r.end_bp)}</td>` +
      `<td class="ga-num">${_fmtMb(r.length_bp)}</td>` +
      `<td class="ga-num">${_fmtInt(r.gene_count)}</td>` +
      `<td class="ga-dim">${_esc(r.gene_names.join(', '))}${r.truncated ? ' ...' : ''}</td>` +
      '</tr>');
  }
  lines.push('</tbody></table>');
  slot.innerHTML = lines.join('');
}

function _applyCargoFilter() {
  const q = _state.cargoFilter.toLowerCase();
  _state.cargoView = q
    ? _state.cargo.filter(r => r.candidate_id.toLowerCase().includes(q))
    : _state.cargo.slice();
}

// ----- View 2 — per-chromosome gene track --------------------------------
// SVG strip: length-scaled axis, one stripe per gene; strand colour
// (+ blue, − red). Hover shows gene_name + Mb span.
const TRACK_W = 880;
const TRACK_PAD_L = 24;
const TRACK_PAD_R = 24;
const TRACK_AXIS_H = 22;
const TRACK_BAR_H = 16;
const TRACK_PAD_T = 18;
const TRACK_PAD_B = 8;
const TRACK_STRAND_COLOR = { '+': '#2563eb', '-': '#dc2626' };

function _selectTrackChrom(chrom) {
  _state.trackChrom = chrom || '';
  _state.trackGenes = _state.trackChrom
    ? _state.genes.filter(g => g.chrom === _state.trackChrom)
                  .sort((a, b) => a.start_bp - b.start_bp)
    : [];
}

function _populateChromSelector() {
  const sel = document.getElementById('pageGenesTrackChromSel');
  if (!sel) return;
  const chroms = _state.perChrom.slice().sort((a, b) => b.count - a.count);
  if (!chroms.length) { sel.innerHTML = ''; return; }
  const def = _state.trackChrom || chroms[0].chrom;
  sel.innerHTML = chroms
    .map(c => `<option value="${_esc(c.chrom)}" ${c.chrom === def ? 'selected' : ''}>${_esc(c.chrom)} · ${_fmtInt(c.count)} genes</option>`)
    .join('');
  if (!_state.trackChrom) _selectTrackChrom(def);
}

function _renderTrack() {
  const slot = document.getElementById('pageGenesTrackSlot');
  const card = document.getElementById('pageGenesTrackCard');
  const count = document.getElementById('pageGenesTrackCount');
  if (!slot || !card) return;
  if (!_state.genes.length) { card.hidden = true; return; }
  card.hidden = false;
  const genes = _state.trackGenes;
  if (count) count.textContent = `${_fmtInt(genes.length)} genes on ${_state.trackChrom || '—'}`;
  if (!genes.length) { slot.innerHTML = '<span class="ga-hint">no genes on this chrom.</span>'; return; }

  const chromLen = genes.reduce((m, g) => Math.max(m, g.end_bp), 0) || 1;
  const innerW = TRACK_W - TRACK_PAD_L - TRACK_PAD_R;
  const H = TRACK_PAD_T + TRACK_BAR_H + TRACK_AXIS_H + TRACK_PAD_B;
  const xFor = (bp) => TRACK_PAD_L + (bp / chromLen) * innerW;

  const parts = [`<svg class="ga-density-svg" viewBox="0 0 ${TRACK_W} ${H}" preserveAspectRatio="xMinYMin meet">`];

  // Axis baseline + Mb ticks every ~20 Mb (rounded).
  const yAxis = TRACK_PAD_T + TRACK_BAR_H + 4;
  parts.push(`<line x1="${TRACK_PAD_L}" y1="${yAxis}" x2="${TRACK_PAD_L + innerW}" y2="${yAxis}" stroke="#64748b" stroke-width="1"/>`);
  const tickEveryMb = chromLen > 200e6 ? 50 : chromLen > 100e6 ? 20 : chromLen > 30e6 ? 10 : 5;
  const tickEveryBp = tickEveryMb * 1e6;
  for (let bp = 0; bp <= chromLen; bp += tickEveryBp) {
    const x = xFor(bp);
    parts.push(`<line x1="${x}" y1="${yAxis}" x2="${x}" y2="${yAxis + 4}" stroke="#64748b" stroke-width="1"/>`,
               `<text class="ga-density-label" x="${x}" y="${yAxis + 14}" text-anchor="middle">${(bp / 1e6).toFixed(0)}</text>`);
  }
  // Mb unit label at far right
  parts.push(`<text class="ga-density-label" x="${TRACK_PAD_L + innerW + 4}" y="${yAxis + 14}">Mb</text>`);

  // Gene stripes
  for (const g of genes) {
    const x = xFor(g.start_bp);
    const w = Math.max(1.2, xFor(g.end_bp) - x);
    const color = TRACK_STRAND_COLOR[g.strand] || '#94a3b8';
    const title = `${g.gene_name || g.gene_id || ''} · ${_fmtMb(g.start_bp)}–${_fmtMb(g.end_bp)} Mb · strand ${g.strand || '?'}`;
    parts.push(`<rect x="${x.toFixed(2)}" y="${TRACK_PAD_T}" width="${w.toFixed(2)}" height="${TRACK_BAR_H}" fill="${color}" fill-opacity="0.7"><title>${_esc(title)}</title></rect>`);
  }
  parts.push('</svg>');
  slot.innerHTML = parts.join('');
}

function _exportTrack() {
  _exportTsv(
    `gene_track_${_state.trackChrom}_${Date.now()}.tsv`,
    ['chrom', 'start_bp', 'end_bp', 'strand', 'gene_id', 'gene_name', 'biotype'],
    _state.trackGenes,
    g => [g.chrom, g.start_bp, g.end_bp, g.strand, g.gene_id, g.gene_name, g.biotype],
  );
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

function _exportDensity() {
  _exportTsv(
    `gene_density_${Date.now()}.tsv`,
    ['chrom', 'gene_count', 'length_bp'],
    _state.perChromView,
    r => [r.chrom, r.count, r.length_bp],
  );
}

function _exportCargo() {
  _exportTsv(
    `gene_cargo_${Date.now()}.tsv`,
    ['candidate_id', 'chrom', 'start_bp', 'end_bp', 'length_bp', 'gene_count', 'gene_names_top12'],
    _state.cargoView,
    r => [r.candidate_id, r.chrom, r.start_bp, r.end_bp, r.length_bp, r.gene_count, r.gene_names.join('|')],
  );
}

// ----- Wiring ------------------------------------------------------------
function _wire() {
  const sortSel = document.getElementById('pageGenesDensitySort');
  if (sortSel) sortSel.addEventListener('change', (e) => {
    _state.densitySort = e.target.value || 'count';
    _applyDensitySort();
    _renderDensity();
  });

  const exportBtn = document.getElementById('pageGenesExportBtn');
  if (exportBtn) exportBtn.addEventListener('click', _exportDensity);

  const cargoSearch = document.getElementById('pageGenesCargoSearch');
  if (cargoSearch) cargoSearch.addEventListener('input', (e) => {
    _state.cargoFilter = e.target.value || '';
    _applyCargoFilter();
    _renderCargo();
  });

  const cargoExport = document.getElementById('pageGenesCargoExportBtn');
  if (cargoExport) cargoExport.addEventListener('click', _exportCargo);

  const trackSel = document.getElementById('pageGenesTrackChromSel');
  if (trackSel) trackSel.addEventListener('change', (e) => {
    _selectTrackChrom(e.target.value || '');
    _renderTrack();
  });
  const trackExport = document.getElementById('pageGenesTrackExportBtn');
  if (trackExport) trackExport.addEventListener('click', _exportTrack);
}

function _compareGenes(probeResult) {
  if (!probeResult.rows || !probeResult.rows.length) {
    return { pass: false, summary: 'gene_track returned no rows' };
  }
  return { pass: true, summary: `${probeResult.n} gene rows` };
}

// ----- Lifecycle ---------------------------------------------------------
export async function mount(root, atlasState, registry) {
  _state.genes = [];
  _state.perChrom = [];
  _state.perChromView = [];
  _state.cargo = [];
  _state.cargoView = [];
  _state.cargoFilter = '';
  _state.densitySort = 'count';
  _state.trackChrom = '';
  _state.trackGenes = [];
  _state.registry = registry || null;
  _setActiveState(_state);
  _wire();

  const probe = await probeModeB(registry, 'gene_track');
  renderModeBBadge('pageGenesBadge', probe, {
    label:    'gene_track source',
    layerKey: 'gene_track',
    compare:  _compareGenes,
  });

  if (!probe.ok || !probe.rows || !probe.rows.length) return;

  _state.genes = _normalizeGenes(probe.rows);
  _state.perChrom = _aggregatePerChrom(_state.genes);
  _applyDensitySort();
  _renderStatStrip();
  _renderDensity();
  _populateChromSelector();
  _renderTrack();

  // Cross-atlas: gene cargo per inversion candidate. Fail-soft when the
  // inversion atlas hasn't published candidates_v1 (most cases today).
  try {
    const cands = await registry.resolve('inversion.candidates_v1');
    const rows = Array.isArray(cands) ? cands
               : (cands && Array.isArray(cands.candidates)) ? cands.candidates
               : (cands && Array.isArray(cands.rows)) ? cands.rows
               : [];
    if (rows.length) {
      _state.cargo = _buildCargo(_state.genes, rows);
      _applyCargoFilter();
      _renderCargo();
    }
  } catch (e) {
    console.debug('page_genes: inversion.candidates_v1 unavailable —', e && e.message);
  }
}

export async function unmount(root) {
  _setActiveState(null);
  _state.genes = [];
  _state.perChrom = [];
  _state.perChromView = [];
  _state.cargo = [];
  _state.cargoView = [];
  _state.trackChrom = '';
  _state.trackGenes = [];
}

// ----- Legacy compat (kept so anything that imported renderPage5 still works) ----
export function renderPage5() { return; }
export function refreshPage5(state) {
  if (state) _setActiveState(state);
  return renderPage5();
}
export const PAGE5_META = {
  id: 'page_genes',
  stage: 'annotation',
  label: 'genes',
  static: false,
};
