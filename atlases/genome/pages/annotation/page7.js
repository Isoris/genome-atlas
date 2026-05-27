// atlases/genome/pages/annotation/page7.js
// =============================================================================
// page7 — Variant annotations (stage: annotation · phase E)
//
// Three working views over a SnpEff/VEP annotation set, scoped to inversion
// candidates read cross-atlas from shared.candidates:
//
//   1. Per-candidate impact tally table (HIGH / MODERATE / LOW / MODIFIER
//      counts + top-3 HIGH-impact genes by GERP++ score). Sortable.
//   2. Per-candidate stacked-bar showing relative impact composition.
//   3. Expandable per-candidate HIGH-impact variant detail rows.
//
// Reads:
//   state.layers.variant_annotations.candidate_variants[*]  — preferred input
//   state.layers.gene_track                                  — gene-name resolution
//   state.shared.candidates                                  — cross-atlas slot
//
// Until variant_annotations ships from MODULE_CONSERVATION, the renderer
// generates a deterministic fallback set scoped to the candidate spans, so
// the page behaves end-to-end out of the box. Self-contained HTML/CSS — no
// d3, no SVG (stacked bars are flex divs).
// =============================================================================

import { _pageState, _setActiveState } from './page7/_state.js';

const IMPACT_COLORS = {
  HIGH: '#c0392b',
  MODERATE: '#d98c00',
  LOW: '#4f9e64',
  MODIFIER: '#7a86a8',
};
const IMPACT_ORDER = ['HIGH', 'MODERATE', 'LOW', 'MODIFIER'];

// ---------------------------------------------------------------------------
// Deterministic sample data.
// ---------------------------------------------------------------------------

function _rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CANDIDATES_FALLBACK = [
  { id: 'cand:01', chrom: 'Gar_3',  start_bp: 14_000_000, end_bp: 18_500_000, label: 'cand-01' },
  { id: 'cand:02', chrom: 'Gar_11', start_bp:  4_500_000, end_bp:  6_800_000, label: 'cand-02' },
  { id: 'cand:03', chrom: 'Mac_5',  start_bp: 22_000_000, end_bp: 24_500_000, label: 'cand-03' },
];

const _GENE_NAME_POOL = [
  'TYRP1', 'OPN1MW', 'BRCA2', 'TP53', 'CDKN2A', 'NOTCH1', 'PAX6', 'WNT4',
  'FOXP2', 'SOX9', 'MITF', 'RAG1', 'DMRT1', 'AMH', 'CYP19A1', 'STAR',
  'GHR', 'IGF1', 'MSTN', 'PRDM9', 'SMARCA4', 'BMP2', 'BMP4', 'SHH',
  'GLI3', 'HOXA13', 'HOXD13', 'TBX5', 'TBX22', 'OTX2',
];
const _CONSEQUENCES_HIGH = ['stop_gained', 'frameshift_variant', 'splice_acceptor_variant', 'splice_donor_variant', 'start_lost'];
const _CONSEQUENCES_MOD  = ['missense_variant', 'inframe_insertion', 'inframe_deletion', 'protein_altering_variant'];
const _CONSEQUENCES_LOW  = ['synonymous_variant', 'splice_region_variant', 'start_retained_variant'];
const _CONSEQUENCES_MODF = ['intron_variant', 'upstream_gene_variant', 'downstream_gene_variant', '3_prime_UTR_variant', '5_prime_UTR_variant', 'intergenic_variant'];

function _sampleVariantsForCandidate(cand, seed) {
  const rng = _rng(seed);
  const a = Math.min(cand.start_bp, cand.end_bp);
  const b = Math.max(cand.start_bp, cand.end_bp);
  const spanMb = (b - a) / 1e6;
  const total = Math.max(20, Math.floor(spanMb * (45 + 30 * rng())));
  // Distribution: ~2% HIGH, ~8% MODERATE, ~30% LOW, ~60% MODIFIER.
  const counts = { HIGH: 0, MODERATE: 0, LOW: 0, MODIFIER: 0 };
  const variants = [];
  for (let i = 0; i < total; i++) {
    const r = rng();
    let impact;
    if (r < 0.02) impact = 'HIGH';
    else if (r < 0.10) impact = 'MODERATE';
    else if (r < 0.40) impact = 'LOW';
    else impact = 'MODIFIER';
    counts[impact]++;
    const pos = Math.floor(a + (b - a) * rng());
    const refBase = 'ACGT'[Math.floor(rng() * 4)];
    let altBase = 'ACGT'[Math.floor(rng() * 4)]; if (altBase === refBase) altBase = 'ACGT'[(Math.floor(rng() * 4) + 1) % 4];
    const pool = (impact === 'HIGH' ? _CONSEQUENCES_HIGH :
                  impact === 'MODERATE' ? _CONSEQUENCES_MOD :
                  impact === 'LOW' ? _CONSEQUENCES_LOW : _CONSEQUENCES_MODF);
    const consequence = pool[Math.floor(rng() * pool.length)];
    const gene_name = _GENE_NAME_POOL[Math.floor(rng() * _GENE_NAME_POOL.length)];
    const gerp = +(rng() * 5 + (impact === 'HIGH' ? 2.5 : impact === 'MODERATE' ? 1.5 : 0)).toFixed(2);
    variants.push({
      variant_id: `${cand.id}:v${i + 1}`,
      gene_name,
      gene_id: `${cand.chrom}:g${1 + Math.floor(rng() * 200)}`,
      chrom: cand.chrom,
      pos_bp: pos,
      ref: refBase,
      alt: altBase,
      impact,
      consequence_snpeff: consequence,
      consequence_vep:    consequence,
      gerp,
    });
  }
  // Top-3 HIGH-impact genes by GERP, dedup by gene_name.
  const seen = new Set();
  const top_high_genes = [];
  for (const v of [...variants].filter((v) => v.impact === 'HIGH').sort((a, b) => b.gerp - a.gerp)) {
    if (seen.has(v.gene_name)) continue;
    seen.add(v.gene_name);
    top_high_genes.push(v.gene_name);
    if (top_high_genes.length >= 3) break;
  }
  return { candidate_id: cand.id, counts, top_high_genes, variants };
}

const VARIANT_ANNOTATIONS_FALLBACK = (() => {
  const out = { candidate_variants: {} };
  CANDIDATES_FALLBACK.forEach((c, i) => {
    out.candidate_variants[c.id] = _sampleVariantsForCandidate(c, 1009 + i * 37);
  });
  return out;
})();

// ---------------------------------------------------------------------------
// Public lifecycle.
// ---------------------------------------------------------------------------

export function renderPage7(state) {
  const root = (state && state.root) || document;
  if (!root.querySelector) return;
  _mount(root, state || {});
}

export const PAGE7_META = {
  id: 'page7',
  stage: 'annotation',
  label: 'variant annotations',
  static: false,
};

export function refreshPage7(state) {
  if (state) _setActiveState(state);
  return renderPage7(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  legacyState.root = root || document;
  _setActiveState(legacyState);
  try { renderPage7(legacyState); }
  catch (e) { console.warn('page7.mount: renderPage7 threw —', e); }
  if (atlasState.genome) atlasState.genome._page7State = legacyState;
}

export async function unmount(root) {
  if (root && root.querySelector) {
    ['data-ga-impact-tally', 'data-ga-impact-bars', 'data-ga-impact-detail'].forEach((a) => {
      const host = root.querySelector(`[${a}]`);
      if (host && host.__gaPage7 && host.__gaPage7.destroy) host.__gaPage7.destroy();
    });
  }
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  const shared = (atlasState && atlasState.shared) || {};
  return Object.assign({ shared }, ga);
}

// ---------------------------------------------------------------------------
// Mount.
// ---------------------------------------------------------------------------

function _resolveAnnotations(state, candidates) {
  const layer = state.layers && state.layers.variant_annotations;
  const haveLayer = layer && layer.candidate_variants && Object.keys(layer.candidate_variants).length > 0;
  if (haveLayer) return { source: 'variant_annotations · loaded', data: layer };
  // Generate per-candidate variants on demand for any candidates we have.
  const out = { candidate_variants: {} };
  candidates.forEach((c, i) => {
    // Use the fallback if the candidate matches a baked one (so the demo is stable),
    // otherwise synthesize a fresh set keyed by id.
    if (VARIANT_ANNOTATIONS_FALLBACK.candidate_variants[c.id]) {
      out.candidate_variants[c.id] = VARIANT_ANNOTATIONS_FALLBACK.candidate_variants[c.id];
    } else {
      out.candidate_variants[c.id] = _sampleVariantsForCandidate(c, 7919 + i * 41);
    }
  });
  return { source: 'sample variants', data: out };
}
function _resolveCandidates(state) {
  const shared = state.shared || {};
  if (Array.isArray(shared.candidates) && shared.candidates.length > 0) return shared.candidates;
  return CANDIDATES_FALLBACK;
}

function _mount(root, state) {
  const candidates = _resolveCandidates(state);
  const { source, data } = _resolveAnnotations(state, candidates);

  const card = root.querySelector('[data-ga-card="impact-tally"]');
  if (card) {
    const tag = card.querySelector('[data-ga-impact-source]');
    if (tag) tag.textContent = source;
  }

  _mountTally(root, candidates, data);
  _mountBars(root, candidates, data);
  _mountDetail(root, candidates, data);
}

// ---------------------------------------------------------------------------
// View 1 — Tally table.
// ---------------------------------------------------------------------------

function _mountTally(root, candidates, data) {
  const host = root.querySelector('[data-ga-impact-tally]');
  if (!host) return;
  if (host.__gaPage7 && host.__gaPage7.destroy) host.__gaPage7.destroy();

  const rows = candidates.map((c) => {
    const v = (data.candidate_variants || {})[c.id] || { counts: {}, top_high_genes: [] };
    const counts = v.counts || {};
    const total = IMPACT_ORDER.reduce((s, k) => s + (counts[k] || 0), 0);
    return {
      candidate: c,
      counts,
      total,
      top_high_genes: v.top_high_genes || [],
    };
  });

  const ctx = {
    host,
    rows,
    sortKey: 'HIGH',
    sortDir: -1,    // desc default
    destroy() { host.__gaPage7 = null; },
  };

  _drawTally(ctx);
  host.__gaPage7 = ctx;
}

function _drawTally(ctx) {
  while (ctx.host.firstChild) ctx.host.removeChild(ctx.host.firstChild);
  const sorted = ctx.rows.slice().sort((a, b) => {
    const isNumeric = ctx.sortKey !== 'candidate' && ctx.sortKey !== 'chrom';
    if (ctx.sortKey === 'candidate') {
      return String(a.candidate.label || a.candidate.id).localeCompare(String(b.candidate.label || b.candidate.id)) * ctx.sortDir;
    }
    if (ctx.sortKey === 'chrom') {
      return String(a.candidate.chrom || '').localeCompare(String(b.candidate.chrom || ''), undefined, { numeric: true }) * ctx.sortDir;
    }
    if (ctx.sortKey === 'total') return (a.total - b.total) * ctx.sortDir;
    return ((a.counts[ctx.sortKey] || 0) - (b.counts[ctx.sortKey] || 0)) * ctx.sortDir;
  });

  const table = document.createElement('table');
  table.className = 'ga-impact-table';
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  const headers = [
    { key: 'candidate', label: 'candidate', numeric: false },
    { key: 'chrom',     label: 'chrom',     numeric: false },
    { key: 'HIGH',      label: 'HIGH',      numeric: true,  cls: 'is-high' },
    { key: 'MODERATE',  label: 'MODERATE',  numeric: true,  cls: 'is-mod' },
    { key: 'LOW',       label: 'LOW',       numeric: true,  cls: 'is-low' },
    { key: 'MODIFIER',  label: 'MODIFIER',  numeric: true,  cls: 'is-modf' },
    { key: 'total',     label: 'total',     numeric: true },
    { key: 'top',       label: 'top HIGH genes', numeric: false },
  ];
  headers.forEach((h) => {
    const th = document.createElement('th');
    th.className = 'ga-impact-th' + (h.numeric ? ' is-num' : '') + (h.cls ? ' ' + h.cls : '') + (ctx.sortKey === h.key ? ' is-sorted' : '');
    th.textContent = h.label + (ctx.sortKey === h.key ? (ctx.sortDir > 0 ? ' ▲' : ' ▼') : '');
    if (h.key !== 'top') {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        if (ctx.sortKey === h.key) ctx.sortDir = -ctx.sortDir;
        else { ctx.sortKey = h.key; ctx.sortDir = h.numeric ? -1 : 1; }
        _drawTally(ctx);
      });
    }
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  sorted.forEach((r) => {
    const tr = document.createElement('tr');
    tr.className = 'ga-impact-tr';
    tr.setAttribute('data-ga-cand-id', r.candidate.id);
    tr.addEventListener('click', () => {
      tr.dispatchEvent(new CustomEvent('ga-impact-cand-click', {
        bubbles: true,
        detail: { candidate: r.candidate, counts: r.counts },
      }));
    });
    const td = (txt, cls) => {
      const e = document.createElement('td');
      e.className = 'ga-impact-td' + (cls ? ' ' + cls : '');
      e.textContent = txt;
      return e;
    };
    tr.appendChild(td(r.candidate.label || r.candidate.id));
    tr.appendChild(td(r.candidate.chrom || '—'));
    IMPACT_ORDER.forEach((k) => {
      const cls = (k === 'HIGH' ? 'is-num is-high'
                 : k === 'MODERATE' ? 'is-num is-mod'
                 : k === 'LOW' ? 'is-num is-low'
                 : 'is-num is-modf');
      tr.appendChild(td((r.counts[k] || 0).toLocaleString(), cls));
    });
    tr.appendChild(td(r.total.toLocaleString(), 'is-num'));

    const topCell = document.createElement('td');
    topCell.className = 'ga-impact-td ga-impact-genelist';
    topCell.textContent = r.top_high_genes.length ? r.top_high_genes.join(', ') : '—';
    tr.appendChild(topCell);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  ctx.host.appendChild(table);
}

// ---------------------------------------------------------------------------
// View 2 — Stacked impact bars.
// ---------------------------------------------------------------------------

function _mountBars(root, candidates, data) {
  const host = root.querySelector('[data-ga-impact-bars]');
  if (!host) return;
  if (host.__gaPage7 && host.__gaPage7.destroy) host.__gaPage7.destroy();
  while (host.firstChild) host.removeChild(host.firstChild);

  candidates.forEach((c) => {
    const v = (data.candidate_variants || {})[c.id] || { counts: {} };
    const counts = v.counts || {};
    const total = IMPACT_ORDER.reduce((s, k) => s + (counts[k] || 0), 0);

    const row = document.createElement('div');
    row.className = 'ga-impact-bar-row';

    const lbl = document.createElement('div');
    lbl.className = 'ga-impact-bar-label';
    lbl.textContent = `${c.label || c.id} · ${c.chrom || '—'}`;
    row.appendChild(lbl);

    const bar = document.createElement('div');
    bar.className = 'ga-impact-bar';
    if (total === 0) {
      const empty = document.createElement('div');
      empty.className = 'ga-impact-bar-empty';
      empty.textContent = 'no variants in span';
      bar.appendChild(empty);
    } else {
      IMPACT_ORDER.forEach((k) => {
        const n = counts[k] || 0;
        if (n === 0) return;
        const seg = document.createElement('div');
        seg.className = `ga-impact-bar-seg is-${k.toLowerCase()}`;
        seg.style.width = `${(n / total) * 100}%`;
        seg.style.background = IMPACT_COLORS[k];
        seg.setAttribute('title', `${k}: ${n.toLocaleString()} (${((n / total) * 100).toFixed(1)} %)`);
        // Inline label only when the segment is wide enough.
        if (n / total >= 0.08) {
          seg.textContent = `${k} ${n}`;
        }
        bar.appendChild(seg);
      });
    }
    row.appendChild(bar);

    const total_el = document.createElement('div');
    total_el.className = 'ga-impact-bar-total';
    total_el.textContent = total.toLocaleString() + ' var';
    row.appendChild(total_el);

    host.appendChild(row);
  });

  host.__gaPage7 = { destroy() { host.__gaPage7 = null; } };
}

// ---------------------------------------------------------------------------
// View 3 — Per-candidate HIGH-impact variant detail (expandable).
// ---------------------------------------------------------------------------

function _mountDetail(root, candidates, data) {
  const host = root.querySelector('[data-ga-impact-detail]');
  if (!host) return;
  if (host.__gaPage7 && host.__gaPage7.destroy) host.__gaPage7.destroy();
  while (host.firstChild) host.removeChild(host.firstChild);

  candidates.forEach((c, idx) => {
    const v = (data.candidate_variants || {})[c.id] || { variants: [], counts: {} };
    const highs = (v.variants || []).filter((x) => x.impact === 'HIGH').sort((a, b) => b.gerp - a.gerp);

    const det = document.createElement('details');
    det.className = 'ga-impact-detail';
    if (idx === 0) det.open = true;     // first one expanded by default

    const sum = document.createElement('summary');
    sum.className = 'ga-impact-detail-summary';
    const chip = document.createElement('span');
    chip.className = 'ga-impact-chip is-high';
    chip.textContent = `HIGH ${highs.length}`;
    sum.appendChild(chip);
    const nm = document.createElement('span');
    nm.className = 'ga-impact-detail-name';
    nm.textContent = `${c.label || c.id} · ${c.chrom || '—'} · ${_fmtBp(c.start_bp)} – ${_fmtBp(c.end_bp)}`;
    sum.appendChild(nm);
    det.appendChild(sum);

    if (highs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ga-impact-detail-empty';
      empty.textContent = 'No HIGH-impact variants in this candidate.';
      det.appendChild(empty);
    } else {
      const table = document.createElement('table');
      table.className = 'ga-impact-table is-detail';
      const thead = document.createElement('thead');
      const trh = document.createElement('tr');
      ['gene', 'pos', 'ref/alt', 'SnpEff', 'VEP', 'GERP++'].forEach((h, i) => {
        const th = document.createElement('th');
        th.className = 'ga-impact-th' + (i === 1 || i === 5 ? ' is-num' : '');
        th.textContent = h;
        trh.appendChild(th);
      });
      thead.appendChild(trh);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      highs.forEach((v2) => {
        const tr = document.createElement('tr');
        tr.className = 'ga-impact-tr';
        const td = (txt, cls) => {
          const e = document.createElement('td');
          e.className = 'ga-impact-td' + (cls ? ' ' + cls : '');
          e.textContent = txt;
          return e;
        };
        tr.appendChild(td(v2.gene_name || v2.gene_id));
        tr.appendChild(td(_fmtBp(v2.pos_bp), 'is-num'));
        tr.appendChild(td(`${v2.ref} → ${v2.alt}`));
        tr.appendChild(td(v2.consequence_snpeff || '—'));
        tr.appendChild(td(v2.consequence_vep || '—'));
        tr.appendChild(td(v2.gerp != null ? v2.gerp.toFixed(2) : '—', 'is-num'));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      det.appendChild(table);
    }
    host.appendChild(det);
  });

  host.__gaPage7 = { destroy() { host.__gaPage7 = null; } };
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function _fmtBp(bp) {
  if (bp == null || !isFinite(bp)) return '—';
  if (bp >= 1e9) return (bp / 1e9).toFixed(2) + ' Gb';
  if (bp >= 1e6) return (bp / 1e6).toFixed(1) + ' Mb';
  if (bp >= 1e3) return (bp / 1e3).toFixed(0) + ' kb';
  return `${bp} bp`;
}
