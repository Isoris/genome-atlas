// test/_dom-stub.js
// Minimal DOM stub for headless smoke tests. NOT a real DOM — just enough
// for the genome-atlas page modules to mount, draw their SVG, dispatch
// CustomEvents, and have selectors / event listeners / classList work.
//
// What it implements (good enough for our renderers):
//   - createElement / createElementNS / appendChild / removeChild
//   - setAttribute / getAttribute / .dataset / .className / .classList
//   - addEventListener / removeEventListener / dispatchEvent (with bubbling)
//   - querySelector / querySelectorAll (subset: tag, .class, [attr], [attr="v"])
//   - .closest, .matches
//   - .textContent / .innerHTML setters (innerHTML is a no-op for content)
//   - .hidden, .checked, .value getters/setters
//   - .scrollIntoView (records that it was called)
//   - .getBoundingClientRect (returns a fixed origin-rect)
//   - document.body
//
// Usage:
//   import { installDom, resetDom } from './_dom-stub.js';
//   installDom();
//   ...
//   resetDom();

export class El {
  constructor(tag, ns) {
    this.tag = tag;
    this.ns = ns || null;
    this.children = [];
    this.attrs = {};
    this.dataset = {};
    this.style = {};
    this.parent = null;
    this._listeners = {};
    this._text = '';
    this._html = '';
    this._hidden = false;
    this._scrolled = false;
    this._value = '';
    this.checked = false;
    this.open = false;
    const self = this;
    this.classList = {
      _set: new Set(),
      add: (c) => self.classList._set.add(c),
      remove: (c) => self.classList._set.delete(c),
      contains: (c) => self.classList._set.has(c),
      toggle: (c, force) => {
        const want = force === undefined ? !self.classList._set.has(c) : force;
        if (want) self.classList._set.add(c);
        else self.classList._set.delete(c);
      },
    };
  }
  // Attributes
  setAttribute(k, v) {
    this.attrs[k] = v;
    if (k.startsWith('data-')) {
      const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[camel] = v;
    }
    if (k === 'class') {
      String(v).split(/\s+/).filter(Boolean).forEach((c) => this.classList._set.add(c));
    }
  }
  removeAttribute(k) { delete this.attrs[k]; }
  getAttribute(k) { return this.attrs[k]; }
  set className(v) { this.setAttribute('class', v); }

  // DOM tree
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  insertBefore(c, ref) {
    c.parent = this;
    if (!ref) { this.children.push(c); return c; }
    const i = this.children.indexOf(ref);
    this.children.splice(i < 0 ? this.children.length : i, 0, c);
    return c;
  }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) { this.children.splice(i, 1); c.parent = null; }
    return c;
  }
  get firstChild() { return this.children[0]; }
  get parentNode() { return this.parent; }
  set textContent(v) { this._text = v; this.children = []; }
  get textContent() { return this._text; }
  set innerHTML(v) { this._html = v; }
  set hidden(v) { this._hidden = !!v; if (v) this.attrs.hidden = ''; else delete this.attrs.hidden; }
  get hidden() { return !!this._hidden; }
  set value(v) { this._value = v; this.attrs.value = v; }
  get value() { return this._value; }

  // Events
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  removeEventListener(t, fn) {
    this._listeners[t] = (this._listeners[t] || []).filter((x) => x !== fn);
  }
  dispatchEvent(ev) {
    const ls = this._listeners[ev.type] || [];
    for (const f of ls) f(ev);
    if (ev.bubbles && this.parent) this.parent.dispatchEvent(ev);
    return true;
  }

  // Selectors
  closest(selector) {
    const sels = selector.split(',').map((s) => s.trim());
    let n = this;
    while (n) {
      for (const s of sels) if (_matchSelector(n, s)) return n;
      n = n.parent;
    }
    return null;
  }
  matches(selector) {
    const sels = selector.split(',').map((s) => s.trim());
    for (const s of sels) if (_matchSelector(this, s)) return true;
    return false;
  }
  querySelector(selector) {
    const sels = selector.split(',').map((s) => s.trim());
    for (const s of sels) {
      const r = _findFirst(this, s);
      if (r) return r;
    }
    return null;
  }
  querySelectorAll(selector) {
    const sels = selector.split(',').map((s) => s.trim());
    const out = [];
    for (const s of sels) _findAll(this, s, out);
    return out;
  }

  // Layout
  scrollIntoView() { this._scrolled = true; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 500 }; }
}

function _matchSelector(node, s) {
  // Iteratively parse [tag][.cls]*[[attr]]?  — supports `.foo.bar` and
  // `.foo[data-x]` style compound selectors as the real-page renderers
  // rely on (e.g. `.ga-cargo-tr.is-active`).
  let rest = s;
  let tag = null;
  const classes = [];
  let attr = null;
  let m = rest.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
  if (m) { tag = m[1]; rest = rest.slice(m[0].length); }
  while ((m = rest.match(/^\.([a-zA-Z0-9_-]+)/))) {
    classes.push(m[1]);
    rest = rest.slice(m[0].length);
  }
  if ((m = rest.match(/^\[([^\]]+)\]/))) {
    attr = m[1];
    rest = rest.slice(m[0].length);
  }
  if (rest.length > 0) return false;
  if (tag && node.tag !== tag) return false;
  for (const c of classes) if (!node.classList._set.has(c)) return false;
  if (attr) {
    const eq = attr.indexOf('=');
    if (eq === -1) {
      if (!(attr in node.attrs)) return false;
    } else {
      let v = attr.slice(eq + 1);
      if (v.startsWith('"')) v = v.slice(1, -1);
      if (node.attrs[attr.slice(0, eq)] !== v) return false;
    }
  }
  return true;
}
function _findFirst(root, s) {
  for (const c of root.children) {
    if (_matchSelector(c, s)) return c;
    const sub = _findFirst(c, s);
    if (sub) return sub;
  }
  return null;
}
function _findAll(root, s, out) {
  for (const c of root.children) {
    if (_matchSelector(c, s)) out.push(c);
    _findAll(c, s, out);
  }
}

let _docListeners = {};
let _body = null;
let _installed = false;

export function installDom() {
  _body = new El('body');
  _docListeners = {};
  globalThis.document = {
    body: _body,
    createElement: (t) => new El(t, null),
    createElementNS: (ns, t) => new El(t, ns),
    querySelector: (s) => _findFirst(_body, s),
    addEventListener(t, fn) { (_docListeners[t] = _docListeners[t] || []).push(fn); },
    removeEventListener(t, fn) {
      _docListeners[t] = (_docListeners[t] || []).filter((x) => x !== fn);
    },
    dispatchEvent(ev) {
      const ls = _docListeners[ev.type] || [];
      for (const f of ls) f(ev);
      return true;
    },
  };
  globalThis.CustomEvent = class {
    constructor(type, init) {
      this.type = type;
      this.bubbles = !!(init && init.bubbles);
      this.detail = init && init.detail;
    }
  };
  _installed = true;
}

export function resetDom() {
  installDom();   // wipes body + listeners
}

export function getDocumentBody() { return _body; }
