// Settings sheet: bankroll, units, fee preset, theme, probability display.
import { h, svg, numberField, segmented, parseNum, toast } from './ui.js';
import { FEE_PRESETS } from './math.js';
import { fmtProb, fmtMoney } from './format.js';
import * as store from './store.js';

export function createSettings(ctx) {
  const s = ctx.settings;

  const bankrollF = numberField({ label: 'Bankroll', prefix: '$', placeholder: '1,000', value: s.bankroll ?? '', maxLen: 12,
    onChange: (v) => ctx.update({ bankroll: numOrNull(v) }) });
  const unitF = numberField({ label: 'Unit size', prefix: '$', placeholder: '10', value: s.unit ?? '', maxLen: 12,
    onChange: (v) => ctx.update({ unit: numOrNull(v) }) });
  const unitNote = h('div', { class: 'note' });

  const feeRows = FEE_PRESETS.map((p) => {
    const rate = p.rate == null ? '' : (Math.round(p.rate * 1000) / 10) + '%';
    const row = h('button', { type: 'button', class: 'option', 'data-id': p.id, role: 'radio',
      onclick: () => ctx.update({ feePreset: p.id }) },
      h('span', { class: 'option-label', text: p.label }),
      h('span', { class: 'option-rate', text: rate }),
      h('span', { class: 'option-check' }, svg('<path d="M5 12l5 5L20 7"/>', 18))
    );
    return row;
  });
  const customF = numberField({ label: 'Custom rate', suffix: '%', placeholder: '5', value: s.feeCustom != null ? trim(s.feeCustom * 100) : '', maxLen: 6,
    onChange: (v) => { const n = parseNum(v); ctx.update({ feeCustom: Number.isFinite(n) ? n / 100 : 0 }); } });

  const themeSeg = segmented({ options: [{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }, { id: 'auto', label: 'Auto' }],
    value: s.theme, cls: 'seg-full', onChange: (v) => ctx.update({ theme: v }) });
  const probSeg = segmented({ options: [{ id: 'pct', label: 'Percent  62%' }, { id: 'cents', label: 'Cents  62¢' }],
    value: s.probMode, cls: 'seg-full', onChange: (v) => ctx.update({ probMode: v }) });

  const clearBtn = h('button', { type: 'button', class: 'btn-danger', text: 'Clear saved inputs' });
  let armed = false;
  clearBtn.addEventListener('click', () => {
    if (!armed) { armed = true; clearBtn.textContent = 'Tap again to confirm'; setTimeout(() => { armed = false; clearBtn.textContent = 'Clear saved inputs'; }, 2500); return; }
    store.clearInputs();
    location.reload();
  });

  const doneBtn = h('button', { type: 'button', class: 'btn-done', text: 'Done', onclick: close });
  const panel = h('div', { class: 'sheet-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Settings' },
    h('div', { class: 'sheet-grab', 'aria-hidden': 'true' }),
    h('div', { class: 'sheet-head' }, h('h2', { class: 'sheet-title', text: 'Settings' }), doneBtn),
    h('div', { class: 'sheet-body' },
      h('div', { class: 'section' },
        h('div', { class: 'section-title', text: 'Bankroll & units' }),
        h('div', { class: 'row-2' }, bankrollF.root, unitF.root),
        unitNote
      ),
      h('div', { class: 'section' },
        h('div', { class: 'section-title', text: 'Prediction market fee' }),
        h('div', { class: 'options', role: 'radiogroup' }, feeRows),
        customF.root,
        h('div', { class: 'note', text: 'Taker fee per contract = rate × price × (1 − price). Kalshi peaks at 1.75¢ on a 50¢ contract. The converter shows the price after this fee.' })
      ),
      h('div', { class: 'section' },
        h('div', { class: 'section-title', text: 'Appearance' }),
        themeSeg.root,
        h('div', { class: 'section-title', text: 'Probabilities' }),
        probSeg.root
      ),
      h('div', { class: 'section' },
        h('div', { class: 'section-title', text: 'Data' }),
        clearBtn,
        h('div', { class: 'note', text: 'Everything is calculated on this device and saved only here. No account, no tracking, nothing leaves the phone.' }),
        h('div', { class: 'about', text: 'Fairline 1.0' })
      )
    )
  );
  const backdrop = h('div', { class: 'sheet-backdrop', onclick: close });
  const root = h('div', { class: 'sheet', hidden: true }, backdrop, panel);

  function numOrNull(v) { const n = parseNum(v); return Number.isFinite(n) && n > 0 ? n : null; }
  function trim(n) { return String(Number(n.toFixed(3))); }

  function render() {
    const st = ctx.settings;
    feeRows.forEach((r) => {
      const on = r.dataset.id === st.feePreset;
      r.classList.toggle('is-on', on);
      r.setAttribute('aria-checked', on);
    });
    customF.root.hidden = st.feePreset !== 'custom';
    themeSeg.set(st.theme);
    probSeg.set(st.probMode);
    if (st.unit > 0 && st.bankroll > 0) {
      unitNote.textContent = '1u = ' + fmtMoney(st.unit) + ' · ' + fmtProb(st.unit / st.bankroll, 'pct', 2) + ' of bankroll · bankroll is ' + trimUnits(st.bankroll / st.unit) + 'u';
    } else if (st.unit > 0) {
      unitNote.textContent = '1u = ' + fmtMoney(st.unit) + '. Add a bankroll to see units as a share of it.';
    } else {
      unitNote.textContent = 'Set a unit size to enter stakes in units anywhere in the app.';
    }
  }
  function trimUnits(n) { return Number(n.toFixed(1)).toLocaleString('en-US'); }

  let lastFocus = null;
  function open() {
    lastFocus = document.activeElement;
    render();
    root.hidden = false;
    document.body.classList.add('sheet-open');
    requestAnimationFrame(() => root.classList.add('is-open'));
  }
  function close() {
    root.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    setTimeout(() => { root.hidden = true; }, 240);
    try { lastFocus?.focus?.(); } catch {}
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });

  return { root, open, close, render };
}
