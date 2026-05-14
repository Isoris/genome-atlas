// Smoke tests for page1.js's envelope-aware chip wiring.
//
// Exercises the [data-ga-layer] chip-lighting logic with stubbed DOM +
// mocked fetch. The migration uses listLayers() and a heuristic that
// looks for known subject substrings in layer_id — these tests pin that
// contract.
//
// Run from genome-atlas root:
//   node atlases/genome/pages/assembly/test_page1_chips.js
import { listLayers } from '../../shared/api_client.js';

// ----- fake DOM ---------------------------------------------------------
class FakeChip {
  constructor(subject) {
    this._attrs = { 'data-ga-layer': subject };
    this.textContent = '⚪ not loaded';
    this.title = '';
    this.classList = {
      _set: new Set(['ga-layer-status']),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    };
  }
  getAttribute(k) { return this._attrs[k]; }
}

class FakeRoot {
  constructor(chips) { this._chips = chips; }
  querySelectorAll(sel) {
    // Only handle the one selector this migration uses.
    if (sel === '[data-ga-layer]') return this._chips;
    return [];
  }
}

// ----- fetch mock -------------------------------------------------------
const _routes = [];
const _calls  = [];
function _route(p, fn) { _routes.push({ p, fn }); }
function _reset()      { _routes.length = 0; _calls.length = 0; }
globalThis.fetch = async (url, init) => {
  _calls.push({ url, init });
  for (const r of _routes) if (r.p(url, init)) return _make(await r.fn(url, init));
  return _make({ status: 404, body: { error: 'no route', url } });
};
function _make({ status = 200, body = null, text = null } = {}) {
  const ok = status >= 200 && status < 300;
  const t = text ?? (body == null ? '' : JSON.stringify(body));
  return { ok, status, async json() { return body != null ? body : JSON.parse(t); }, async text() { return t; } };
}
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    console.error(`FAIL: ${msg}\n  expected: ${JSON.stringify(b)}\n  got: ${JSON.stringify(a)}`);
    process.exit(1);
  }
  console.log(`  ok: ${msg}`);
}

// ----- mirror page1.js helpers (byte-equivalent) ------------------------

const KNOWN = [
  'assembly_stats', 'chromosome_map', 'gene_track', 'repeat_track',
  'conserved_elements', 'synteny_blocks', 'centromere_telomere',
  'variant_annotations',
];

function _subjectFromLayerId(layer_id) {
  for (const s of KNOWN) {
    if (layer_id.indexOf(s) >= 0) return s;
  }
  return '';
}

async function _lightUpLayerChips(root) {
  let list;
  try {
    list = await listLayers({
      layer_type: 'genome_table', stage: 'staging', limit: 200,
    });
  } catch (_e) { return; }
  const chips = root && typeof root.querySelectorAll === 'function'
    ? root.querySelectorAll('[data-ga-layer]') : [];
  if (!chips || chips.length === 0) return;
  const bySubject = new Map();
  for (const row of (list && list.layers) || []) {
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
    chip.classList.remove('ga-layer-not-loaded');
    chip.classList.add('ga-layer-loaded');
  }
}

// ----- tests ------------------------------------------------------------

console.log('happy path: 1 envelope matching 1 chip:');
{
  _reset();
  _route(
    (url) => url.startsWith('/api/layers'),
    () => ({ body: { layers: [
      {
        layer_id: 'genome_table_main_226_hatchery_assembly_stats_abc',
        layer_type: 'genome_table',
        stage: 'staging',
        dataset_id: 'main_226_hatchery',
        created_at: '2026-05-14T15:00:00Z',
      },
    ], n: 1, total: 1 } }),
  );
  const chips = KNOWN.map(s => new FakeChip(s));
  const root = new FakeRoot(chips);
  await _lightUpLayerChips(root);

  const assemblyChip = chips.find(c => c.getAttribute('data-ga-layer') === 'assembly_stats');
  if (!assemblyChip.textContent.startsWith('● genome_table_main_226_hatchery_assembly_stats_abc')) {
    console.error(`FAIL: assembly_stats chip not updated, got: ${assemblyChip.textContent}`);
    process.exit(1);
  }
  console.log('  ok: assembly_stats chip lit up');
  eq(assemblyChip.classList.contains('ga-layer-loaded'), true, 'loaded class added');
  eq(assemblyChip.classList.contains('ga-layer-not-loaded'), false, 'not-loaded class removed');
  if (!assemblyChip.title.includes('dataset_id=main_226_hatchery')) {
    console.error(`FAIL: title should carry dataset_id, got: ${assemblyChip.title}`);
    process.exit(1);
  }
  console.log('  ok: title carries dataset_id + provenance');

  // Other chips unchanged
  const otherChip = chips.find(c => c.getAttribute('data-ga-layer') === 'gene_track');
  eq(otherChip.textContent, '⚪ not loaded', 'unmatched chips stay at scaffold');
  eq(otherChip.classList.contains('ga-layer-loaded'), false, 'unmatched chips not flagged loaded');
}

console.log('multiple envelopes, multiple matching chips:');
{
  _reset();
  _route(
    () => true,
    () => ({ body: { layers: [
      { layer_id: 'genome_table_main_226_hatchery_assembly_stats_a',
        layer_type: 'genome_table', stage: 'staging', dataset_id: 'main_226_hatchery' },
      { layer_id: 'genome_table_main_226_hatchery_synteny_blocks_b',
        layer_type: 'genome_table', stage: 'staging', dataset_id: 'main_226_hatchery' },
      { layer_id: 'genome_table_main_226_hatchery_repeat_track_c',
        layer_type: 'genome_table', stage: 'staging', dataset_id: 'main_226_hatchery' },
    ], n: 3, total: 3 } }),
  );
  const chips = KNOWN.map(s => new FakeChip(s));
  await _lightUpLayerChips(new FakeRoot(chips));
  for (const s of ['assembly_stats', 'synteny_blocks', 'repeat_track']) {
    const c = chips.find(x => x.getAttribute('data-ga-layer') === s);
    if (!c.textContent.startsWith('●')) {
      console.error(`FAIL: chip ${s} not lit, got: ${c.textContent}`);
      process.exit(1);
    }
    console.log(`  ok: ${s} lit`);
  }
  const dim = chips.find(c => c.getAttribute('data-ga-layer') === 'variant_annotations');
  eq(dim.textContent, '⚪ not loaded', 'variant_annotations stayed dim (no envelope)');
}

console.log('most-recent wins per subject (later index row overrides):');
{
  _reset();
  _route(
    () => true,
    () => ({ body: { layers: [
      { layer_id: 'genome_table_main_226_hatchery_assembly_stats_old',
        layer_type: 'genome_table', stage: 'staging', dataset_id: 'main_226_hatchery',
        created_at: '2026-05-12T00:00:00Z' },
      { layer_id: 'genome_table_main_226_hatchery_assembly_stats_new',
        layer_type: 'genome_table', stage: 'staging', dataset_id: 'main_226_hatchery',
        created_at: '2026-05-14T15:00:00Z' },
    ], n: 2, total: 2 } }),
  );
  const chips = KNOWN.map(s => new FakeChip(s));
  await _lightUpLayerChips(new FakeRoot(chips));
  const c = chips.find(x => x.getAttribute('data-ga-layer') === 'assembly_stats');
  if (!c.textContent.includes('_new')) {
    console.error(`FAIL: should show newer envelope, got: ${c.textContent}`);
    process.exit(1);
  }
  console.log('  ok: later index row wins (last write per subject)');
}

console.log('fetch error → all chips remain scaffold (fail-soft):');
{
  _reset();
  _route(() => true, () => ({ status: 503, text: 'service unavailable' }));
  const chips = KNOWN.map(s => new FakeChip(s));
  await _lightUpLayerChips(new FakeRoot(chips));
  for (const c of chips) {
    eq(c.textContent, '⚪ not loaded', `${c.getAttribute('data-ga-layer')} stayed dim`);
  }
}

console.log('listLayers returns empty → no chips changed:');
{
  _reset();
  _route(() => true, () => ({ body: { layers: [], n: 0, total: 0 } }));
  const chips = KNOWN.map(s => new FakeChip(s));
  await _lightUpLayerChips(new FakeRoot(chips));
  for (const c of chips) {
    eq(c.textContent, '⚪ not loaded', `${c.getAttribute('data-ga-layer')} stayed dim on empty`);
  }
}

console.log('null root → no throw:');
{
  _reset();
  _route(() => true, () => ({ body: { layers: [], n: 0, total: 0 } }));
  await _lightUpLayerChips(null);
  console.log('  ok: null root handled');
  await _lightUpLayerChips(undefined);
  console.log('  ok: undefined root handled');
}

console.log('subject heuristic — unknown layer_id pattern:');
{
  eq(_subjectFromLayerId('genome_table_x_assembly_stats_y'), 'assembly_stats', 'matches embedded subject');
  eq(_subjectFromLayerId('genome_table_x_random_y'), '', 'unknown subject → empty');
  eq(_subjectFromLayerId(''), '', 'empty id → empty');
}

console.log('\nALL OK');
