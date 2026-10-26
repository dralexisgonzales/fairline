// Built-in keypad. Replaces the phone keyboard so the screen never resizes,
// the minus sign is one tap away, and the answer stays in view.
// It shows while a slot is being edited and hides on Done, so results get the whole screen.
import { h, svg } from './ui.js';

const CHIPS = {
  odds: [['-', '110'], ['-', '105'], ['-', '115'], ['-', '120'], ['+', '100'], ['+', '105'], ['+', '110'], ['+', '120'], ['+', '150'], ['+', '200']],
  money: ['10', '25', '50', '100', '250', '500', '1000'],
  unit: ['0.5', '1', '2', '3', '5', '10'],
  percent: ['25', '33', '40', '50', '60', '67', '75'],
};

export function createKeypad({ haptic } = {}) {
  let active = null;        // the slot being edited
  let fresh = true;         // first key replaces the old value
  let fields = [];          // slots in the active screen, in order
  let onOpenChange = null;
  const activeListeners = [];
  const notifyActive = () => activeListeners.forEach((fn) => { try { fn(active); } catch {} });

  const chipsRow = h('div', { class: 'kp-chips', role: 'group', 'aria-label': 'Quick values' });
  const signMinus = h('span', { class: 'kp-half', text: '\u2212' });
  const signPlus = h('span', { class: 'kp-half', text: '+' });
  const modeKey = key('', 'kp-key kp-fn kp-mode', () => {});
  modeKey.addEventListener('pointerdown', (e) => {
    if (!active) return;
    if (active.type === 'odds') {
      const r = modeKey.getBoundingClientRect();
      active.chooseSign(e.clientX < r.left + r.width / 2 ? '-' : '+');
    } else if (active.type === 'money') active.toggleMode();
  });
  const dotKey = key('.', 'kp-key', () => press('.'));
  const dblKey = key('00', 'kp-key', () => { press('0'); press('0'); });
  const zeroKey = key('0', 'kp-key kp-zero', () => press('0'));
  const nextKey = key('', 'kp-key kp-fn kp-next', () => next(), 'Next');
  const doneKey = key(svg('<path d="M6 9l6 6 6-6"/>', 22), 'kp-key kp-fn kp-hide', () => close(), 'Hide keypad');
  const grid = h('div', { class: 'kp-grid' },
    key('1', 'kp-key', () => press('1')), key('2', 'kp-key', () => press('2')), key('3', 'kp-key', () => press('3')),
    key(svg('<path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7 6-7z"/><path d="M13 10l4 4M17 10l-4 4"/>', 22), 'kp-key kp-fn', () => backspace(), 'Delete'),
    key('4', 'kp-key', () => press('4')), key('5', 'kp-key', () => press('5')), key('6', 'kp-key', () => press('6')),
    modeKey,
    key('7', 'kp-key', () => press('7')), key('8', 'kp-key', () => press('8')), key('9', 'kp-key', () => press('9')),
    doneKey,
    dotKey, zeroKey, dblKey,
    nextKey
  );
  const root = h('div', { class: 'keypad', hidden: true, role: 'group', 'aria-label': 'Keypad' }, chipsRow, grid);
  root.addEventListener('pointerdown', (e) => { if (!e.target.closest('.kp-chips')) e.preventDefault(); });
  let holdTimer = null;
  const delKey = grid.children[3];
  delKey.addEventListener('pointerdown', () => { holdTimer = setTimeout(() => clear(), 550); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => delKey.addEventListener(ev, () => clearTimeout(holdTimer)));

  function key(label, cls, fn, aria) {
    const b = h('button', { type: 'button', class: cls, 'aria-label': aria || null }, label);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (b.disabled) return;
      b.classList.add('is-pressed');
      fn();
      haptic?.();
    });
    const lift = () => b.classList.remove('is-pressed');
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => b.addEventListener(ev, lift));
    return b;
  }

  function setFields(list) {
    fields = list;
    if (active && !fields.includes(active)) { active.setActive(false); active = null; notifyActive(); }
    if (active) renderContext();
  }

  function focus(field, reveal = true) {
    if (active && active !== field) { active.setActive(false); active.commit?.(); }
    active = field;
    fresh = true;
    field.setActive(true);
    renderContext();
    if (root.hidden) { root.hidden = false; onOpenChange?.(true); }
    notifyActive();
    if (reveal) field.reveal?.();
  }

  function close() {
    if (active) { active.setActive(false); active.commit?.(); active = null; notifyActive(); }
    if (!root.hidden) { root.hidden = true; onOpenChange?.(false); }
  }

  function next() {
    if (!active) { if (fields[0]) focus(fields[0]); return; }
    if (active.noAdvance) { close(); return; }
    const visible = fields.filter((f) => f.el.isConnected && f.el.offsetParent !== null);
    const i = visible.indexOf(active);
    if (i === visible.length - 1) { close(); return; }
    const n = visible[i + 1];
    if (n) focus(n);
  }

  function renderContext() {
    chipsRow.replaceChildren();
    if (!active) { chipsRow.hidden = true; return; }
    const type = active.type;
    const chips = active.chips || (type === 'money' ? (active.mode === 'u' ? CHIPS.unit : CHIPS.money) : (CHIPS[type] || []));
    chips.forEach((c) => {
      const label = type === 'odds' ? (c[0] === '-' ? '−' : '+') + c[1]
        : type === 'money' ? (active.mode === 'u' ? c + 'u' : '$' + c)
        : c + (active.suffix || '');
      const b = h('button', { type: 'button', class: 'kp-chip', text: label });
      // Apply on release, and only if the finger did not swipe (the strip scrolls sideways).
      let x0 = 0;
      b.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
      b.addEventListener('pointerup', (e) => {
        if (Math.abs(e.clientX - x0) > 8) return;
        if (type === 'odds') active.setRaw({ sign: c[0], v: c[1] }); else active.setRaw(c);
        fresh = true;
        haptic?.();
        if (type === 'odds') setTimeout(() => next(), 90);
      });
      chipsRow.append(b);
    });
    chipsRow.hidden = chips.length === 0;
    chipsRow.scrollLeft = 0;
    if (type === 'odds') {
      signMinus.classList.toggle('is-on', active.sign === '-'); signPlus.classList.toggle('is-on', active.sign === '+');
      modeKey.replaceChildren(signMinus, signPlus); modeKey.classList.add('kp-sign'); modeKey.disabled = false; modeKey.setAttribute('aria-label', 'Minus or plus');
    }
    else if (type === 'money') { modeKey.classList.remove('kp-sign'); modeKey.replaceChildren(active.mode === 'u' ? 'in $' : 'in u'); modeKey.disabled = false; modeKey.setAttribute('aria-label', active.mode === 'u' ? 'Enter in dollars' : 'Enter in units'); }
    else { modeKey.classList.remove('kp-sign'); modeKey.replaceChildren('\u00A0'); modeKey.disabled = true; modeKey.removeAttribute('aria-label'); }
    dotKey.disabled = type === 'odds';
    dblKey.disabled = type === 'odds';
    grid.classList.toggle('kp-odds', type === 'odds');
    const visible = fields.filter((f) => f.el.isConnected && f.el.offsetParent !== null);
    const last = visible.indexOf(active) === visible.length - 1;
    nextKey.replaceChildren(last ? 'Done' : svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 22));
    nextKey.setAttribute('aria-label', last ? 'Done' : 'Next field');
  }

  function press(ch) {
    if (!active) return;
    let v = fresh ? '' : active.text();
    if (ch === '.') { if (v.includes('.')) return; if (v === '') v = '0'; }
    if (v === '0' && ch !== '.') v = '';
    if (v.length >= (active.maxLen || 9)) return;
    active.setText(v + ch);
    fresh = false;
  }
  function backspace() {
    if (!active) return;
    const v = active.text();          // a fresh slot still deletes one character, not everything
    active.setText(v.slice(0, -1));
    fresh = false;
  }
  function clear() { if (!active) return; active.setText(''); fresh = false; }
  function refresh() { if (active) renderContext(); }

  return { root, focus, close, next, setFields, refresh, isOpen: () => !root.hidden, active: () => active, onOpenChange: (fn) => { onOpenChange = fn; }, onActive: (fn) => { activeListeners.push(fn); } };
}
