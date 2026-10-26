// Payout: what a bet pays, or what to risk to win a target.
import { h, field, oddsValue, stakeDollars, segmented, result, setMoney, sentence, debounce } from '../ui.js';
import { payoutFromRisk, payoutFromWin, toImplied } from '../math.js';
import { fmtDecimal, fmtMoney, fmtProb, fmtOdds } from '../format.js';
import * as store from '../store.js';

export const ICON = '<circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M14.5 9.5h-3.25a1.75 1.75 0 0 0 0 3.5h1.5a1.75 1.75 0 0 1 0 3.5H9.5"/>';

export function create(ctx) {
  const id = 'payout';
  const state = store.load('calc:' + id, { mode: 'risk', amount: { v: '100', mode: '$', ghost: true }, odds: { sign: '-', v: '110', ghost: true } });
  const persist = debounce(() => store.save('calc:' + id, state));

  const hero = result({ label: 'Profit if it wins', hero: true });
  const say = sentence();
  const backRes = result({ label: 'You get back' });
  const needRes = result({ label: 'Must win this often' });
  const modeSeg = segmented({ options: [{ id: 'risk', label: 'I’m risking' }, { id: 'win', label: 'I want to win' }], value: state.mode, cls: 'seg-mini', label: 'Enter the risk or the target win',
    onChange: (m) => { state.mode = m; render(); persist(); } });

  const amountF = field({ type: 'money', label: 'Risk', value: state.amount, ctx, keypad: ctx.keypad, onChange: (v) => { state.amount = v; render(); persist(); } });
  const oddsF = field({ type: 'odds', label: 'Odds', value: state.odds, ctx, keypad: ctx.keypad, onChange: (v) => { state.odds = v; render(); persist(); } });

  const answer = h('div', { class: 'answer' },
    h('div', { class: 'screen-head' }, h('span', { class: 'screen-title', text: 'Payout' }), modeSeg.root),
    hero.root, say.el,
    h('div', { class: 'tiles' }, backRes.root, needRes.root)
  );
  const root = h('section', { class: 'screen', 'data-screen': id, hidden: true },
    answer,
    h('div', { class: 'slots' }, h('div', { class: 'row-2' }, amountF.el, oddsF.el))
  );

  let hadValid = false;
  function render() {
    const unit = ctx.unitSize();
    const lead = ctx.leadUnits();
    modeSeg.set(state.mode);
    amountF.setLabel(state.mode === 'risk' ? 'Risk' : 'I want to win');
    amountF.paint();
    const amount = stakeDollars(state.amount, unit);
    const am = oddsValue(state.odds);
    if (!Number.isFinite(amount) || !Number.isFinite(am) || !(amount > 0)) {
      if (hadValid) { answer.classList.add('is-stale'); return; }
      hero.setLabel(state.mode === 'risk' ? 'Profit if it wins' : 'You need to risk'); hero.set('—', null, '');
      say.set(state.mode === 'risk' ? 'Enter what you are risking and the odds.' : 'Enter how much you want to win and the odds.');
      backRes.set('—'); needRes.set('—');
      return;
    }
    answer.classList.remove('is-stale'); hadValid = true;
    needRes.set(fmtProb(toImplied(am), 'pct'), fmtProb(toImplied(am), 'pct'), 'to break even at ' + fmtOdds(am));
    if (state.mode === 'risk') {
      const r = payoutFromRisk(amount, am);
      hero.setLabel('Profit if it wins');
      setMoney(hero, r.profit, unit, { signed: true, tone: 'pos', leadUnits: lead });
      setMoney(backRes, r.total, unit, { tone: '', sub: 'stake included', leadUnits: lead });
      say.set('Risk ' + fmtMoney(amount) + ' at ' + fmtOdds(am) + ': win ' + fmtMoney(r.profit) + ' and get ' + fmtMoney(r.total) + ' back in total. Decimal odds ' + fmtDecimal(r.decimal) + '.');
    } else {
      const r = payoutFromWin(amount, am);
      hero.setLabel('You need to risk');
      setMoney(hero, r.stake, unit, { tone: 'plain', leadUnits: lead });
      setMoney(backRes, r.total, unit, { tone: '', sub: 'stake included', leadUnits: lead });
      say.set('To win ' + fmtMoney(amount) + ' at ' + fmtOdds(am) + ', risk ' + fmtMoney(r.stake) + '. You would get ' + fmtMoney(r.total) + ' back in total.');
    }
  }

  return { id, title: 'Payout', tab: 'Payout', icon: ICON, root, render, fields: () => [amountF, oddsF] };
}
