// Built-in keypad, always docked. Replaces the phone keyboard so the screen never
// resizes, the minus sign is one tap away, and the answer stays in view.
import { h, svg } from './ui.js';

const CHIPS = {
  odds: [['-', '110'], ['-', '105'], ['+', '100'], ['+', '105'], ['+', '110'], ['+', '120'], ['+', '150'], ['+', '200'], ['+', '300']],
  money: ['10', '25', '50', '100', '250', '500', '1000'],
  unit: ['0.5', '1', '2', '3', '5', '10'],
  percent: ['25', '33', '40', '50', '60', '67', '75'],
};

export function createKeypad({ haptic } = {}) {
  let active = null;        // the field being edited
  let fresh = true;         // first key replaces the old value
  let fields = [];          // fields in the active screen, in order
  let onFocusChange = null;

  const chipsRow = h('div', { class: 'kp-chips', role: 'group', 'aria-label': 'Quick values' });
  const modeKey = key('', 'kp-key kp-fn kp-mode', () => active?.toggleMode?.());
  const dotKey = key('.', 'kp-key', () => press('.'));
  const nextKey = key('', 'kp-key kp-fn kp-next', () => next(), 'Next');
  const grid = h('div', { class: 'kp-grid' },
    key('1', 'kp-key', () => press('1')), key('2', 'kp-key', () => press('2')), key('3', 'kp-key', () => press('3')),
    key(svg('<path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7 6-7z"/><path d="M13 10l4 4M17 10l-4 4"/>', 22), 'kp-key kp-fn', () => backspace(), 'Delete'),
    key('4', 'kp-key', () => press('4')), key('5', 'kp-key', () => press('5')), key('6', 'kp-key', () => press('6')),
    modeKey,
    key('7', 'kp-key', () => press('7')), key('8', 'kp-key', () => press('8')), key('9', 'kp-key', () => press('9')),
    key('C', 'kp-key kp-fn', () => clear(), 'Clear'),
    dotKey,
    key('0', 'kp-key', () => press('0')),
    key('00', 'kp-key', () => { press('0'); press('0'); }),
    nextKey
  );
  const root = h('div', { class: 'keypad', role: 'group', 'aria-label': 'Keypad' }, chipsRow, grid);
  root.addEventListener('pointerdown', (e) => { e.preventDefault(); });
  // Long-press on delete clears the field.
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

  function setFields(list, focusFirst = true) {
    fields = list;
    if (active && !fields.includes(active)) { active.setActive(false); active = null; }
    if (!active && focusFirst && fields.length) focus(fields[0], false);
  }

  function focus(field, reveal = true) {
    if (active && active !== field) { active.setActive(false); active.commit?.(); }
    active = field;
    fresh = true;
    field.setActive(true);
    renderContext();
    if (reveal) field.reveal?.();
    onFocusChange?.(field);
  }

  function blur() {
    if (!active) return;
    active.setActive(false);
    active.commit?.();
    active = null;
    onFocusChange?.(null);
  }

  function next() {
    if (!active) { if (fields[0]) focus(fields[0]); return; }
    const visible = fields.filter((f) => f.el.isConnected && f.el.offsetParent !== null);
    const i = visible.indexOf(active);
    const n = visible[(i + 1) % Math.max(1, visible.length)];
    if (n) focus(n);
  }

  function renderContext() {
    chipsRow.replaceChildren();
    if (!active) { chipsRow.hidden = true; return; }
    const type = active.type;
    const chips = type === 'money' ? (active.mode === 'u' ? CHIPS.unit : CHIPS.money) : (CHIPS[type] || []);
    chips.forEach((c) => {
      const label = type === 'odds' ? (c[0] === '-' ? '−' : '+') + c[1]
        : type === 'money' ? (active.mode === 'u' ? c + 'u' : '$' + c)
        : c + (active.suffix || '');
      const b = h('button', { type: 'button', class: 'kp-chip', text: label });
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (type === 'odds') active.setRaw({ sign: c[0], v: c[1] }); else active.setRaw(c);
        fresh = true;
        haptic?.();
      });
      chipsRow.append(b);
    });
    chipsRow.hidden = chips.length === 0;
    if (type === 'odds') { modeKey.replaceChildren('+/−'); modeKey.disabled = false; modeKey.setAttribute('aria-label', 'Switch plus or minus'); }
    else if (type === 'money') { modeKey.replaceChildren(active.mode === 'u' ? '$' : 'u'); modeKey.disabled = false; modeKey.setAttribute('aria-label', active.mode === 'u' ? 'Enter in dollars' : 'Enter in units'); }
    else { modeKey.replaceChildren(' '); modeKey.disabled = true; modeKey.removeAttribute('aria-label'); }
    dotKey.disabled = type === 'odds';
    const visible = fields.filter((f) => f.el.isConnected && f.el.offsetParent !== null);
    const last = visible.indexOf(active) === visible.length - 1;
    nextKey.replaceChildren(last ? svg('<path d="M5 12l5 5L20 7"/>', 22) : svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 22));
    nextKey.setAttribute('aria-label', last ? 'Done, back to the first field' : 'Next field');
  }

  function press(ch) {
    if (!active) return;
    let v = fresh ? '' : active.text();
    if (ch === '.') { if (v.includes('.')) return; if (v === '') v = '0'; }
    if (v === '0' && ch !== '.') v = '';
    if (v.length >= (active.maxLen || 9)) return;
    active.setText(v + ch);
    fresh = false;
    // Odds are complete at three digits: move on automatically.
    if (active.type === 'odds' && (v + ch).length === 3 && active.autoAdvance !== false) setTimeout(() => { if (active && !fresh) next(); }, 120);
  }
  function backspace() {
    if (!active) return;
    const v = fresh ? '' : active.text();
    active.setText(v.slice(0, -1));
    fresh = false;
  }
  function clear() { if (!active) return; active.setText(''); fresh = false; }
  function refresh() { if (active) renderContext(); }

  return { root, focus, blur, next, setFields, refresh, active: () => active, onFocusChange: (fn) => { onFocusChange = fn; } };
}
