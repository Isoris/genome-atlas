// atlases/genome/pages/annotation/page_repeats_te.js
// =============================================================================
// page_repeats_te — Repeats / TE landscape (stage: annotation)
//
// View 4 — TE-hierarchy alluvial (per parental haplotype).
//
// Multi-panel alluvial flow widget — one panel per parental haplotype
// ((a) C. gariepinus, (b) C. macrocephalus). Each panel renders a generic
// N-level tree:
//
//   col 0          col 1            col 2          col 3      col 4
//   ───── Non-rep                                                     [leaf]
//   ─┤
//   ───── Repetitive ─── Interspersed ─── Class_I ─── SINE ─── tRNA_SINE
//                    └── Tandem        └── Class_II└── LTR  └── Unknown_LTR
//                    └── Other_rep                       └── LINE └── …
//
// The renderer is depth-agnostic (it walks the tree via BFS by depth) so
// adding or removing levels in the data does not require renderer changes.
// Bar height ∝ pct-of-genome; link width = source share. Soft per-branch
// palette inherited from the top-level node down. Inline percentage labels
// match the alluvial reference figure.
//
// Folding semantics (per-panel state):
//   · click any non-leaf node → toggles its sub-tree's visibility
//   · toolbar "depth N"       → resets to global column cap = N
//   · "expand all" / "collapse all" → depth=∞ / depth=0
//
// Data contract (`te_hierarchy.json`):
//
//   { haplotypes: [ { id, name, label, nodes: [ <node> ] } ] }
//   <node> = { id, name, pct, palette?, children?: [<node>] }
//
// Backwards-compat: the previous flat `{ total_bp, classes: [{...}] }` shape
// is auto-converted to the new tree on load.
// =============================================================================

import { _pageState, _setActiveState } from './page_repeats_te/_state.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------------------
// Soft alluvial palette. Top-level branches each carry a palette tag;
// descendants inherit it. Colours picked to read on both dark + light themes
// (de-saturated pastels, not the dense Sankey "candidate-tile" hues).
// ---------------------------------------------------------------------------
const PALETTE = {
  nonrep:    { node: '#9aa9b8', link: 'rgba(154,169,184,0.32)' },  // muted blue-grey
  tandem:    { node: '#c46f8a', link: 'rgba(196,111,138,0.32)' },  // pinkish-red
  other_rep: { node: '#d49c6e', link: 'rgba(212,156,110,0.32)' },  // tan / orange
  class_i:   { node: '#b08bcc', link: 'rgba(176,139,204,0.32)' },  // lavender
  class_ii:  { node: '#e08c9c', link: 'rgba(224,140,156,0.32)' },  // soft salmon
  // fallback when a branch has no explicit palette tag
  default:   { node: '#9b8bb0', link: 'rgba(155,139,176,0.30)' },
};

// Column header strings keyed by tree depth (0-based). Overridable per
// haplotype via `column_headers` on the data; otherwise these defaults apply.
const DEFAULT_COLUMN_HEADERS = [
  'Repeat',
  'TE category',
  'Class',
  'Order',
  'Family',
];

// ---------------------------------------------------------------------------
// Sample dataset (fallback). Two parental haplotypes with five levels.
// Numbers are illustrative — proportional structure matches the alluvial
// reference figure (Non-rep ~52%, Class_II/TIR-rich, dominant CACTA, etc.).
// ---------------------------------------------------------------------------
function _famNodes(prefix, items) {
  return items.map(([n, p], i) => ({ id: `${prefix}:${i}`, name: n, pct: p }));
}
function _garNodes() {
  return [
    { id: 'non_rep', name: 'Non-repetitive', pct: 52.18, palette: 'nonrep' },
    { id: 'rep',     name: 'Repetitive',     pct: 47.82, palette: 'default', children: [
      { id: 'interspersed', name: 'Interspersed_TEs', pct: 43.10, palette: 'default', children: [
        { id: 'class_i',  name: 'Class_I_retro', pct: 19.86, palette: 'class_i', children: [
          { id: 'sine', name: 'SINE', pct: 10.66, children: _famNodes('gar:sine', [
            ['tRNA_SINE',    6.16],
            ['Unknown_SINE', 3.35],
            ['5S_SINE',      0.82],
            ['7SL_SINE',     0.33],
          ]) },
          { id: 'ltr',  name: 'LTR',  pct:  8.79, children: _famNodes('gar:ltr', [
            ['Unknown_LTR', 4.56],
            ['Gypsy',       4.16],
            ['Copia',       0.05],
            ['ERV',         0.02],
          ]) },
          { id: 'line', name: 'LINE', pct:  0.48, children: _famNodes('gar:line', [
            ['LINE_unknown', 0.39],
            ['Other_LINE',   0.09],
          ]) },
        ]},
        { id: 'class_ii', name: 'Class_II_DNA', pct: 23.24, palette: 'class_ii', children: [
          { id: 'tir', name: 'TIR', pct: 18.80, children: _famNodes('gar:tir', [
            ['CACTA',         9.59],
            ['Mutator',       4.60],
            ['hAT',           2.67],
            ['Tc1_Mariner',   0.99],
            ['PIF_Harbinger', 0.92],
            ['Other_TIR',     0.03],
          ]) },
          { id: 'helitron', name: 'Helitron', pct: 4.44, children: _famNodes('gar:hel', [
            ['Helitron-1',     2.55],
            ['Helitron-2',     1.40],
            ['Helitron-other', 0.49],
          ]) },
        ]},
      ]},
      { id: 'tandem', name: 'Tandem_repeats', pct: 8.67, palette: 'tandem', children: _famNodes('gar:tan', [
        ['Minisatellites', 3.47],
        ['Other_tandem',   2.81],
        ['Microsatellites', 2.39],
      ]) },
      { id: 'other_rep', name: 'Other_repeats', pct: 3.30, palette: 'other_rep' },
    ]},
  ];
}
function _macNodes() {
  // Slightly different bp shares — Mac is ~5% larger repeat fraction.
  return [
    { id: 'non_rep', name: 'Non-repetitive', pct: 48.91, palette: 'nonrep' },
    { id: 'rep',     name: 'Repetitive',     pct: 51.09, palette: 'default', children: [
      { id: 'interspersed', name: 'Interspersed_TEs', pct: 45.92, palette: 'default', children: [
        { id: 'class_i',  name: 'Class_I_retro', pct: 21.40, palette: 'class_i', children: [
          { id: 'sine', name: 'SINE', pct: 11.20, children: _famNodes('mac:sine', [
            ['tRNA_SINE',    6.55],
            ['Unknown_SINE', 3.50],
            ['5S_SINE',      0.83],
            ['7SL_SINE',     0.32],
          ]) },
          { id: 'ltr',  name: 'LTR',  pct:  9.65, children: _famNodes('mac:ltr', [
            ['Unknown_LTR', 4.98],
            ['Gypsy',       4.55],
            ['Copia',       0.10],
            ['ERV',         0.02],
          ]) },
          { id: 'line', name: 'LINE', pct:  0.55, children: _famNodes('mac:line', [
            ['LINE_unknown', 0.45],
            ['Other_LINE',   0.10],
          ]) },
        ]},
        { id: 'class_ii', name: 'Class_II_DNA', pct: 24.52, palette: 'class_ii', children: [
          { id: 'tir', name: 'TIR', pct: 19.65, children: _famNodes('mac:tir', [
            ['CACTA',         9.95],
            ['Mutator',       4.80],
            ['hAT',           2.85],
            ['Tc1_Mariner',   1.05],
            ['PIF_Harbinger', 0.95],
            ['Other_TIR',     0.05],
          ]) },
          { id: 'helitron', name: 'Helitron', pct: 4.87, children: _famNodes('mac:hel', [
            ['Helitron-1',     2.80],
            ['Helitron-2',     1.55],
            ['Helitron-other', 0.52],
          ]) },
        ]},
      ]},
      { id: 'tandem', name: 'Tandem_repeats', pct: 8.95, palette: 'tandem', children: _famNodes('mac:tan', [
        ['Minisatellites',  3.58],
        ['Other_tandem',    2.90],
        ['Microsatellites', 2.47],
      ]) },
      { id: 'other_rep', name: 'Other_repeats', pct: 3.22, palette: 'other_rep' },
    ]},
  ];
}
const TE_HIERARCHY_FALLBACK = {
  haplotypes: [
    {
      id: 'gar',
      name: 'Clarias gariepinus',
      label: '(a) Clarias gariepinus',
      column_headers: DEFAULT_COLUMN_HEADERS,
      nodes: _garNodes(),
    },
    {
      id: 'mac',
      name: 'C. macrocephalus',
      label: '(b) C. macrocephalus',
      column_headers: DEFAULT_COLUMN_HEADERS,
      nodes: _macNodes(),
    },
  ],
};

// ---------------------------------------------------------------------------
// Public lifecycle.
// ---------------------------------------------------------------------------

export function renderPage6(state) {
  const root = (state && state.root) || document;
  const host = root.querySelector ? root.querySelector('[data-ga-sankey]') : null;
  if (!host) return;
  _mountSankey(host, state || {});
}

export const PAGE6_META = {
  id: 'page_repeats_te',
  stage: 'annotation',
  label: 'repeats / TE',
  static: false,
};

export function refreshPage6(state) {
  if (state) _setActiveState(state);
  return renderPage6(state || _pageState || {});
}

export async function mount(root, atlasState, registry) {
  const legacyState = _buildLegacyState(atlasState);
  legacyState.root = root || document;
  _setActiveState(legacyState);
  try { refreshPage6(legacyState); }
  catch (e) { console.warn('page_repeats_te.mount: refreshPage6 threw —', e); }
  if (atlasState.genome) atlasState.genome._page_repeats_teState = legacyState;
}

export async function unmount(root) {
  const host = root && root.querySelector ? root.querySelector('[data-ga-sankey]') : null;
  if (host && host.__gaSankey && host.__gaSankey.destroy) {
    host.__gaSankey.destroy();
  }
  _setActiveState(null);
}

function _buildLegacyState(atlasState) {
  const ga = atlasState.genome || {};
  return Object.assign({}, ga);
}

// ---------------------------------------------------------------------------
// Top-level widget mount. One toolbar (shared across panels), one tooltip
// chip (shared), N panels (one per haplotype).
// ---------------------------------------------------------------------------

function _mountSankey(host, state) {
  const data = _resolveTeData(state);
  const sourceLabel = (state.layers && state.layers.te_hierarchy)
    ? 'te_hierarchy · loaded'
    : 'sample data';
  const card = host.closest('[data-ga-card="te-sankey"]');
  if (card) {
    const tag = card.querySelector('[data-ga-te-source]');
    if (tag) tag.textContent = sourceLabel;
  }

  // Re-mount cleanly so refresh() is idempotent.
  if (host.__gaSankey && host.__gaSankey.destroy) host.__gaSankey.destroy();

  // Preserve the tooltip element across re-mounts; rebuild panels.
  let tip = host.querySelector('[data-ga-sankey-tip]');
  // Remove any existing panel nodes.
  Array.from(host.querySelectorAll('.ga-sankey-panel')).forEach((n) => n.remove());

  // The widget context. Per-panel state (depth + expanded set) hangs off
  // the panels array — each panel can be folded independently.
  const ctx = {
    host,
    tip,
    card,
    data,
    panels: [],
    _onToolbarClick: null,
    _onClick: null,
    _onMove: null,
    _onLeave: null,
    destroy() {
      const toolbar = card ? card.querySelector('.ga-sankey-toolbar') : null;
      if (toolbar && this._onToolbarClick) {
        toolbar.removeEventListener('click', this._onToolbarClick);
      }
      if (this._onClick) host.removeEventListener('click', this._onClick);
      if (this._onMove)  host.removeEventListener('mousemove', this._onMove);
      if (this._onLeave) host.removeEventListener('mouseleave', this._onLeave);
      host.__gaSankey = null;
    },
  };

  // Build one panel per haplotype.
  for (const hap of data.haplotypes) {
    const maxDepth = _treeMaxDepth(hap.nodes);
    const panel = {
      hap,
      maxDepth,
      depth: maxDepth,        // start expanded to the deepest level
      expanded: new Set(),    // per-node overrides
      el: null,
      svg: null,
    };
    panel.el = _buildPanelDom(hap, panel);
    panel.svg = panel.el.querySelector('.ga-sankey-svg');
    // Insert before the tooltip so the tip stays last (overlay).
    if (tip) host.insertBefore(panel.el, tip);
    else host.appendChild(panel.el);
    ctx.panels.push(panel);
  }

  // If the tooltip got lost in an earlier re-mount, recreate it.
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'ga-sankey-tooltip';
    tip.setAttribute('data-ga-sankey-tip', '');
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    host.appendChild(tip);
    ctx.tip = tip;
  }

  // Toolbar wiring (single, shared across all panels).
  const toolbar = card ? card.querySelector('.ga-sankey-toolbar') : null;
  if (toolbar) {
    ctx._onToolbarClick = (ev) => {
      const btn = ev.target.closest('button[data-ga-sankey-depth], button[data-ga-sankey-action]');
      if (!btn) return;
      if (btn.dataset.gaSankeyDepth) {
        const d = parseInt(btn.dataset.gaSankeyDepth, 10);
        ctx.panels.forEach((p) => {
          p.depth = d;
          p.expanded = new Set();
        });
        _syncDepthButtons(toolbar, d);
      } else if (btn.dataset.gaSankeyAction === 'expand-all') {
        ctx.panels.forEach((p) => {
          p.depth = p.maxDepth;
          p.expanded = new Set();
        });
        _syncDepthButtons(toolbar, _maxPanelDepth(ctx));
      } else if (btn.dataset.gaSankeyAction === 'collapse-all') {
        ctx.panels.forEach((p) => {
          p.depth = 1;
          p.expanded = new Set();
        });
        _syncDepthButtons(toolbar, 1);
      }
      ctx.panels.forEach((p) => _renderPanel(p, ctx));
    };
    toolbar.addEventListener('click', ctx._onToolbarClick);
    _syncDepthButtons(toolbar, _maxPanelDepth(ctx));
  }

  // Delegated handlers at the host level (works across all panels).
  ctx._onClick = (ev) => {
    const target = ev.target.closest('[data-ga-sankey-node]');
    if (!target) return;
    const panelEl = target.closest('.ga-sankey-panel');
    const panel = ctx.panels.find((p) => p.el === panelEl);
    if (!panel) return;
    const id = target.getAttribute('data-ga-sankey-node');
    const isLeaf = target.getAttribute('data-ga-sankey-leaf') === '1';
    if (isLeaf) return;
    if (panel.expanded.has(id)) panel.expanded.delete(id);
    else panel.expanded.add(id);
    _renderPanel(panel, ctx);
  };
  ctx._onMove = (ev) => {
    const target = ev.target.closest('[data-ga-sankey-tip-payload]');
    if (!target) { _hideTip(ctx); return; }
    _showTip(ctx, target.getAttribute('data-ga-sankey-tip-payload'), ev);
  };
  ctx._onLeave = () => _hideTip(ctx);
  host.addEventListener('click', ctx._onClick);
  host.addEventListener('mousemove', ctx._onMove);
  host.addEventListener('mouseleave', ctx._onLeave);

  host.__gaSankey = ctx;
  ctx.panels.forEach((p) => _renderPanel(p, ctx));
}

function _resolveTeData(state) {
  const layer = state && state.layers && state.layers.te_hierarchy;
  if (!layer) return TE_HIERARCHY_FALLBACK;

  // Already in the new shape.
  if (Array.isArray(layer.haplotypes) && layer.haplotypes.length > 0) {
    return layer;
  }
  // Legacy { total_bp, classes:[...] } shape — adapt to a single-haplotype
  // tree. Class total bp ⇒ % of total_bp; SF/Family same.
  if (Array.isArray(layer.classes) && layer.classes.length > 0) {
    return _adaptLegacyClasses(layer);
  }
  // Unknown shape — fall back so the panel still renders something useful.
  return TE_HIERARCHY_FALLBACK;
}

function _adaptLegacyClasses(layer) {
  const total = Number(layer.total_bp) || _sumLegacyBp(layer);
  const toPct = (bp) => total > 0 ? (bp / total) * 100 : 0;
  const nodes = layer.classes.map((cls) => ({
    id: cls.id || cls.name,
    name: cls.name,
    pct: toPct(_sumLegacyClassBp(cls)),
    palette: 'class_i',
    children: (cls.superfamilies || []).map((sf) => ({
      id: sf.id || `${cls.id}:${sf.name}`,
      name: sf.name,
      pct: toPct(_sumLegacySfBp(sf)),
      children: (sf.families || []).map((fam) => ({
        id: fam.id || `${sf.id}:${fam.name}`,
        name: fam.name,
        pct: toPct(fam.bp || 0),
      })),
    })),
  }));
  return {
    haplotypes: [{
      id: 'all',
      name: 'F₁ hybrid',
      label: 'F₁ hybrid',
      column_headers: ['Class', 'Order', 'Family'],
      nodes,
    }],
  };
}
function _sumLegacyBp(layer) {
  return (layer.classes || []).reduce((s, c) => s + _sumLegacyClassBp(c), 0);
}
function _sumLegacyClassBp(cls) {
  return (cls.superfamilies || []).reduce((s, sf) => s + _sumLegacySfBp(sf), 0);
}
function _sumLegacySfBp(sf) {
  return (sf.families || []).reduce((s, f) => s + (f.bp || 0), 0);
}

function _syncDepthButtons(toolbar, depth) {
  toolbar.querySelectorAll('button[data-ga-sankey-depth]').forEach((btn) => {
    btn.classList.toggle('is-active', parseInt(btn.dataset.gaSankeyDepth, 10) === depth);
  });
}
function _maxPanelDepth(ctx) {
  return ctx.panels.reduce((m, p) => Math.max(m, p.depth), 0);
}

function _buildPanelDom(hap, panel) {
  // Container element. We use plain DOM (not innerHTML) so the renderer can
  // re-fill the SVG cheaply on every state change.
  const wrap = document.createElement('div');
  wrap.className = 'ga-sankey-panel';
  wrap.setAttribute('data-ga-haplotype', hap.id);

  const head = document.createElement('div');
  head.className = 'ga-sankey-panel-head';
  head.textContent = hap.label || hap.name || hap.id;
  wrap.appendChild(head);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'ga-sankey-svg');
  svg.setAttribute('viewBox', '0 0 1000 560');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  wrap.appendChild(svg);

  return wrap;
}

// ---------------------------------------------------------------------------
// Per-panel render — tree → columns → layout → SVG.
// ---------------------------------------------------------------------------

function _renderPanel(panel, ctx) {
  const svg = panel.svg;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const W = 1000;
  const H = 560;
  const PAD_L = 200;       // room for col 0 labels (anchored end)
  const PAD_R = 180;       // room for last-col labels (anchored start)
  const PAD_TOP = 32;      // column-index header band
  const PAD_BOT = 18;
  const NODE_W = 26;       // wider bars to match the alluvial reference
  const NODE_GAP = 8;
  const LABEL_GAP = 8;

  // Resolve palette per node (inherit from nearest ancestor that defines it).
  _resolvePalettes(panel.hap.nodes, null);

  // Build columns by BFS using current panel state.
  const columns = _buildColumns(panel);
  if (columns.length === 0 || columns[0].length === 0) {
    _drawEmpty(svg, W, H);
    return;
  }

  const usableW = W - PAD_L - PAD_R - NODE_W;
  const colX = columns.length === 1
    ? [PAD_L + usableW / 2]
    : columns.map((_, i) => PAD_L + (usableW * i) / (columns.length - 1));

  // Unified pct→pixel scale across columns so ribbon widths conserve.
  const usableH = H - PAD_TOP - PAD_BOT;
  const colSums = columns.map((col) => col.reduce((s, n) => s + n.pct, 0));
  let pctPerPx = 0;
  columns.forEach((col, ci) => {
    const totalGap = NODE_GAP * Math.max(0, col.length - 1);
    const need = Math.max(0.0001, colSums[ci]) / Math.max(1, usableH - totalGap);
    if (need > pctPerPx) pctPerPx = need;
  });
  if (!isFinite(pctPerPx) || pctPerPx <= 0) pctPerPx = 1;

  columns.forEach((col, ci) => {
    const totalGap = NODE_GAP * Math.max(0, col.length - 1);
    const colH = colSums[ci] / pctPerPx + totalGap;
    let y = PAD_TOP + Math.max(0, (usableH - colH) / 2);
    col.forEach((n) => {
      n.h = Math.max(2, n.pct / pctPerPx);
      n.y = y;
      y += n.h + NODE_GAP;
    });
  });

  // Build links between consecutive columns (parent → child).
  const links = _buildLinks(columns);
  const colIndex = new Map();
  columns.forEach((col, ci) => col.forEach((n, ri) => colIndex.set(n.uid, { ci, ri })));

  // Stack link widths at each endpoint, ordered to minimise crossings.
  const outBySource = new Map();
  const inByTarget  = new Map();
  for (const lk of links) {
    if (!outBySource.has(lk.source.uid)) outBySource.set(lk.source.uid, []);
    if (!inByTarget.has(lk.target.uid))  inByTarget.set(lk.target.uid, []);
    outBySource.get(lk.source.uid).push(lk);
    inByTarget.get(lk.target.uid).push(lk);
  }
  outBySource.forEach((arr) => {
    arr.sort((a, b) => colIndex.get(a.target.uid).ri - colIndex.get(b.target.uid).ri);
    let off = 0;
    const node = arr[0].source;
    for (const lk of arr) {
      lk.srcW = lk.pct / pctPerPx;
      lk.srcY = node.y + off;
      off += lk.srcW;
    }
  });
  inByTarget.forEach((arr) => {
    arr.sort((a, b) => colIndex.get(a.source.uid).ri - colIndex.get(b.source.uid).ri);
    let off = 0;
    const node = arr[0].target;
    for (const lk of arr) {
      lk.tgtW = lk.pct / pctPerPx;
      lk.tgtY = node.y + off;
      off += lk.tgtW;
    }
  });

  // Layer A: ribbons. Drawn as filled paths so the band has soft fill rather
  // than a stroke (matches the alluvial figure style — broader, gradient-like).
  const ribbons = _el('g', { class: 'ga-sankey-links' });
  for (const lk of links) {
    const x0 = colX[colIndex.get(lk.source.uid).ci] + NODE_W;
    const x1 = colX[colIndex.get(lk.target.uid).ci];
    const y0t = lk.srcY;
    const y0b = lk.srcY + lk.srcW;
    const y1t = lk.tgtY;
    const y1b = lk.tgtY + lk.tgtW;
    const mid = (x0 + x1) / 2;
    const fill = _palOf(lk.paletteKey).link;
    const d = `M${x0},${y0t}
               C${mid},${y0t} ${mid},${y1t} ${x1},${y1t}
               L${x1},${y1b}
               C${mid},${y1b} ${mid},${y0b} ${x0},${y0b} Z`
      .replace(/\s+/g, ' ');
    ribbons.appendChild(_el('path', {
      class: 'ga-sankey-link',
      d, fill,
      'data-ga-sankey-tip-payload': _tipForLink(lk),
    }));
  }
  svg.appendChild(ribbons);

  // Layer B: nodes (rects) + labels.
  const nodesG = _el('g', { class: 'ga-sankey-nodes' });
  columns.forEach((col, ci) => {
    const isFirst = ci === 0;
    const isLast  = ci === columns.length - 1;
    col.forEach((node) => {
      const x = colX[ci];
      const pal = _palOf(node.paletteKey);
      nodesG.appendChild(_el('rect', {
        class: 'ga-sankey-node' + (node.isLeaf ? ' is-leaf' : ' is-clickable'),
        x, y: node.y, width: NODE_W, height: node.h,
        rx: 1, ry: 1,
        fill: pal.node,
        'data-ga-sankey-node': node.id,
        'data-ga-sankey-leaf': node.isLeaf ? '1' : '0',
        'data-ga-sankey-tip-payload': _tipForNode(node, panel.hap),
      }));

      // Label position. Conventional alluvial: col 0 to the LEFT of the
      // bar (anchor=end), last col to the RIGHT (anchor=start), middle
      // cols to the right of the bar.
      const labelOnRight = !isFirst;
      const labelX = labelOnRight ? x + NODE_W + LABEL_GAP : x - LABEL_GAP;
      const labelY = node.y + node.h / 2;

      const labelText = _fmtNodeLabel(node, !isLast /* leading-pct */);
      const label = _el('text', {
        class: 'ga-sankey-label' + (node.isLeaf ? ' is-leaf' : ''),
        x: labelX, y: labelY,
        'text-anchor': labelOnRight ? 'start' : 'end',
        'dominant-baseline': 'middle',
      });
      label.textContent = labelText;
      if (node.h < 7) label.setAttribute('opacity', '0');
      nodesG.appendChild(label);

      // Small ▸/▾ expand glyph on non-leaf nodes (visible if bar is tall enough).
      if (!node.isLeaf && node.h >= 14) {
        const isExpanded = _isPanelNodeExpanded(panel, node);
        const glyph = _el('text', {
          class: 'ga-sankey-glyph',
          x: labelOnRight ? x + NODE_W + 2 : x + NODE_W - 2,
          y: node.y - 3,
          'text-anchor': labelOnRight ? 'start' : 'end',
        });
        glyph.textContent = isExpanded ? '▾' : '▸';
        nodesG.appendChild(glyph);
      }
    });
  });
  svg.appendChild(nodesG);

  // Layer C: column-index headers (small "0", "1", "2"... above each column,
  // matching the alluvial reference style).
  const headers = _el('g', { class: 'ga-sankey-headers' });
  const headerLabels = panel.hap.column_headers || DEFAULT_COLUMN_HEADERS;
  columns.forEach((_, ci) => {
    const cx = colX[ci] + NODE_W / 2;
    headers.appendChild(_textAt(cx, 12, 'ga-sankey-header-num', String(ci)));
    const name = headerLabels[ci];
    if (name) {
      headers.appendChild(_textAt(cx, 24, 'ga-sankey-header-name', name));
    }
  });
  svg.appendChild(headers);
}

function _drawEmpty(svg, W, H) {
  const txt = _el('text', {
    class: 'ga-sankey-empty',
    x: W / 2, y: H / 2,
    'text-anchor': 'middle', 'dominant-baseline': 'middle',
  });
  txt.textContent = 'No TE hierarchy data.';
  svg.appendChild(txt);
}

// ---------------------------------------------------------------------------
// Tree → columns. Depth-agnostic: each node's column = its depth in the tree.
// Visibility per node: a child appears in col d+1 iff (panel.depth > d) OR
// its parent is in panel.expanded. Leaves are columns terminators.
// ---------------------------------------------------------------------------

function _buildColumns(panel) {
  const columns = [];
  const queue = panel.hap.nodes.map((n, i) => ({ node: n, depth: 0, parent: null, idx: i }));
  while (queue.length) {
    const { node, depth, parent } = queue.shift();
    while (columns.length <= depth) columns.push([]);
    const visualNode = {
      uid: `n:${depth}:${node.id}`,
      id: node.id,
      name: node.name,
      pct: Math.max(0, +node.pct || 0),
      depth,
      parentId: parent ? parent.id : null,
      paletteKey: node.paletteKey || 'default',
      isLeaf: !(node.children && node.children.length > 0),
    };
    columns[depth].push(visualNode);

    // Decide whether to descend into children. panel.depth = number of
    // columns to render; a node at column `depth` reveals its children in
    // column `depth+1` iff `depth + 1 < panel.depth`. Per-node `expanded`
    // overrides this and pulls a single subtree into view.
    const hasChildren = node.children && node.children.length > 0;
    if (!hasChildren) continue;
    const open = (depth + 1 < panel.depth) || panel.expanded.has(node.id);
    if (open) {
      for (const c of node.children) {
        queue.push({ node: c, depth: depth + 1, parent: node });
      }
    } else {
      // Keep the rect clickable — it has hidden children to reveal.
      visualNode.isLeaf = false;
    }
  }
  // Drop trailing empty columns (in case a deepest branch never opens).
  while (columns.length > 1 && columns[columns.length - 1].length === 0) {
    columns.pop();
  }
  return columns;
}

function _buildLinks(columns) {
  const links = [];
  if (columns.length < 2) return links;
  const byId = columns.map((col) => {
    const m = new Map();
    for (const n of col) m.set(n.id, n);
    return m;
  });
  for (let ci = 1; ci < columns.length; ci++) {
    for (const child of columns[ci]) {
      const parent = byId[ci - 1].get(child.parentId);
      if (!parent) continue;
      links.push({
        source: parent,
        target: child,
        pct: child.pct,
        paletteKey: child.paletteKey,
      });
    }
  }
  return links;
}

function _isPanelNodeExpanded(panel, visualNode) {
  // Mirrors the `open` test inside _buildColumns: this node's children are
  // visible iff the next column is within the global depth cap, or the user
  // explicitly opened this subtree.
  return (visualNode.depth + 1 < panel.depth) || panel.expanded.has(visualNode.id);
}

function _treeMaxDepth(forest) {
  let m = 0;
  const walk = (nodes, d) => {
    if (d > m) m = d;
    for (const n of nodes || []) {
      if (n.children && n.children.length) walk(n.children, d + 1);
    }
  };
  walk(forest, 1);
  return m;
}

// Propagate `palette` down the tree: a child without an explicit palette
// inherits from its nearest ancestor that has one.
function _resolvePalettes(nodes, inherited) {
  for (const n of nodes || []) {
    const here = n.palette || inherited || 'default';
    n.paletteKey = here;
    if (n.children && n.children.length) _resolvePalettes(n.children, here);
  }
}

function _palOf(key) {
  return PALETTE[key] || PALETTE.default;
}

// ---------------------------------------------------------------------------
// Labels + tooltip.
// ---------------------------------------------------------------------------

function _fmtPct(p) {
  // Mirror the reference figure: 2 decimals for most values, 1 for >10.
  const v = +p || 0;
  if (v >= 10) return v.toFixed(2) + '%';
  if (v >= 1)  return v.toFixed(2) + '%';
  return v.toFixed(2) + '%';
}
function _fmtNodeLabel(node, leadingPct) {
  // Alluvial convention (per the reference fig): leading-percentage labels
  // for non-last columns ("52.18% Non-repetitive"), trailing-percentage for
  // the last column ("tRNA_SINE 6.16%"). `leadingPct=true` ⇒ leading.
  return leadingPct
    ? `${_fmtPct(node.pct)} ${node.name}`
    : `${node.name} ${_fmtPct(node.pct)}`;
}

function _tipForNode(node, hap) {
  return JSON.stringify({
    k: 'node',
    hap: hap.label || hap.name || hap.id,
    n: node.name,
    p: _fmtPct(node.pct),
    d: node.depth,
  });
}
function _tipForLink(lk) {
  const share = lk.source.pct > 0 ? ((lk.pct / lk.source.pct) * 100).toFixed(1) + '%' : '—';
  return JSON.stringify({
    k: 'link',
    n: `${lk.source.name} → ${lk.target.name}`,
    p: _fmtPct(lk.pct),
    sh: `${share} of ${lk.source.name}`,
  });
}

function _showTip(ctx, payload, ev) {
  if (!ctx.tip) return;
  let parsed; try { parsed = JSON.parse(payload); } catch { return; }
  if (parsed.k === 'link') {
    ctx.tip.innerHTML = `
      <div class="ga-sankey-tip-kind">flow</div>
      <div class="ga-sankey-tip-name">${parsed.n}</div>
      <div class="ga-sankey-tip-meta">${parsed.p} · ${parsed.sh}</div>`;
  } else {
    ctx.tip.innerHTML = `
      <div class="ga-sankey-tip-kind">${parsed.hap || 'node'} · level ${parsed.d}</div>
      <div class="ga-sankey-tip-name">${parsed.n}</div>
      <div class="ga-sankey-tip-meta">${parsed.p} of genome</div>`;
  }
  ctx.tip.hidden = false;
  const hostRect = ctx.host.getBoundingClientRect();
  const x = ev.clientX - hostRect.left;
  const y = ev.clientY - hostRect.top;
  ctx.tip.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
}
function _hideTip(ctx) {
  if (ctx.tip) ctx.tip.hidden = true;
}

// ---------------------------------------------------------------------------
// Tiny SVG helpers.
// ---------------------------------------------------------------------------

function _el(tag, attrs) {
  const n = document.createElementNS(SVG_NS, tag);
  if (attrs) for (const k in attrs) {
    if (attrs[k] === undefined || attrs[k] === null) continue;
    n.setAttribute(k, String(attrs[k]));
  }
  return n;
}
function _textAt(x, y, cls, content) {
  const t = _el('text', { class: cls, x, y, 'text-anchor': 'middle' });
  t.textContent = content;
  return t;
}
