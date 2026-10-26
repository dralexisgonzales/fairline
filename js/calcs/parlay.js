// Parlay: odds and payout for a combo bet.
import { h, field, oddsValue, stakeDollars, result, setMoney, sentence, examplePill, debounce, svg } from '../ui.js';
import { parlay } from '../math.js';
import { fmtOdds, fmtDecimal, fmtProb, fmtPctSigned, fmtMoney, fmtUnits } from '../format.js';
import * as store from '../store.js';

export const ICON = '<path d="M10 14a4 4 0 0 1 0-5.7l2.3-2.3a4 4 0 0 1 5.7 5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 1 0 5.7l-2.3 2.3a4 4 0 0 1-5.7-5.7l1.2-1.2"/>';

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
  const ex = examplePill();

  const stakeF = field({ type: 'money', label: 'Stake', value: state.stake, ctx, keypad: ctx.keypad, onChange: (v) => { state.stake = v; render(); persist(); } });
  const offeredF = field({ type: 'odds', label: 'Book’s parlay odds', value: state.offered, placeholder: '600', hint: 'optional', ctx, keypad: ctx.keypad, onChange: (v) => { state.offered = v; render(); persist(); } });
  offeredF.autoAdvance = false;

  const legsEl = h('div', { class: 'legs-list' });
  const legFields = [];
  const addBtn = h('button', { type: 'button', class: 'btn-row', onclick: () => addLeg({ sign: '-', v: '', ghost: false }, true) }, svg('<path d="M12 5v14M5 12h14"/>', 18), 'Add a leg');
  const addHead = h('button', { type: 'button', class: 'pill pill-btn', 'aria-label': 'Add a leg', onclick: () => addLeg({ sign: '-', v: '', ghost: false }, true) }, svg('<path d="M12 5v14M5 12h14"/>', 16), 'Leg');

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
    ctx.keypad.setFields(fieldsList());
    if (focus) setTimeout(() => ctx.keypad.focus(f), 0);
  }
  function removeLeg(f) {
    if (legFields.length <= 1) return;
    const i = legFields.indexOf(f);
    const wasActive = ctx.keypad.active() === f;
    legFields.splice(i, 1); state.legs.splice(i, 1); f.row.remove();
    relabel(); render(); persist();
    ctx.keypad.setFields(fieldsList());
    if (wasActive) ctx.keypad.focus(legFields[Math.max(0, i - 1)]);
  }
  function relabel() {
    legFields.forEach((f, i) => { f.setLabel('Leg ' + (i + 1)); f.row.querySelector('.leg-remove').hidden = legFields.length <= 1; });
  }
  function fieldsList() { return [...legFields, stakeF, offeredF]; }

  const answer = h('div', { class: 'answer' },
    h('div', { class: 'screen-head' }, countPill, addHead, h('span', { class: 'spacer' }), ex.el),
    hero.root, say.el,
    h('div', { class: 'tiles' }, chanceRes.root, payRes.root)
  );
  const root = h('section', { class: 'screen', 'data-screen': id, hidden: true },
    answer,
    h('div', { class: 'slots' },
      legsEl,
      h('div', { class: 'row-2' }, stakeF.el, offeredF.el),
      bookSay.el,
      h('div', { class: 'note', text: 'To price it without the book\u2019s cut, run each leg through Fair odds first and enter those odds here.' })
    )
  );
  state.legs.forEach((l) => addLeg(l));

  function render() {
    const unit = ctx.unitSize();
    const lead = ctx.leadUnits();
    const money = (d) => (lead && unit > 0 ? fmtUnits(d / unit) : fmtMoney(d));
    const all = state.legs.map(oddsValue);
    const legs = all.filter(Number.isFinite);
    const stake = stakeDollars(state.stake, unit);
    const offeredAm = oddsValue(state.offered);
    const r = legs.length ? parlay(legs, Number.isFinite(stake) ? stake : 0, offeredAm) : null;
    stakeF.paint();
    legsEl.classList.toggle('two-col', legFields.length >= 4);
    ex.set(legFields.some((f) => f.isGhost()) || stakeF.isGhost(), legFields.every((f) => f.isGhost()) && stakeF.isGhost());
    answer.classList.toggle('is-example', legFields.every((f) => f.isGhost()));
    countPill.textContent = all.length + (all.length === 1 ? ' leg' : ' legs') + (legs.length < all.length ? ', ' + (all.length - legs.length) + ' blank' : '');
    if (!r) {
      hero.set('—', null, ''); chanceRes.set('—'); payRes.set('—'); bookSay.set('');
      say.set('Add the odds of each pick. Every pick has to win.');
      return;
    }
    hero.setLabel('These legs add up to');
    const bookSub = r.offered && Number.isFinite(stake) ? ('Book’s ' + fmtOdds(offeredAm) + ' pays ' + (Math.abs(r.offered.payoutGap) < 0.005 ? 'the same' : money(Math.abs(r.offered.payoutGap)) + (r.offered.payoutGap < 0 ? ' less' : ' more'))) : (r.offered ? 'Book’s ' + fmtOdds(offeredAm) + ' pays ' + fmtPctSigned(Math.abs(r.offered.edge), 1).replace(/^[+−]/, '') + (r.offered.edge < 0 ? ' less' : ' more') : '');
    hero.set(fmtOdds(r.american), fmtOdds(r.american, { ascii: true }), bookSub || (Number.isFinite(stake) ? money(stake) + ' wins ' + money(r.fairProfit) : ''));
    chanceRes.set(fmtProb(r.prob, 'pct'), fmtProb(r.prob, 'pct'), r.prob > 0 && r.prob < 0.5 ? 'about 1 in ' + Math.round(1 / r.prob) : '');
    if (Number.isFinite(stake) && r.offered) {
      payRes.setLabel('Profit at book’s ' + fmtOdds(offeredAm));
      setMoney(payRes, r.offered.profit, unit, { signed: true, tone: 'pos', sub: 'gets back ' + fmtMoney(r.offered.total), leadUnits: lead });
      say.set('Every leg must win for it to pay. The book pays its own odds, not the ones the legs add up to.');
    } else if (Number.isFinite(stake)) {
      payRes.setLabel('Profit on your stake');
      setMoney(payRes, r.fairProfit, unit, { signed: true, tone: 'pos', sub: 'gets back ' + fmtMoney(r.fairTotal), leadUnits: lead });
      say.set('Every leg must win for it to pay. Add the book’s parlay odds below to compare.');
    } else {
      payRes.setLabel('Profit on your stake'); payRes.set('—', null, 'add a stake');
      say.set('Every leg must win.');
    }
    if (r.offered && Number.isFinite(stake)) {
      const e = r.offered.edge;
      const gap = r.offered.payoutGap;
      const pct = fmtPctSigned(Math.abs(e), 1).replace(/^[+−]/, '');
      bookSay.set('The book’s ' + fmtOdds(offeredAm) + ' would pay ' + fmtMoney(r.offered.profit) + '. These legs add up to ' + fmtOdds(r.american) + ', which would pay ' + fmtMoney(r.fairProfit) + ', so the book pays ' + (Math.abs(gap) < 0.005 ? 'exactly that.' : fmtMoney(Math.abs(gap)) + (gap < 0 ? ' less' : ' more') + ' (' + pct + (gap < 0 ? ' worse' : ' better') + ' value).'));
    } else if (r.offered) {
      bookSay.set('The book’s ' + fmtOdds(offeredAm) + ' pays ' + fmtPctSigned(r.offered.edge, 1) + ' versus what these legs add up to. Add a stake to see dollars.');
    } else {
      bookSay.set('');
    }
  }

  return { id, title: 'Parlay', tab: 'Parlay', icon: ICON, root, render, fields: fieldsList };
}
