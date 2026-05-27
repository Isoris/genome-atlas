// test/candidates.test.js
// Tests for atlases/genome/shared/candidates.js — the canonical sample
// candidate set + resolveCandidates state-derived helper.

import { test, assert, assertEq } from './_assert.js';
import { installDom, resetDom } from './_dom-stub.js';

test('candidates: fallback shape', async () => {
  installDom();
  const c = await import('../atlases/genome/shared/candidates.js');
  assertEq(c.CANDIDATES_FALLBACK.length, 3, 'three demo candidates');
  for (const cand of c.CANDIDATES_FALLBACK) {
    assert(cand.id, 'each candidate has an id');
    assert(cand.chrom, 'each candidate has a chrom');
    assert(typeof cand.start_bp === 'number', 'start_bp numeric');
    assert(typeof cand.end_bp === 'number', 'end_bp numeric');
    assert(Array.isArray(cand.envelope), 'envelope present');
  }
});

test('candidates: resolveCandidates default → fallback', async () => {
  resetDom();
  const c = await import('../atlases/genome/shared/candidates.js');
  const arr = c.resolveCandidates({});
  assert(arr === c.CANDIDATES_FALLBACK, 'default reference equals fallback');
  assert(c.isFallback(arr), 'isFallback() agrees');
});

test('candidates: resolveCandidates with shared.candidates wins', async () => {
  resetDom();
  const c = await import('../atlases/genome/shared/candidates.js');
  const real = [{ id: 'real:01' }];
  const arr = c.resolveCandidates({ shared: { candidates: real } });
  assert(arr === real, 'returns caller data');
  assert(!c.isFallback(arr), 'isFallback() returns false');
});

test('candidates: resolveCandidates ignores empty array', async () => {
  resetDom();
  const c = await import('../atlases/genome/shared/candidates.js');
  const arr = c.resolveCandidates({ shared: { candidates: [] } });
  assert(arr === c.CANDIDATES_FALLBACK, 'empty array falls back');
});
