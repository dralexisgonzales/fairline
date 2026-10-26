// Settings sheet: stakes, appearance, prediction-market fee, data.
import { h, field, segmented, sheet, parseNum } from './ui.js';
import { FEE_PRESETS } from './math.js';
import { fmtMoney, fmtProb } from './format.js';
import * as store from './store.js';

export function createSettings(ctx) {
  const s = ctx.settings;
  const kp = ctx.keypad;

  const unitF = field({ type: 'percent', label: 'Unit size (your standard bet)', prefix: '$', placeholder: '25', value: s.unit != null ? String(s.unit) : '', maxLen: 9, ctx, keypad: kp,
    onChange: (v) => ctx.update({ unit: numOrNull(v.v) }) });
  const bankF = field({ type: 'percent', label: 'Bankroll (money set aside)', prefix: '$', placeholder: '1000', value: s.bankroll != null ? String(s.bankroll) : '', maxLen: 10, ctx, keypad: kp,
    onChange: (v) => ctx.update({ bankroll: numOrNull(v.v) }) });
  const unitNote = h('div', { class: 'note' });
  const leadToggle = h('button', { type: 'button', class: 'toggle', role: 'switch', onclick: () => ctx.update({ leadUnits: !ctx.settings.leadUnits }) });

  const feeChips = h('div', { class: 'chips', role: 'radiogroup' });
  const customF = field({ type: 'percent', label: 'Custom rate', suffix: '%', placeholder: '5', value: s.feeCustom != null ? String(Number((s.feeCustom * 100).toFixed(3))) : '', maxLen: 6, ctx, keypad: kp,
    onChange: (v) => { const n = parseNum(v.v); const c = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0; if (Number.isFinite(n) && c !== n) customF.set(String(c)); ctx.update({ feeCustom: c / 100 }); } });
  const feeNote = h('div', { class: 'note' });

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
      h('div', { class: 'switch-row' }, h('div', {}, h('div', { class: 'lbl', text: 'Show money in units first' }), h('div', { class: 'sub', text: 'Dollars stay underneath' })), leadToggle)
    ),
    h('div', { class: 'section' },
      h('div', { class: 'section-title', text: 'Look' }),
      themeSeg.root
    ),
    h('div', { class: 'section' },
      h('div', { class: 'section-title', text: 'Prediction market fee (used in Convert, ¢ mode)' }),
      feeChips,
      customF.el,
      feeNote
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
    onOpen: () => { render(); if (focusOnOpen === 'unit') setTimeout(() => kp.focus(unitF, true), 280); else kp.setFields(fieldsList(), false); },
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
      const rate = p.rate == null ? '' : (Math.round(p.rate * 1000) / 10) + '%';
      return h('button', { type: 'button', class: 'chip' + (on ? ' is-on' : ''), role: 'radio', 'aria-checked': String(on), onclick: () => ctx.update({ feePreset: p.id }) }, p.label, rate ? h('small', { text: rate }) : null);
    }));
    customF.el.hidden = st.feePreset !== 'custom';
    const p = ctx.feePreset();
    feeNote.textContent = p.note || '';
    themeSeg.set(st.theme);
    if (st.unit > 0 && st.bankroll > 0) unitNote.textContent = '1u = ' + fmtMoney(st.unit) + ', which is ' + fmtProb(st.unit / st.bankroll, 'pct', 1) + ' of your bankroll.';
    else if (st.unit > 0) unitNote.textContent = '1u = ' + fmtMoney(st.unit) + '. Add a bankroll to see what share of it a unit is.';
    else unitNote.textContent = 'Set a unit size and you can type stakes as units anywhere (for example 2u).';
    if (sh.isOpen()) kp.setFields(fieldsList(), false);
  }

  return { root: sh.root, open: (focus) => { focusOnOpen = focus || null; sh.open(); }, close: sh.close, isOpen: sh.isOpen, render };
}
