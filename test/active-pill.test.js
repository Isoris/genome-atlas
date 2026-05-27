// test/active-pill.test.js
// Tests for atlases/genome/shared/active-pill.js — the bottom-right
// status chip that surfaces the router state.

import { test, assert, assertEq } from './_assert.js';
import { installDom, resetDom, getDocumentBody } from './_dom-stub.js';

async function fresh() {
  installDom();
  const ca = await import('../atlases/genome/shared/cross-atlas.js');
  const ap = await import('../atlases/genome/shared/active-pill.js');
  ca._resetForTests();
  ap._resetForTests();
  ca.installRouter();
  ap.installActivePill();
  return { ca, ap, body: getDocumentBody() };
}

test('active-pill: idempotent install adds exactly one pill to body', async () => {
  const { ap, body } = await fresh();
  ap.installActivePill();    // second call
  ap.installActivePill();    // third call
  const pills = body.children.filter((c) => c.classList.contains('ga-active-pill'));
  assertEq(pills.length, 1);
});

test('active-pill: hidden in neutral state', async () => {
  const { body } = await fresh();
  const pill = body.children.find((c) => c.classList.contains('ga-active-pill'));
  assert(pill.hidden, 'pill starts hidden');
});

test('active-pill: shows candidate id + chrom on selection', async () => {
  const { body } = await fresh();
  document.dispatchEvent(new CustomEvent('ga-cargo-cand-click', {
    detail: { candidate: { id: 'cand:02', chrom: 'Gar_11', label: 'cand-02' } },
  }));
  const pill = body.children.find((c) => c.classList.contains('ga-active-pill'));
  assert(!pill.hidden, 'pill visible');
  const label = pill.children.find((c) => c.classList.contains('ga-active-pill-label'));
  const idEl = label.children.find((c) => c.classList.contains('ga-active-pill-id'));
  const chromEl = label.children.find((c) => c.classList.contains('ga-active-pill-chrom'));
  assertEq(idEl.textContent, 'cand-02');
  assertEq(chromEl.textContent, 'Gar_11');
});

test('active-pill: close button clears all and re-hides', async () => {
  const { ca, body } = await fresh();
  document.dispatchEvent(new CustomEvent('ga-cargo-cand-click', {
    detail: { candidate: { id: 'cand:01', chrom: 'Gar_3', label: 'cand-01' } },
  }));
  const pill = body.children.find((c) => c.classList.contains('ga-active-pill'));
  const close = pill.children.find((c) => c.classList.contains('ga-active-pill-close'));
  close._listeners.click[0]();
  assertEq(ca.getActiveCandidate(), null);
  assertEq(ca.getActiveChrom(), null);
  assert(pill.hidden, 'pill hidden after close');
});

test('active-pill: chrom-only event renders chrom badge without id', async () => {
  const { body } = await fresh();
  document.dispatchEvent(new CustomEvent('ga-strip-chrom-click', {
    detail: { chrom: 'Mac_5', hap: 'Mac' },
  }));
  const pill = body.children.find((c) => c.classList.contains('ga-active-pill'));
  const label = pill.children.find((c) => c.classList.contains('ga-active-pill-label'));
  const idEl = label.children.find((c) => c.classList.contains('ga-active-pill-id'));
  const chromEl = label.children.find((c) => c.classList.contains('ga-active-pill-chrom'));
  assert(!idEl, 'no id label for chrom-only event');
  assertEq(chromEl.textContent, 'Mac_5');
});
