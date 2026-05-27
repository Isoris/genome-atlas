// test/cross-atlas.test.js
// Tests for atlases/genome/shared/cross-atlas.js — the document-level
// event router that normalises page-level CustomEvents into a unified
// active-candidate / active-chrom state with onActiveCandidate /
// onActiveChrom subscription channels.

import { test, assert, assertEq } from './_assert.js';
import { installDom, resetDom } from './_dom-stub.js';

async function freshRouter() {
  installDom();
  const ca = await import('../atlases/genome/shared/cross-atlas.js');
  ca._resetForTests();
  return ca;
}

test('cross-atlas: candidate event sets active candidate + chrom', async () => {
  const ca = await freshRouter();
  ca.installRouter();
  document.dispatchEvent(new CustomEvent('ga-cargo-cand-click', {
    detail: { candidate: { id: 'cand:01', chrom: 'Gar_3' } },
  }));
  assertEq(ca.getActiveCandidate().id, 'cand:01');
  assertEq(ca.getActiveChrom().chrom, 'Gar_3', 'candidate carries chrom');
});

test('cross-atlas: chrom event sets chrom only, leaves candidate untouched', async () => {
  const ca = await freshRouter();
  ca.installRouter();
  // Seed a candidate, then fire a pure chrom event.
  ca.setActiveCandidate({ id: 'cand:01', chrom: 'Gar_3' }, 'test');
  document.dispatchEvent(new CustomEvent('ga-strip-chrom-click', {
    detail: { chrom: 'Mac_5', hap: 'Mac' },
  }));
  assertEq(ca.getActiveCandidate().id, 'cand:01', 'candidate preserved');
  assertEq(ca.getActiveChrom().chrom, 'Mac_5', 'chrom updated');
  assertEq(ca.getActiveChrom().hap, 'Mac');
});

test('cross-atlas: subscribers fire on every update', async () => {
  const ca = await freshRouter();
  ca.installRouter();
  const heard = [];
  ca.onActiveCandidate((p) => heard.push(['cand', p.candidate && p.candidate.id, p.source]));
  ca.onActiveChrom((p) => heard.push(['chrom', p.chrom, p.source]));
  document.dispatchEvent(new CustomEvent('ga-impact-cand-click', {
    detail: { candidate: { id: 'cand:02', chrom: 'Gar_11' } },
  }));
  // candidate-via-router also sets chrom from the candidate, so we expect both.
  const sources = heard.map((h) => h[2]);
  assert(sources.indexOf('page7:impact') >= 0, 'page7:impact source recorded');
  assert(heard.some((h) => h[0] === 'cand' && h[1] === 'cand:02'), 'candidate subscriber fired');
  assert(heard.some((h) => h[0] === 'chrom' && h[1] === 'Gar_11'), 'chrom subscriber fired');
});

test('cross-atlas: installRouter idempotent', async () => {
  const ca = await freshRouter();
  ca.installRouter();
  ca.installRouter();   // must not throw, must not double-listen
  let count = 0;
  ca.onActiveCandidate(() => count++);
  document.dispatchEvent(new CustomEvent('ga-cargo-cand-click', {
    detail: { candidate: { id: 'cand:01', chrom: 'Gar_3' } },
  }));
  assertEq(count, 1, 'single subscriber notification per event');
});

test('cross-atlas: Escape on non-form target clears both slots', async () => {
  const ca = await freshRouter();
  ca.installRouter();
  ca.setActiveCandidate({ id: 'cand:01', chrom: 'Gar_3' }, 'test');
  document.dispatchEvent(Object.assign(new CustomEvent('keydown'), {
    key: 'Escape', target: { tagName: 'DIV' },
  }));
  assertEq(ca.getActiveCandidate(), null);
  assertEq(ca.getActiveChrom(), null);
});

test('cross-atlas: Escape from inside <input> is ignored', async () => {
  const ca = await freshRouter();
  ca.installRouter();
  ca.setActiveCandidate({ id: 'cand:02', chrom: 'Gar_11' }, 'test');
  document.dispatchEvent(Object.assign(new CustomEvent('keydown'), {
    key: 'Escape', target: { tagName: 'INPUT' },
  }));
  assertEq(ca.getActiveCandidate().id, 'cand:02', 'selection preserved');
});

test('cross-atlas: clearAll dispatches document events', async () => {
  const ca = await freshRouter();
  ca.installRouter();
  ca.setActiveCandidate({ id: 'cand:01', chrom: 'Gar_3' }, 'test');
  const heard = [];
  document.addEventListener('ga-genome-active-candidate', (ev) => heard.push(['cand', ev.detail]));
  document.addEventListener('ga-genome-active-chrom',     (ev) => heard.push(['chrom', ev.detail]));
  ca.clearAll('test:clear');
  assert(heard.some((h) => h[0] === 'cand' && h[1].candidate === null), 'candidate event dispatched');
  assert(heard.some((h) => h[0] === 'chrom' && h[1].chrom === null), 'chrom event dispatched');
});
