// Settings sheet: stakes, appearance, prediction-market fee, data.
import { h, field, segmented, sheet, parseNum, disclosure } from './ui.js';
import { FEE_PRESETS } from './math.js';
import { fmtMoney, fmtProb } from './format.js';
import * as store from './store.js';

export function createSettings(ctx) {
  const s = ctx.settings;
  const kp = ctx.keypad;

  const unitF = field({ type: 'percent', label: 'Unit size', prefix: '$', placeholder: '\u2014', value: s.unit != null ? String(s.unit) : '', maxLen: 9, ctx, keypad: kp, chips: ['5', '10', '20', '25', '50', '100'],
    onChange: (v) => ctx.update({ unit: numOrNull(v.v) }) });
  const bankF = field({ type: 'percent', label: 'Bankroll', prefix: '$', placeholder: '\u2014', value: s.bankroll != null ? String(s.bankroll) : '', maxLen: 10, ctx, keypad: kp, chips: ['500', '1000', '2500', '5000', '10000'],
    onChange: (v) => ctx.update({ bankroll: numOrNull(v.v) }) });
  unitF.setSub('your standard bet'); bankF.setSub('money set aside for betting');
  const unitNote = h('div', { class: 'note' });
  const leadToggle = h('button', { type: 'button', class: 'toggle', role: 'switch', onclick: () => ctx.update({ leadUnits: !ctx.settings.leadUnits }) });

  const feeChips = h('div', { class: 'chips', role: 'radiogroup' });
  const customF = field({ type: 'percent', label: 'Custom rate', suffix: '%', placeholder: '5', value: s.feeCustom != null ? String(Number((s.feeCustom * 100).toFixed(3))) : '', maxLen: 6, ctx, keypad: kp, chips: ['3', '4', '5', '6', '7', '10'],
    onChange: (v) => { const n = parseNum(v.v); const c = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0; if (Number.isFinite(n) && c !== n) customF.set(String(c)); ctx.update({ feeCustom: c / 100 }); } });
  const feeNote = h('div', { class: 'note' });
  const feeDisc = disclosure({ label: 'Fee' }, h('div', { class: 'note', text: 'Novig, Kalshi and Polymarket are betting exchanges that charge a fee per trade. Pick the one you use.' }), feeChips, customF.el, feeNote);

  feeDisc.root.querySelector('.disclosure').addEventListener('click', () => kp.close());
  const themeSeg = segmented({ options: [{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }, { id: 'auto', label: 'Auto' }], value: s.theme, cls: 'seg-full', label: 'Theme', onChange: (v) => ctx.update({ theme: v }) });

  const clearBtn = h('button', { type: 'button', class: 'btn-danger', text: 'Start fresh (clear saved numbers)' });
  let armed = false;
  clearBtn.addEventListener('click', () => {
    if (!armed) { armed = true; clearBtn.textContent = 'Tap again to confirm'; setTimeout(() => { armed = false; clearBtn.textContent = 'Start fresh (clear saved numbers)'; }, 2500); return; }
    store.clearInputs();
    location.reload();
  });

  const body = [
    h('div', { class: 'section' },
      h('div', { class: 'section-title', text: 'Your stakes' }),
      h('div', { class: 'row-2' }, unitF.el, bankF.el),
      unitNote,
      h('div', { class: 'switch-row' }, h('div', {}, h('div', { class: 'lbl', text: 'Show money as units first' }), h('div', { class: 'sub', text: 'For example 2u, with $50 underneath' })), leadToggle)
    ),
    h('div', { class: 'section' },
      h('div', { class: 'section-title', text: 'Look' }),
      themeSeg.root
    ),
    h('div', { class: 'section' },
      h('div', { class: 'section-title', text: 'Prediction market fee' }),
      h('div', { class: 'note', text: 'Only used in Convert, in cents mode.' }),
      feeDisc.root
    ),
    h('div', { class: 'section' },
      h('div', { class: 'section-title', text: 'Your data' }),
      clearBtn,
      h('div', { class: 'note', text: 'Everything is worked out on this phone and saved only here. No account, no tracking, nothing leaves the device.' }),
      h('div', { class: 'about', text: 'Fairline 2.0' })
    ),
  ];

  let focusOnOpen = null;
  const sh = sheet({
    title: 'Settings', body,
    onOpen: () => {
      render();
      ctx.takeKeypad(sh.panel);
      kp.setFields(fieldsList());
      if (focusOnOpen === 'unit') setTimeout(() => kp.focus(unitF, true), 280); else kp.close();
    },
    onClose: () => { ctx.afterSettingsClose?.(); },
  });

  function fieldsList() { return [unitF, bankF, ...(ctx.settings.feePreset === 'custom' ? [customF] : [])]; }
  function numOrNull(v) { const n = parseNum(v); return Number.isFinite(n) && n > 0 ? n : null; }

  function render() {
    const st = ctx.settings;
    leadToggle.classList.toggle('is-on', !!st.leadUnits);
    leadToggle.setAttribute('aria-checked', String(!!st.leadUnits));
    feeChips.replaceChildren(...FEE_PRESETS.map((p) => {
      const on = p.id === st.feePreset;
      const rate = p.rate == null ? '' : p.rate > 0 ? 'up to ' + (Math.round(p.rate * 25 * 100) / 100) + '\u00A2 per $1' : 'no fee';
      return h('button', { type: 'button', class: 'chip' + (on ? ' is-on' : ''), role: 'radio', 'aria-checked': String(on), onclick: () => ctx.update({ feePreset: p.id }) }, p.label, rate ? h('small', { text: rate }) : null);
    }));
    customF.el.hidden = st.feePreset !== 'custom';
    const p = ctx.feePreset();
    feeNote.textContent = p.note || '';
    feeDisc.root.querySelector('.disclosure span').textContent = p.label + (p.rate > 0 ? ' \u00B7 up to ' + (Math.round(p.rate * 25 * 100) / 100) + '\u00A2 per $1' : p.id === 'custom' ? ' \u00B7 ' + (Math.round((st.feeCustom || 0) * 1000) / 10) + '%' : ' \u00B7 no fee');
    themeSeg.set(st.theme);
    if (st.unit > 0 && st.bankroll > 0) unitNote.textContent = '1u = ' + fmtMoney(st.unit) + ', which is ' + fmtProb(st.unit / st.bankroll, 'pct', 1) + ' of your bankroll.';
    else if (st.unit > 0) unitNote.textContent = '1u = ' + fmtMoney(st.unit) + '. Add a bankroll to see what share of it a unit is.';
    else unitNote.textContent = 'Set a unit size and you can type stakes as units anywhere (for example 2u).';
    if (sh.isOpen()) kp.setFields(fieldsList());
  }

  return { root: sh.root, open: (focus) => { focusOnOpen = focus || null; sh.open(); }, close: sh.close, isOpen: sh.isOpen, render };
}
