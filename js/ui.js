// Shared UI: DOM helpers, fields (driven by the built-in keypad), results, controls.
import { isValidAmerican } from './math.js';
import { fmtMoney, fmtUnits, fmtOdds, toAscii } from './format.js';

export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    e.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return e;
}

export function svg(path, size = 22) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = path;
  return s;
}

export function parseNum(str) {
  if (str == null) return NaN;
  const s = String(str).replace(/[,$\s¢%u]/g, '');
  if (s === '' || s === '.' || s === '-') return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function trimNum(n, d = 2) {
  if (!Number.isFinite(n)) return '';
  const s = n.toFixed(d).replace(/\.?0+$/, '');
  return s === '' ? '0' : s;
}

export function debounce(fn, ms = 80) {
  let t = null;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ---------- Field: a tappable value edited with the built-in keypad ----------
// type: 'odds' (sign + digits), 'money' (dollars or units), 'percent' (decimal with a suffix)
export function field({ type, label, value, ctx, keypad, onChange, placeholder = '', suffix = '', prefix = '', maxLen, compact = false, chips = null, noAdvance = false, hint = '' }) {
  const state = type === 'odds'
    ? { sign: value?.sign === '+' ? '+' : '-', v: value?.v ?? '', ghost: !!value?.ghost }
    : type === 'money'
      ? { v: value?.v ?? '', mode: value?.mode === 'u' ? 'u' : '$', exact: null, ghost: !!value?.ghost }
      : { v: (typeof value === 'object' && value !== null) ? (value.v ?? '') : (value ?? ''), ghost: !!(value && value.ghost) };

  const labelTextEl = h('span', { class: 'fld-label-text', text: label });
  const tagEl = h('span', { class: 'fld-tag', text: '\u00B7 example', hidden: true });
  const labelEl = h('span', { class: 'fld-label' }, labelTextEl, tagEl);
  const signEl = h('span', { class: 'fld-sign' });
  const prefixEl = h('span', { class: 'fld-affix' });
  const valueEl = h('span', { class: 'fld-value' });
  const suffixEl = h('span', { class: 'fld-affix fld-suffix' });
  const caret = h('span', { class: 'fld-caret', 'aria-hidden': 'true' });
  const subEl = h('span', { class: 'fld-sub' });
  const el = h('button', { type: 'button', class: 'fld fld-' + type + (compact ? ' fld-compact' : ''), 'aria-label': label },
    labelEl,
    h('span', { class: 'fld-row' }, signEl, prefixEl, valueEl, caret, suffixEl),
    subEl
  );
  el.addEventListener('click', () => keypad.focus(api));
  el.addEventListener('pointerdown', (e) => e.preventDefault());   // no stuck focus ring after Done
  let labelText = label;

  let pendingUnits = false;
  const api = {
    el, root: el, type, prefix, maxLen: maxLen || (type === 'odds' ? 6 : type === 'money' ? 10 : 6), suffix, chips, noAdvance,
    get mode() { return state.mode; },
    text: () => state.v,
    isGhost: () => state.ghost,
    setText(t) { state.v = t; state.exact = null; state.ghost = false; paint(); onChange(get()); },
    setRaw(raw) {
      if (type === 'odds') { state.sign = raw.sign; state.v = raw.v; }
      else { state.v = String(raw); state.exact = null; }
      state.ghost = false;
      paint(); onChange(get());
    },
    toggleMode(convert = false) {
      if (type === 'odds') { state.sign = state.sign === '-' ? '+' : '-'; state.ghost = false; paint(); onChange(get()); keypad.refresh(); }
      else if (type === 'money') setMode(state.mode === '$' ? 'u' : '$', convert);
    },
    setActive(on) {
      el.classList.toggle('is-active', on); if (!on) el.classList.remove('is-fresh');
      // Units first: a stake you tap is offered in units, so typing 2 means 2u (the $ key switches back for one entry).
      if (on && type === 'money' && state.mode === '$' && ctx?.leadUnits?.() && ctx.unitSize() > 0) {
        const n = parseNum(state.v);
        if (Number.isFinite(n)) state.v = trimNum(n / ctx.unitSize(), 2);
        state.mode = 'u'; paint(); onChange(get()); keypad.refresh();
      }
    },
    setFresh(on) { el.classList.toggle('is-fresh', !!on && state.v !== ''); },
    commit() { paint(true); },
    reveal() {
      setTimeout(() => {
        const screen = el.closest('.screen, .sheet-body');
        if (!screen) return;
        const ans = [...screen.querySelectorAll('.answer')].find((a) => a.offsetParent !== null);
        const topEdge = ans ? ans.getBoundingClientRect().bottom : screen.getBoundingClientRect().top;
        const r = el.getBoundingClientRect(), sr = screen.getBoundingClientRect();
        const m = document.getElementById('app')?.classList.contains('tight') ? 8 : 18;
        if (r.top < topEdge + m) screen.scrollBy({ top: r.top - topEdge - m, behavior: 'auto' });
        // The bottom edge wins: the value being typed must never sit under the keypad.
        // A row half-hidden under the answer looks like a glitch: scroll it fully out of the way when the slot below still fits.
        const row = el.closest('.row-2, .leg') || el;
        const prev = row.previousElementSibling;
        if (prev) {
          const pr = prev.getBoundingClientRect();
          if (pr.bottom > topEdge && pr.top < topEdge) {
            const extra = pr.bottom - topEdge + 2;
            if (el.getBoundingClientRect().bottom + extra <= sr.bottom - 6) screen.scrollBy({ top: extra, behavior: 'auto' });
          }
        }
        const r2 = el.getBoundingClientRect();
        if (r2.bottom > sr.bottom - 6) screen.scrollBy({ top: r2.bottom - sr.bottom + 6, behavior: 'auto' });
      }, 40);
    },
    get, set, setLabel, paint, setSuffix, setSub,
    setSign(sign) { if (type === 'odds') { state.sign = sign; paint(); } },
    chooseSign(sign) { if (type === 'odds') { state.sign = sign; state.ghost = false; paint(); onChange(get()); keypad.refresh(); } },
    get sign() { return state.sign; },
    value: () => (type === 'odds' ? oddsValue(get()) : type === 'money' ? stakeDollars(get(), ctx?.unitSize?.() || 0) : parseNum(state.v)),
  };

  function get() {
    if (type === 'odds') return { sign: state.sign, v: state.v, ghost: state.ghost };
    if (type === 'money') return { v: state.v, mode: state.mode, ghost: state.ghost };
    return { v: state.v, ghost: state.ghost };
  }
  function set(v) {
    if (type === 'odds') { state.sign = v?.sign === '+' ? '+' : '-'; state.v = v?.v ?? ''; state.ghost = !!v?.ghost; }
    else if (type === 'money') { state.v = v?.v ?? ''; state.mode = v?.mode === 'u' ? 'u' : '$'; state.ghost = !!v?.ghost; }
    else { state.v = (typeof v === 'object' && v !== null) ? (v.v ?? '') : (v ?? ''); state.ghost = !!(v && v.ghost); }
    paint();
  }
  function setLabel(t) { labelText = t; paintLabel(); el.setAttribute('aria-label', t); }
  let tagTimer = 0;
  function paintLabel() {
    labelTextEl.textContent = labelText;
    const show = state.ghost && state.v !== '';
    tagEl.hidden = !show;
    if (!show) return;
    // If the name and the tag do not both fit, the name wins and the tag steps aside (the Example pill still shows).
    clearTimeout(tagTimer);
    tagTimer = setTimeout(fitTag, 0);
  }
  function fitTag() {
    if (tagEl.hidden || !labelEl.isConnected || el.offsetParent === null) return;
    if (labelTextEl.scrollWidth > labelTextEl.clientWidth + 1) tagEl.hidden = true;
  }
  // The tag is re-checked whenever the slot is laid out (first paint, tab switch, resize, two-column legs).
  if ('ResizeObserver' in window) new ResizeObserver(() => { if (state.ghost && state.v !== '' && tagEl.hidden) { tagEl.hidden = false; } fitTag(); }).observe(el);
  function setSuffix(s) { suffix = s; api.suffix = s; paint(); if (keypad.active?.() === api) keypad.refresh(); }
  function setSub(t, cls = '') { const txt = t || (state.v === '' ? hint : '') || ''; subEl.textContent = txt; subEl.className = 'fld-sub' + (cls ? ' ' + cls : ''); subEl.hidden = !txt && type === 'odds'; }

  function setMode(mode, convert = false) {
    if (state.mode === mode) return;
    const unit = ctx.unitSize();
    if (mode === 'u' && !(unit > 0)) { pendingUnits = true; toast('Set a unit size first', 2200); ctx.openSettings('unit'); return; }
    // Digits typed just now keep their digits (2 then u is 2u). An amount that was already there keeps its money ($50 becomes 2u).
    if (convert && unit > 0) { const n = parseNum(state.v); if (Number.isFinite(n)) state.v = trimNum(mode === 'u' ? n / unit : n * unit, 2); }
    state.mode = mode;
    paint(); onChange(get()); keypad.refresh();
  }

  function paint(final = false) {
    const empty = state.v === '';
    el.classList.toggle('is-empty', empty);
    el.classList.toggle('is-ghost', state.ghost && !empty);
    paintLabel();
    valueEl.textContent = empty ? (placeholder || (type === 'odds' ? '\u2014' : '0')) : (type === 'odds' ? state.v : withCommas(state.v));
    el.classList.toggle('is-long', !empty && state.v.length >= 8);
    el.classList.toggle('is-xlong', !empty && state.v.length >= 11);
    if (type === 'odds') {
      signEl.textContent = state.sign === '-' ? '−' : '+';
      signEl.classList.toggle('is-plus', state.sign === '+');
      prefixEl.textContent = ''; suffixEl.textContent = '';
      const n = parseNum(state.v);
      const bad = !empty && Number.isFinite(n) && n < 100 && (final || state.v.length >= 3 || !el.classList.contains('is-active'));
      el.classList.toggle('is-invalid', bad);
      setSub(bad ? 'Odds start at 100' : '', bad ? 'is-error' : '');
    } else if (type === 'money') {
      const unit = ctx.unitSize();
      if (pendingUnits && !ctx.settingsOpen()) {
        pendingUnits = false;
        if (unit > 0 && state.mode === '$') {
          // Finishing a pending switch converts the dollars typed earlier into units.
          const n = parseNum(state.v);
          if (Number.isFinite(n)) state.v = trimNum(n / unit, 2);
          state.mode = 'u'; paint(); onChange(get()); keypad.refresh(); return;
        }
      }
      signEl.textContent = '';
      prefixEl.textContent = state.mode === '$' ? '$' : '';
      suffixEl.textContent = state.mode === 'u' ? 'u' : '';
      el.classList.remove('is-invalid');
      const n = parseNum(state.v);
      if (state.mode === 'u' && !(unit > 0)) setSub('Set a unit size', 'is-link');
      else if (Number.isFinite(n) && unit > 0) setSub(state.mode === '$' ? '= ' + fmtUnits(n / unit) : '= ' + fmtMoney(n * unit));
      else setSub('');
    } else {
      signEl.textContent = ''; prefixEl.textContent = prefix;
      suffixEl.textContent = suffix;
      el.classList.remove('is-invalid');
    }
  }
  subEl.addEventListener('click', (e) => { if (subEl.classList.contains('is-link')) { e.stopPropagation(); ctx.openSettings('unit'); } });
  paint();
  return api;
}

function withCommas(v) {
  const [i, d] = String(v).split('.');
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return d != null ? int + '.' + d : int;
}

export function oddsValue(s) {
  const m = parseNum(s?.v);
  if (!Number.isFinite(m)) return NaN;
  const am = (s.sign === '-' ? -1 : 1) * m;
  return isValidAmerican(am) ? am : NaN;
}
export function stakeDollars(s, unitSize) {
  const n = parseNum(s?.v);
  if (!Number.isFinite(n)) return NaN;
  if (s.mode === 'u') return unitSize > 0 ? n * unitSize : NaN;
  return n;
}

// ---------- Segmented control ----------
export function segmented({ options, value, onChange, cls = '', label = '' }) {
  const btns = options.map((o) =>
    h('button', { type: 'button', class: 'seg-btn', text: o.label, 'data-id': o.id, onclick: () => set(o.id, true) })
  );
  const root = h('div', { class: 'seg ' + cls, role: 'group', 'aria-label': label || null }, btns);
  let current = value;
  function set(id, fire = false) {
    current = id;
    btns.forEach((b) => { const on = b.dataset.id === id; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    if (fire) onChange(id);
  }
  set(value);
  return { root, set, get: () => current };
}

// ---------- Result: tap to copy ----------
const FITTERS = new Set();
export function refitResults() { FITTERS.forEach((f) => f()); }
export function result({ label, hero = false, cls = '', mini = '' }) {
  const labelEl = h('span', { class: 'res-label', text: label });
  const valueEl = h('span', { class: 'res-value', text: '—' });
  const subEl = h('span', { class: 'res-sub', hidden: true });
  const root = h('button', { type: 'button', class: 'res ' + (hero ? 'res-hero ' : '') + cls, 'aria-label': label + ', tap to copy' }, labelEl, valueEl, subEl);
  root.addEventListener('pointerdown', (e) => e.preventDefault());
  if (mini) root.dataset.mini = mini;
  let copy = null, currentLabel = label, flashTimer = null, fitTimer = 0;
  root.addEventListener('click', () => {
    if (copy == null) return;
    copyText(copy).then(() => {
      toast('Copied ' + copy);
      root.classList.add('is-copied');
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => root.classList.remove('is-copied'), 700);
    });
  });
  let fitHeroTimer = 0;
  function fitHero() {
    clearTimeout(fitHeroTimer);
    fitHeroTimer = setTimeout(() => {
      valueEl.style.fontSize = '';
      if (!valueEl.isConnected || valueEl.offsetParent === null) return;
      const ratio = valueEl.clientWidth / Math.max(1, valueEl.scrollWidth);
      if (ratio < 1) valueEl.style.fontSize = (parseFloat(getComputedStyle(valueEl).fontSize) * ratio * 0.97) + 'px';
    }, 0);
  }
  function fitSub() {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => {
      if (subEl.hidden || !subEl.isConnected) return;
      let guard = 6;
      while (guard-- > 0 && subEl.scrollHeight > subEl.clientHeight + 1 && subEl.textContent.includes(' · ')) {
        subEl.textContent = subEl.textContent.slice(0, subEl.textContent.lastIndexOf(' · '));
      }
      if (subEl.scrollHeight > subEl.clientHeight + 1 || subEl.scrollWidth > subEl.clientWidth + 1) subEl.hidden = true;
    }, 0);
  }
  function set(display, copyValue = display, sub = '', tone = '') {
    if (hero && valueEl.textContent !== display && display !== '—') { valueEl.classList.remove('tick'); void valueEl.offsetWidth; valueEl.classList.add('tick'); }
    valueEl.textContent = display;
    fitHero();
    if (!hero) {
      root.classList.toggle('is-long', display.length >= 10);
      root.classList.toggle('is-xlong', display.length >= 13);
      root.classList.toggle('is-xxlong', display.length >= 15);
      root.classList.toggle('is-xxxlong', display.length >= 18);
    }
    copy = display === '—' ? null : toAscii(copyValue);
    subEl.textContent = sub || '';
    subEl.hidden = !sub;
    if (sub && !hero) fitSub();
    root.classList.toggle('is-empty', display === '—');
    root.classList.remove('tone-pos', 'tone-neg', 'tone-accent', 'tone-muted');
    if (tone) root.classList.add('tone-' + tone);
  }
  function setLabel(t) { currentLabel = t; labelEl.textContent = t; root.setAttribute('aria-label', t + ', tap to copy'); }
  set('—');
  FITTERS.add(fitHero);
  return { root, set, setLabel, setMini: (t) => { root.dataset.mini = t; }, hide: (on) => { root.hidden = !!on; } };
}

export function setMoney(res, dollars, unitSize, { signed = false, tone = 'auto', sub = '', unitsFirst = true, leadUnits = false } = {}) {
  if (!Number.isFinite(dollars)) { res.set('—'); return; }
  const lead = leadUnits && unitSize > 0;
  const display = lead ? fmtUnits(dollars / unitSize, { signed }) : fmtMoney(dollars, { signed });
  const copy = fmtMoney(dollars, { signed, ascii: true });   // a betslip wants dollars, whichever reads first
  const parts = [];
  const u = lead ? fmtMoney(dollars, { signed }) : (unitSize > 0 ? fmtUnits(dollars / unitSize, { signed }) : '');
  if (unitsFirst) { if (u) parts.push(u); if (sub) parts.push(sub); } else { if (sub) parts.push(sub); if (u) parts.push(u); }
  let t = tone;
  if (tone === 'auto') t = dollars > 0.005 ? 'pos' : dollars < -0.005 ? 'neg' : '';
  res.set(display, copy, parts.join(' · '), t);
}

// Plain-English line under the answer.
export function sentence() {
  const el = h('p', { class: 'say' });
  // Keep a minus sign glued to its number so a line never breaks between them.
  return { el, set: (t) => { el.textContent = (t || '').replace(/\u2212(?=[$\d])/g, '\u2212\u2060'); el.hidden = !t; } };
}

// ---------- Collapsible ----------
export function disclosure({ label, open = false }, ...body) {
  const chevron = svg('<path d="M6 9l6 6 6-6"/>', 18);
  const btn = h('button', { type: 'button', class: 'disclosure', 'aria-expanded': String(open) }, h('span', { text: label }), chevron);
  const panel = h('div', { class: 'disclosure-body', hidden: !open }, body);
  const root = h('div', { class: 'card card-disclosure' }, btn, panel);
  btn.addEventListener('click', () => {
    const now = panel.hidden;
    panel.hidden = !now;
    btn.setAttribute('aria-expanded', String(now));
    btn.classList.toggle('is-open', now);
    if (now) setTimeout(() => root.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0);
  });
  btn.classList.toggle('is-open', open);
  return { root, isOpen: () => !panel.hidden };
}

// ---------- Clipboard + toast ----------
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0;top:0;left:0' });
    ta.value = text; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); } catch {}
    ta.remove();
  }
  try { navigator.vibrate?.(8); } catch {}
}

let toastTimer = null;
export function toast(msg, ms = 1300, icon = 'check') {
  let el = document.getElementById('toast');
  if (!el) { el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(el); }
  el.replaceChildren(svg(icon === 'tip' ? '<circle cx="12" cy="12" r="9"/><path d="M12 8v.5M12 11v5"/>' : '<path d="M5 12l5 5L20 7"/>', 16), h('span', { text: msg }));
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), ms);
}

export { fmtOdds };

// ---------- Bottom sheet ----------
export function sheet({ title, body, onOpen, onClose }) {
  const doneBtn = h('button', { type: 'button', class: 'btn-done', text: 'Done', onclick: () => close() });
  const head = h('div', { class: 'sheet-head' }, h('h2', { class: 'sheet-title', text: title }), doneBtn);
  const bodyEl = h('div', { class: 'sheet-body' }, body);
  const panel = h('div', { class: 'sheet-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('div', { class: 'sheet-grab', 'aria-hidden': 'true' }), head, bodyEl);
  const backdrop = h('div', { class: 'sheet-backdrop', onclick: () => close() });
  const root = h('div', { class: 'sheet', hidden: true }, backdrop, panel);
  let openState = false;
  let dragY = null;
  head.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; dragY = e.clientY; try { head.setPointerCapture(e.pointerId); } catch {} panel.classList.add('is-dragging'); });
  head.addEventListener('pointermove', (e) => { if (dragY == null) return; panel.style.transform = 'translateY(' + Math.max(0, e.clientY - dragY) + 'px)'; });
  const endDrag = (e) => { if (dragY == null) return; const dy = e.clientY - dragY; dragY = null; panel.classList.remove('is-dragging'); panel.style.transform = ''; if (dy > 70) close(); };
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openState) close(); });
  function open() {
    openState = true;
    root.hidden = false;
    bodyEl.scrollTop = 0;
    onOpen?.();
    requestAnimationFrame(() => root.classList.add('is-open'));
  }
  function close() {
    if (!openState) return;
    openState = false;
    root.classList.remove('is-open');
    setTimeout(() => { if (!openState) root.hidden = true; }, 260);
    onClose?.();
  }
  return { root, open, close, isOpen: () => openState, body: bodyEl, panel };
}

// "Example" marker: shown while a screen is still using untouched example values.
export function examplePill() {
  const el = h('span', { class: 'pill pill-example', text: 'Example', hidden: true });
  // all: every value is an example; some: a mix of typed and example values
  return { el, set: (on, all = true) => { el.hidden = !on; el.textContent = all ? 'Example' : 'Part example'; } };
}
