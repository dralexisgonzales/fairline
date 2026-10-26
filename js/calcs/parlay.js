// Parlay: odds and payout for a combo bet.
import { h, field, oddsValue, stakeDollars, result, setMoney, sentence, debounce, svg } from '../ui.js';
import { parlay } from '../math.js';
import { fmtOdds, fmtDecimal, fmtProb, fmtPctSigned, fmtMoney } from '../format.js';
import * as store from '../store.js';

export const ICON = '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="M3 13l9 5 9-5"/>';

export function create(ctx) {
  const id = 'parlay';
  const state = store.load('calc:' + id, {
    legs: [{ sign: '-', v: '110', ghost: true }, { sign: '-', v: '110', ghost: true }],
    stake: { v: '100', mode: '$', ghost: true },
    offered: { sign: '+', v: '', ghost: false },
  });
  if (!Array.isArray(state.legs) || state.legs.length === 0) state.legs = [{ sign: '-', v: '', ghost: false }];
  const persist = debounce(() => store.save('calc:' + id, state));

  const hero = result({ label: 'Parlay odds', hero: true });
  const say = sentence();
  const chanceRes = result({ label: 'Chance all legs hit' });
  const payRes = result({ label: 'Profit on your stake' });
  const bookSay = sentence();
  const countPill = h('span', { class: 'pill', text: '2 legs' });

  const stakeF = field({ type: 'money', label: 'Stake', value: state.stake, ctx, keypad: ctx.keypad, onChange: (v) => { state.stake = v; render(); persist(); } });
  const offeredF = field({ type: 'odds', label: 'Book’s parlay odds (optional)', value: state.offered, placeholder: '600', ctx, keypad: ctx.keypad, onChange: (v) => { state.offered = v; render(); persist(); } });
  offeredF.autoAdvance = false;

  const legsEl = h('div', { class: 'legs-list' });
  const legFields = [];
  const addBtn = h('button', { type: 'button', class: 'btn-row', onclick: () => addLeg({ sign: '-', v: '', ghost: false }, true) }, svg('<path d="M12 5v14M5 12h14"/>', 18), 'Add a leg');

  function addLeg(val, focus = false) {
    const idx = legFields.length;
    const f = field({ type: 'odds', label: 'Leg ' + (idx + 1), value: val, ctx, keypad: ctx.keypad, compact: true, onChange: (v) => { state.legs[legFields.indexOf(f)] = v; render(); persist(); } });
    const removeBtn = h('button', { type: 'button', class: 'leg-remove', 'aria-label': 'Remove leg', onclick: () => removeLeg(f) }, svg('<path d="M6 6l12 12M18 6L6 18"/>', 16));
    const row = h('div', { class: 'leg' }, f.el, removeBtn);
    f.row = row;
    legFields.push(f);
    if (state.legs[idx] == null) state.legs[idx] = val;
    legsEl.append(row);
    relabel(); render(); persist();
    ctx.keypad.setFields(fieldsList(), false);
    if (focus) ctx.keypad.focus(f);
  }
  function removeLeg(f) {
    if (legFields.length <= 1) return;
    const i = legFields.indexOf(f);
    legFields.splice(i, 1); state.legs.splice(i, 1); f.row.remove();
    relabel(); render(); persist();
    ctx.keypad.setFields(fieldsList(), false);
  }
  function relabel() {
    legFields.forEach((f, i) => { f.setLabel('Leg ' + (i + 1)); f.row.querySelector('.leg-remove').hidden = legFields.length <= 1; });
  }
  function fieldsList() { return [...legFields, stakeF, offeredF]; }

  const answer = h('div', { class: 'answer' },
    h('div', { class: 'screen-head' }, h('span', { class: 'screen-title', text: 'Parlay' }), countPill),
    hero.root, say.el,
    h('div', { class: 'tiles' }, chanceRes.root, payRes.root),
    bookSay.el
  );
  const root = h('section', { class: 'screen', 'data-screen': id, hidden: true },
    answer,
    h('div', { class: 'slots' },
      h('div', { class: 'slots-pinned' }, h('div', { class: 'row-2' }, stakeF.el, offeredF.el)),
      h('div', { class: 'slots-scroll' },
        legsEl, addBtn,
        h('div', { class: 'note', text: 'Legs multiply as you type them. For true fair odds, run each leg through Fair odds first.' })
      )
    )
  );
  state.legs.forEach((l) => addLeg(l));

  function render() {
    const unit = ctx.unitSize();
    const all = state.legs.map(oddsValue);
    const legs = all.filter(Number.isFinite);
    const stake = stakeDollars(state.stake, unit);
    const offeredAm = oddsValue(state.offered);
    const r = legs.length ? parlay(legs, Number.isFinite(stake) ? stake : 0, offeredAm) : null;
    stakeF.paint();
    countPill.textContent = (legs.length === all.length ? legs.length : legs.length + ' of ' + all.length) + (all.length === 1 ? ' leg' : ' legs');
    if (!r) {
      hero.set('—', null, ''); chanceRes.set('—'); payRes.set('—'); bookSay.set('');
      say.set('Add the odds of each pick. Every pick has to win.');
      return;
    }
    hero.setLabel('Parlay odds from these legs');
    hero.set(fmtOdds(r.american), fmtOdds(r.american, { ascii: true }), '', 'plain');
    chanceRes.set(fmtProb(r.prob, 'pct'), fmtProb(r.prob, 'pct'), 'decimal odds ' + fmtDecimal(r.decimal));
    if (Number.isFinite(stake)) {
      setMoney(payRes, r.fairProfit, unit, { signed: true, tone: 'pos', sub: 'gets back ' + fmtMoney(r.fairTotal), leadUnits: ctx.leadUnits() });
      say.set('All ' + legs.length + ' must win. That happens about ' + fmtProb(r.prob, 'pct') + ' of the time. ' + fmtMoney(stake) + ' would win ' + fmtMoney(r.fairProfit) + '.');
    } else {
      payRes.set('—', null, 'add a stake');
      say.set('All ' + legs.length + ' must win. That happens about ' + fmtProb(r.prob, 'pct') + ' of the time.');
    }
    if (r.offered && Number.isFinite(stake)) {
      const e = r.offered.edge;
      bookSay.set('At the book’s ' + fmtOdds(offeredAm) + ' you would win ' + fmtMoney(r.offered.profit) + ', ' + (Math.abs(e) < 0.0005 ? 'exactly what the legs imply.' : (fmtPctSigned(Math.abs(e), 1).replace(/^[+−]/, '') + (e < 0 ? ' worse' : ' better') + ' than the legs imply (' + fmtMoney(r.offered.payoutGap, { signed: true }) + ').')));
    } else if (r.offered) {
      bookSay.set('The book’s ' + fmtOdds(offeredAm) + ' is ' + fmtPctSigned(r.offered.edge, 1) + ' versus what the legs imply.');
    } else {
      bookSay.set('');
    }
  }

  return { id, title: 'Parlay', tab: 'Parlay', icon: ICON, root, render, fields: fieldsList };
}
