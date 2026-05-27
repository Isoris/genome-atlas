# Genome Atlas headless tests

Tiny no-framework smoke tests for the shared modules and cross-page
integration. Pure ESM, run with stock Node ≥ 18.

```bash
node test/run.js
```

Exit code is non-zero on any failure. No `package.json` / `npm install`
required — `_dom-stub.js` ships a minimal DOM that's just enough for
the renderers to mount, draw their SVG, dispatch CustomEvents, and have
selectors / classList / addEventListener work.

## Suites

| file | covers |
| --- | --- |
| `candidates.test.js` | `shared/candidates.js` — canonical fallback + `resolveCandidates` |
| `cross-atlas.test.js` | `shared/cross-atlas.js` — router, subscribers, idempotency, Escape |
| `active-pill.test.js` | `shared/active-pill.js` — pill install, redraw, close button |
| `page-index.test.js` | `shared/page-index.js` — nav build, active chip, capability badges |
| `integration.test.js` | mounts page 5 + page 3 against the same document, verifies cross-page highlights + Escape clear |

## Adding a test

1. Drop a new `name.test.js` next to the others.
2. Inside, `import { test, assert, assertEq } from './_assert.js';` and
   `import { installDom } from './_dom-stub.js';`.
3. Each `test('name', async () => { ... })` registers a case.
4. The runner discovers `*.test.js` alphabetically.

## DOM stub coverage

The stub implements only what the renderers actually use:

- `createElement` / `createElementNS` / `appendChild` / `removeChild` / `insertBefore`
- `setAttribute` / `getAttribute` / `.dataset` (camel-case from `data-*`) / `.className`
- `.classList` (`add` / `remove` / `contains` / `toggle` with force arg)
- `addEventListener` / `removeEventListener` / `dispatchEvent` (with bubbling up parent chain)
- `querySelector` / `querySelectorAll` / `closest` / `matches` — supports `tag.class.class[attr]` compound selectors
- `.textContent`, `.innerHTML` (write-only), `.hidden`, `.checked`, `.value`
- `.scrollIntoView()` (records call on the element as `._scrolled`)
- `.getBoundingClientRect()` (fixed origin-rect)
- `document.body`, `document.addEventListener` / `dispatchEvent`
- `CustomEvent`

If a renderer starts using something the stub doesn't expose (e.g.
`MutationObserver`, real layout, native CSS), the test will surface
the gap — the stub stays small on purpose so it's easy to read.
