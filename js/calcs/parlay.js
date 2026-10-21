// Parlay fair value.
import { h, oddsField, oddsValue, stakeField, stakeDollars, result, setMoney, debounce, svg } from '../ui.js';
import { parlay } from '../math.js';
import { fmtOdds, fmtDecimal, fmtProb, fmtPctSigned, fmtMoney } from '../format.js';
import * as store from '../store.js';

export const ICON = '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="M3 13l9 5 9-5"/>';

export function create(ctx) {
  const id = 'parlay';
  const state = store.load('calc:' + id, {
    legs: [{ sign: '-', v: '110' }, { sign: '-', v: '110' }],
    stake: { v: '100', mode: '$' },
    offered: { sign: '+', v: '' },
  });
  if (!Array.isArray(state.legs) || state.legs.length === 0) state.legs = [{ sign: '-', v: '' }];
  const persist = debounce(() => store.save('calc:' + id, state));

  const hero = result({ label: 'Fair parlay odds', hero: true });
  const probRes = result({ label: 'True probability' });
  const payRes = result({ label: 'Fair profit' });
  const offRes = result({ label: 'Offered profit' });
  const edgeRes = result({ label: 'Your edge at offered' });
  const offeredRow = h('div', { class: 'res-row' }, offRes.root, edgeRes.root);

  const stakeF = stakeField({ label: 'Stake', value: state.stake, ctx, onChange: (v) => { state.stake = v; render(); persist(); } });
  const offeredF = oddsField({ label: 'Book’s parlay odds (optional)', value: state.offered, placeholder: '600', onChange: (v) => { state.offered = v; render(); persist(); } });

  const legsEl = h('div', { class: 'legs' });
  const legFields = [];
  const addBtn = h('button', { type: 'button', class: 'btn-ghost', onclick: () => addLeg({ sign: '-', v: '' }, true) },
    svg('<path d="M12 5v14M5 12h14"/>', 18), 'Add leg');

  function addLeg(val, focus = false) {
    const idx = legFields.length;
    const f = oddsField({ label: 'Leg ' + (idx + 1), value: val, onChange: (v) => { state.legs[legFields.indexOf(f)] = v; render(); persist(); } });
    const removeBtn = h('button', { type: 'button', class: 'leg-remove', 'aria-label': 'Remove leg', onclick: () => removeLeg(f) }, svg('<path d="M6 6l12 12M18 6L6 18"/>', 16));
    const row = h('div', { class: 'leg' }, f.root, removeBtn);
    f.row = row;
    legFields.push(f);
    if (state.legs[idx] == null) state.legs[idx] = val;
    legsEl.append(row);
    relabel();
    render();
    persist();
    if (focus) f.focus();
  }
  function removeLeg(f) {
    if (legFields.length <= 1) return;
    const i = legFields.indexOf(f);
    legFields.splice(i, 1);
    state.legs.splice(i, 1);
    f.row.remove();
    relabel();
    render();
    persist();
  }
  function relabel() {
    legFields.forEach((f, i) => {
      f.root.querySelector('.field-label').textContent = 'Leg ' + (i + 1);
      f.row.querySelector('.leg-remove').hidden = legFields.length <= 1;
    });
  }

  const root = h('section', { class: 'screen', 'data-screen': id, hidden: true },
    h('div', { class: 'card card-hero' },
      h('div', { class: 'card-head' }, h('span', { class: 'card-title', text: 'Parlay' })),
      hero.root,
      h('div', { class: 'res-row' }, probRes.root, payRes.root),
      offeredRow
    ),
    h('div', { class: 'card card-inputs' },
      stakeF.root,
      legsEl,
      addBtn,
      h('div', { class: 'divider' }),
      offeredF.root
    )
  );

  state.legs.forEach((l) => addLeg(l));

  function render() {
    const mode = ctx.probMode();
    const unit = ctx.unitSize();
    const legs = state.legs.map(oddsValue);
    const stake = stakeDollars(state.stake, unit);
    const offeredAm = oddsValue(state.offered);
    const r = legs.length && legs.every(Number.isFinite) ? parlay(legs, Number.isFinite(stake) ? stake : 0, offeredAm) : null;
    stakeF.paint();
    probRes.setLabel(mode === 'cents' ? 'True price' : 'True probability');
    hero.setLabel(legs.length === 1 ? 'Fair odds (1 leg)' : 'Fair parlay odds · ' + legs.length + ' legs');

    if (!r) {
      hero.set('—'); probRes.set('—'); payRes.set('—');
      offeredRow.hidden = true;
      return;
    }
    hero.set(fmtOdds(r.american), fmtOdds(r.american, { ascii: true }), fmtDecimal(r.decimal) + ' decimal');
    probRes.set(fmtProb(r.prob, mode, r.prob < 0.01 ? 2 : 1));
    if (Number.isFinite(stake)) {
      setMoney(payRes, r.fairProfit, unit, { signed: true, tone: 'pos', sub: 'returns ' + fmtMoney(r.fairTotal) });
    } else {
      payRes.set('—');
    }

    if (r.offered && Number.isFinite(stake)) {
      offeredRow.hidden = false;
      setMoney(offRes, r.offered.profit, unit, { signed: true, tone: '', sub: 'returns ' + fmtMoney(r.offered.total) });
      const gap = r.offered.payoutGap;
      const gapText = Math.abs(gap) < 0.005 ? 'matches fair' : (gap < 0 ? fmtMoney(gap, { signed: true }) + ' vs fair' : fmtMoney(gap, { signed: true }) + ' vs fair');
      edgeRes.set(fmtPctSigned(r.offered.edge, 1), fmtPctSigned(r.offered.edge, 1), gapText, r.offered.edge > 1e-9 ? 'pos' : r.offered.edge < -1e-9 ? 'neg' : '');
    } else if (r.offered) {
      offeredRow.hidden = false;
      offRes.set('—');
      edgeRes.set(fmtPctSigned(r.offered.edge, 1), fmtPctSigned(r.offered.edge, 1), 'enter a stake for dollars', r.offered.edge > 1e-9 ? 'pos' : r.offered.edge < -1e-9 ? 'neg' : '');
    } else {
      offeredRow.hidden = true;
    }
  }

  return { id, title: 'Parlay', icon: ICON, root, render };
}
