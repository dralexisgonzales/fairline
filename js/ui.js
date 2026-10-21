// Small DOM helpers and the shared input/output components.
import { isValidAmerican } from './math.js';
import { fmtMoney, fmtUnits, toAscii } from './format.js';

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

function selectOnFocus(input) {
  input.addEventListener('focus', () => {
    // iOS needs a tick before select() sticks.
    requestAnimationFrame(() => { try { input.select(); } catch {} });
  });
}

// Keep a decimal field to digits and at most one dot.
function cleanDecimal(raw) {
  let s = String(raw).replace(/[^\d.]/g, '');
  const i = s.indexOf('.');
  if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
  return s;
}

export function trimNum(n, d = 2) {
  if (!Number.isFinite(n)) return '';
  const s = n.toFixed(d).replace(/\.?0+$/, '');
  return s === '' ? '0' : s;
}

// ---------- Odds field: ± toggle plus numeric keypad ----------
export function oddsField({ label, value, onChange, placeholder = '110' }) {
  const state = { sign: value?.sign === '+' ? '+' : '-', v: value?.v ?? '' };

  const signBtn = h('button', {
    class: 'sign', type: 'button', 'aria-label': 'Toggle plus or minus',
    onclick: () => { state.sign = state.sign === '-' ? '+' : '-'; paint(); onChange(get()); },
  });
  const input = h('input', {
    type: 'text', inputmode: 'numeric', pattern: '[0-9]*', placeholder,
    autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false',
    enterkeyhint: 'done', 'aria-label': /odds/i.test(label) ? label : label + ' American odds',
  });
  input.value = state.v;
  input.addEventListener('input', () => {
    const raw = input.value;
    // Pasted or typed sign characters flip the toggle.
    if (/[-−]/.test(raw)) state.sign = '-';
    else if (/\+/.test(raw)) state.sign = '+';
    const cleaned = raw.replace(/\D/g, '').slice(0, 6);
    if (cleaned !== raw) input.value = cleaned;
    state.v = cleaned;
    paint(false);
    onChange(get());
  });
  input.addEventListener('blur', () => paint(true));
  input.addEventListener('focus', () => paint(false));
  selectOnFocus(input);

  const subEl = h('div', { class: 'field-sub is-error', hidden: true });
  const labelEl = h('div', { class: 'field-label', text: label });
  const root = h('div', { class: 'field field-odds' },
    labelEl,
    h('div', { class: 'field-box' }, signBtn, input),
    subEl
  );

  function get() { return { sign: state.sign, v: state.v }; }
  // Only flag odds under 100 once the user has clearly finished (3+ digits or blur),
  // so typing "1" on the way to "150" never flashes red.
  function paint(final = true) {
    signBtn.textContent = state.sign === '-' ? '−' : '+';
    signBtn.classList.toggle('is-plus', state.sign === '+');
    const n = parseNum(state.v);
    const bad = state.v !== '' && Number.isFinite(n) && n < 100 && (final || state.v.length >= 3);
    input.classList.toggle('is-long', state.v.length >= 5);
    root.classList.toggle('is-invalid', bad);
    subEl.textContent = bad ? 'Odds start at 100' : '';
    subEl.hidden = !bad;
  }
  function set(v) {
    state.sign = v?.sign === '+' ? '+' : '-';
    state.v = v?.v ?? '';
    input.value = state.v;
    paint();
  }
  function setComputed(on) { root.classList.toggle('is-computed', !!on); }
  function setLabel(t) { labelEl.textContent = t; input.setAttribute('aria-label', /odds/i.test(t) ? t : t + ' American odds'); }
  function setPlaceholder(t) { input.placeholder = t; }
  paint();
  return { root, get, set, setComputed, setLabel, setPlaceholder, input, focus: () => input.focus() };
}

export function oddsValue(s) {
  const m = parseNum(s?.v);
  if (!Number.isFinite(m)) return NaN;
  const am = (s.sign === '-' ? -1 : 1) * m;
  return isValidAmerican(am) ? am : NaN;
}

// ---------- Stake field: dollars or units ----------
export function stakeField({ label, value, ctx, onChange, placeholder = '100' }) {
  const state = { v: value?.v ?? '', mode: value?.mode === 'u' ? 'u' : '$', exact: null };

  const input = h('input', {
    type: 'text', inputmode: 'decimal', placeholder,
    autocomplete: 'off', autocorrect: 'off', spellcheck: 'false',
    enterkeyhint: 'done', 'aria-label': label,
  });
  input.value = state.v;
  input.addEventListener('input', () => {
    const cleaned = cleanDecimal(input.value).slice(0, 12);
    if (cleaned !== input.value) input.value = cleaned;
    state.v = cleaned;
    state.exact = null;
    paint();
    onChange(get());
  });
  selectOnFocus(input);

  const adorn = h('span', { class: 'adorn' });
  const btn$ = h('button', { type: 'button', class: 'seg-btn', text: '$', 'aria-label': 'Enter in dollars' });
  const btnU = h('button', { type: 'button', class: 'seg-btn', text: 'u', 'aria-label': 'Enter in units' });
  const toggle = h('div', { class: 'seg seg-field', role: 'group', 'aria-label': 'Dollars or units' }, btn$, btnU);
  btn$.addEventListener('click', () => setMode('$'));
  btnU.addEventListener('click', () => setMode('u'));

  const subEl = h('div', { class: 'field-sub field-sub-reserved', text: '\u00A0', onclick: () => { if (subEl.classList.contains('is-link')) ctx.openSettings('unit'); } });
  const labelEl = h('div', { class: 'field-label', text: label });
  const root = h('div', { class: 'field field-stake' },
    labelEl,
    h('div', { class: 'field-box' }, adorn, input, toggle),
    subEl
  );

  let pendingUnits = false;
  function setMode(mode) {
    if (mode === '$') pendingUnits = false;
    if (state.mode === mode) return;
    const unit = ctx.unitSize();
    if (mode === 'u' && !(unit > 0)) {
      // No unit size yet: keep the number as it is, send the user to set one, and finish the switch after.
      pendingUnits = true;
      ctx.openSettings('unit');
      return;
    }
    const n = parseNum(state.v);
    if (Number.isFinite(n) && unit > 0) {
      if (mode === 'u') {
        // Remember the exact dollar entry so toggling back never drifts.
        const text = state.v;
        state.v = trimNum(n / unit, 4);
        state.exact = { text, dollars: n, unitsText: state.v, unit };
      } else {
        const ex = state.exact;
        state.v = ex && ex.unitsText === state.v && ex.unit === unit ? ex.text : trimNum(n * unit, 2);
        state.exact = null;
      }
      input.value = state.v;
    }
    state.mode = mode;
    paint();
    onChange(get());
  }

  function paint() {
    const unit = ctx.unitSize();
    // Finish a pending switch to units only once Settings has closed, so the stake converts at the final unit size.
    if (pendingUnits && !ctx.settingsOpen()) {
      pendingUnits = false;
      if (unit > 0 && state.mode === '$') { setMode('u'); return; }
    }
    btn$.classList.toggle('is-on', state.mode === '$');
    btnU.classList.toggle('is-on', state.mode === 'u');
    btn$.setAttribute('aria-pressed', state.mode === '$');
    btnU.setAttribute('aria-pressed', state.mode === 'u');
    adorn.textContent = state.mode === '$' ? '$' : 'u';
    const n = parseNum(state.v);
    subEl.classList.remove('is-link');
    if (state.mode === 'u' && !(unit > 0)) {
      subEl.textContent = 'Set a unit size';
      subEl.classList.add('is-link');
      return;
    }
    if (!Number.isFinite(n) || !(unit > 0)) { subEl.textContent = '\u00A0'; return; }
    subEl.textContent = state.mode === '$' ? '= ' + fmtUnits(n / unit) : '= ' + fmtMoney(n * unit);
  }

  function get() { return { v: state.v, mode: state.mode }; }
  function setLabel(text) { labelEl.textContent = text; input.setAttribute('aria-label', text); }
  paint();
  return { root, get, paint, setLabel, input, focus: () => input.focus() };
}

// Dollar amount of a stake field state, NaN if not available.
export function stakeDollars(s, unitSize) {
  const n = parseNum(s?.v);
  if (!Number.isFinite(n)) return NaN;
  if (s.mode === 'u') return unitSize > 0 ? n * unitSize : NaN;
  return n;
}

// ---------- Plain decimal field (probability, bankroll, rate) ----------
export function numberField({ label, value, onChange, placeholder = '', suffix = '', prefix = '', maxLen = 10 }) {
  const input = h('input', {
    type: 'text', inputmode: 'decimal', placeholder,
    autocomplete: 'off', autocorrect: 'off', spellcheck: 'false',
    enterkeyhint: 'done', 'aria-label': label,
  });
  input.value = value ?? '';
  input.addEventListener('input', () => {
    const cleaned = cleanDecimal(input.value).slice(0, maxLen);
    if (cleaned !== input.value) input.value = cleaned;
    onChange(cleaned);
  });
  selectOnFocus(input);
  const prefixEl = h('span', { class: 'adorn', text: prefix, hidden: !prefix });
  const suffixEl = h('span', { class: 'adorn adorn-suffix', text: suffix, hidden: !suffix });
  const subEl = h('div', { class: 'field-sub', hidden: true });
  const labelEl = h('div', { class: 'field-label', text: label });
  const root = h('div', { class: 'field field-number' },
    labelEl,
    h('div', { class: 'field-box' }, prefixEl, input, suffixEl),
    subEl
  );
  return {
    root, input,
    get: () => input.value,
    set: (v) => { input.value = v ?? ''; },
    setSuffix: (s) => { suffixEl.textContent = s; suffixEl.hidden = !s; },
    setSub: (t) => { subEl.textContent = t || ''; subEl.hidden = !t; },
    setComputed: (on) => root.classList.toggle('is-computed', !!on),
    setPlaceholder: (t) => { input.placeholder = t; },
    setLabel: (t) => { labelEl.textContent = t; input.setAttribute('aria-label', t); },
    setError: (on) => { root.classList.toggle('is-invalid', !!on); subEl.classList.toggle('is-error', !!on); },
    focus: () => input.focus(),
  };
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
    btns.forEach((b) => {
      const on = b.dataset.id === id;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on);
    });
    if (fire) onChange(id);
  }
  set(value);
  return { root, set, get: () => current };
}

// ---------- Result tile: tap to copy ----------
export function result({ label, hero = false, cls = '', mini = '' }) {
  const labelEl = h('span', { class: 'res-label', text: label });
  const valueEl = h('span', { class: 'res-value', text: '—' });
  const subEl = h('span', { class: 'res-sub', hidden: true });
  const root = h('button', { type: 'button', class: 'res ' + (hero ? 'res-hero ' : '') + cls, 'aria-label': label + ', tap to copy' },
    labelEl, valueEl, subEl
  );
  if (mini) root.dataset.mini = mini;      // short label for the compact answer strip
  let copy = null;
  let currentLabel = label;
  let flashTimer = null;
  root.addEventListener('click', () => {
    if (copy == null) return;
    copyText(copy).then(() => {
      toast('Copied ' + copy);
      root.classList.add('is-copied');
      labelEl.textContent = 'Copied';
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => { root.classList.remove('is-copied'); labelEl.textContent = currentLabel; }, 700);
    });
  });
  let fitTimer = 0;
  // A sub-line shows whole or not at all: after layout, drop trailing " · " segments until it fits two lines.
  function fitSub() {
    cancelAnimationFrame(fitTimer);
    fitTimer = requestAnimationFrame(() => {
      if (subEl.hidden || !subEl.isConnected) return;
      let guard = 6;
      while (guard-- > 0 && subEl.scrollHeight > subEl.clientHeight + 1 && subEl.textContent.includes(' \u00B7 ')) {
        subEl.textContent = subEl.textContent.slice(0, subEl.textContent.lastIndexOf(' \u00B7 '));
      }
      if (subEl.scrollHeight > subEl.clientHeight + 1) subEl.hidden = true;
    });
  }
  function set(display, copyValue = display, sub = '', tone = '') {
    valueEl.textContent = display;
    // Long figures shrink instead of wrapping mid-number.
    root.classList.toggle('is-long', display.length >= 10);
    root.classList.toggle('is-xlong', display.length >= 13);
    root.classList.toggle('is-xxlong', display.length >= 15);
    root.classList.toggle('is-xxxlong', display.length >= 18);
    copy = display === '—' ? null : toAscii(copyValue);
    subEl.textContent = sub || '';
    subEl.hidden = !sub;
    if (sub && !hero) fitSub();
    root.classList.toggle('is-empty', display === '—');
    root.classList.remove('tone-pos', 'tone-neg', 'tone-accent');
    if (tone) root.classList.add('tone-' + tone);
  }
  function setLabel(t) {
    currentLabel = t;
    if (!root.classList.contains('is-copied')) labelEl.textContent = t;
    root.setAttribute('aria-label', t + ', tap to copy');
  }
  set('—');
  return { root, set, setLabel, setMini: (t) => { root.dataset.mini = t; }, hide: (on) => { root.hidden = !!on; } };
}

// Money result with units in the sub line.
export function setMoney(res, dollars, unitSize, { signed = false, tone = 'auto', sub = '', unitsFirst = true } = {}) {
  if (!Number.isFinite(dollars)) { res.set('—'); return; }
  const display = fmtMoney(dollars, { signed });
  const copy = fmtMoney(dollars, { signed, ascii: true });
  const parts = [];
  const u = unitSize > 0 ? fmtUnits(dollars / unitSize, { signed }) : '';
  if (unitsFirst) { if (u) parts.push(u); if (sub) parts.push(sub); }
  else { if (sub) parts.push(sub); if (u) parts.push(u); }
  let t = tone;
  if (tone === 'auto') t = dollars > 0.005 ? 'pos' : dollars < -0.005 ? 'neg' : '';
  res.set(display, copy, parts.join(' · '), t);
}

// ---------- Collapsible section ----------
export function disclosure({ label, open = false }, ...body) {
  const chevron = svg('<path d="M6 9l6 6 6-6"/>', 18);
  const btn = h('button', { type: 'button', class: 'disclosure', 'aria-expanded': String(open) }, h('span', { text: label }), chevron);
  const panel = h('div', { class: 'disclosure-body', hidden: !open }, body);
  btn.addEventListener('click', () => {
    const now = panel.hidden;
    panel.hidden = !now;
    btn.setAttribute('aria-expanded', String(now));
    btn.classList.toggle('is-open', now);
    if (now) requestAnimationFrame(() => root.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  });
  btn.classList.toggle('is-open', open);
  const root = h('div', { class: 'card card-disclosure' }, btn, panel);
  return { root, isOpen: () => !panel.hidden };
}

// ---------- Clipboard + toast ----------
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0;top:0;left:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    ta.remove();
  }
  try { navigator.vibrate?.(8); } catch {}
}

let toastTimer = null;
export function toast(msg, ms = 1300) {
  let el = document.getElementById('toast');
  if (!el) { el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(el); }
  el.replaceChildren(svg('<path d="M5 12l5 5L20 7"/>', 16), h('span', { text: msg }));
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), ms);
}

// Persist helper: debounce saves so typing stays smooth.
export function debounce(fn, ms = 80) {
  let t = null;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
