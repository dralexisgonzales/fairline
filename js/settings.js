// Settings sheet: units, bankroll, fee preset, theme, probability display.
import { h, svg, numberField, segmented, parseNum } from './ui.js';
import { FEE_PRESETS } from './math.js';
import { fmtProb, fmtMoney } from './format.js';
import * as store from './store.js';

export function createSettings(ctx) {
  const s = ctx.settings;

  const unitF = numberField({ label: 'Unit size', prefix: '$', placeholder: '10', value: s.unit ?? '', maxLen: 12,
    onChange: (v) => ctx.update({ unit: numOrNull(v) }) });
  const bankrollF = numberField({ label: 'Bankroll', prefix: '$', placeholder: '1,000', value: s.bankroll ?? '', maxLen: 12,
    onChange: (v) => ctx.update({ bankroll: numOrNull(v) }) });
  const unitNote = h('div', { class: 'note' });

  const feeRows = FEE_PRESETS.map((p) => {
    const rate = p.rate == null ? '' : (Math.round(p.rate * 1000) / 10) + '%';
    return h('button', { type: 'button', class: 'option', 'data-id': p.id, role: 'radio',
      onclick: () => ctx.update({ feePreset: p.id }) },
      h('span', { class: 'option-label', text: p.label }),
      h('span', { class: 'option-rate', text: rate }),
      h('span', { class: 'option-check' }, svg('<path d="M5 12l5 5L20 7"/>', 18))
    );
  });
  const customF = numberField({ label: 'Custom rate', suffix: '%', placeholder: '5', value: s.feeCustom != null ? trim(s.feeCustom * 100) : '', maxLen: 6,
    onChange: (v) => {
      const n = parseNum(v);
      const clamped = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
      if (Number.isFinite(n) && clamped !== n) customF.set(String(clamped));
      ctx.update({ feeCustom: clamped / 100 });
    } });

  const themeSeg = segmented({ options: [{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }, { id: 'auto', label: 'Auto' }],
    value: s.theme, cls: 'seg-full', label: 'Theme', onChange: (v) => ctx.update({ theme: v }) });
  const probSeg = segmented({ options: [{ id: 'pct', label: 'Percent' }, { id: 'cents', label: 'Cents' }],
    value: s.probMode, cls: 'seg-full', label: 'Probability display', onChange: (v) => ctx.update({ probMode: v }) });

  const clearBtn = h('button', { type: 'button', class: 'btn-danger', text: 'Clear saved inputs' });
  let armed = false;
  clearBtn.addEventListener('click', () => {
    if (!armed) { armed = true; clearBtn.textContent = 'Tap again to confirm'; setTimeout(() => { armed = false; clearBtn.textContent = 'Clear saved inputs'; }, 2500); return; }
    store.clearInputs();
    location.reload();
  });

  const doneBtn = h('button', { type: 'button', class: 'btn-done', text: 'Done', onclick: close });
  const doneBottom = h('button', { type: 'button', class: 'btn-primary', text: 'Done', onclick: close });
  const head = h('div', { class: 'sheet-head' }, h('h2', { class: 'sheet-title', text: 'Settings' }), doneBtn);
  const panel = h('div', { class: 'sheet-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Settings' },
    head,
    h('div', { class: 'sheet-body' },
      h('div', { class: 'section' },
        h('div', { class: 'section-title', text: 'Units & bankroll' }),
        h('div', { class: 'row-2' }, unitF.root, bankrollF.root),
        unitNote
      ),
      h('div', { class: 'section' },
        h('div', { class: 'section-title', text: 'Appearance' }),
        themeSeg.root
      ),
      h('div', { class: 'section' },
        h('div', { class: 'section-title', text: 'Show probabilities as' }),
        probSeg.root,
        h('div', { class: 'note', text: '62% or 62\u00A2. Cents is how prediction markets quote, and turns on the after-fee readout in Convert.' })
      ),
      h('div', { class: 'section' },
        h('div', { class: 'section-title', text: 'Prediction market fee' }),
        h('div', { class: 'options', role: 'radiogroup' }, feeRows),
        customF.root,
        h('div', { class: 'note', text: 'Fee per contract = rate \u00D7 price \u00D7 (1 \u2212 price), so it peaks at the 50\u00A2 mark. Kalshi rounds each order\u2019s total fee up to the next cent.' })
      ),
      h('div', { class: 'section' },
        h('div', { class: 'section-title', text: 'Data' }),
        clearBtn,
        h('div', { class: 'note', text: 'Everything is calculated on this device and saved only here. No account, no tracking, nothing leaves the phone.' }),
        h('div', { class: 'about', text: 'Fairline 1.2' })
      ),
      doneBottom
    )
  );
  // Swipe down on the header to dismiss; the sheet follows the finger.
  let dragY = null;
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    dragY = e.clientY;
    try { head.setPointerCapture(e.pointerId); } catch {}
    panel.classList.add('is-dragging');
  });
  head.addEventListener('pointermove', (e) => {
    if (dragY == null) return;
    const dy = Math.max(0, e.clientY - dragY);
    panel.style.transform = 'translateY(' + dy + 'px)';
  });
  const endDrag = (e) => {
    if (dragY == null) return;
    const dy = e.clientY - dragY;
    dragY = null;
    panel.classList.remove('is-dragging');
    panel.style.transform = '';
    if (dy > 70) close();
  };
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);
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
      if (r.dataset.id === 'custom') r.querySelector('.option-rate').textContent = (Math.round((Number(st.feeCustom) || 0) * 1000) / 10) + '%';
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
  function open(focus) {
    openState = true;
    lastFocus = document.activeElement;
    render();
    root.hidden = false;
    panel.querySelector('.sheet-body').scrollTop = 0;
    document.body.classList.add('sheet-open');
    requestAnimationFrame(() => {
      root.classList.add('is-open');
      if (focus === 'unit') setTimeout(() => unitF.focus(), 260);
    });
  }
  let openState = false;
  function close() {
    if (!openState) return;
    openState = false;
    root.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    try { document.activeElement?.blur?.(); } catch {}
    setTimeout(() => { root.hidden = true; }, 240);
    lastFocus = null;
    ctx.afterSettingsClose?.();
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });

  return { root, open, close, render, isOpen: () => openState };
}
