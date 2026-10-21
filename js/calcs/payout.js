// Payout: risk -> win, or to win -> risk.
import { h, oddsField, oddsValue, stakeField, stakeDollars, segmented, result, setMoney, debounce } from '../ui.js';
import { payoutFromRisk, payoutFromWin, toImplied } from '../math.js';
import { fmtDecimal, fmtMoney, fmtProb, fmtOdds } from '../format.js';
import * as store from '../store.js';

export const ICON = '<circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M14.5 9.5h-3.25a1.75 1.75 0 0 0 0 3.5h1.5a1.75 1.75 0 0 1 0 3.5H9.5"/>';

export function create(ctx) {
  const id = 'payout';
  const state = store.load('calc:' + id, { mode: 'risk', amount: { v: '100', mode: '$' }, odds: { sign: '-', v: '110' } });
  const persist = debounce(() => store.save('calc:' + id, state));

  const hero = result({ label: 'Profit', hero: true });
  const totalRes = result({ label: 'Total return' });
  const impliedRes = result({ label: 'Implied probability' });
  const modeSeg = segmented({
    options: [{ id: 'risk', label: 'I’m risking' }, { id: 'win', label: 'I want to win' }],
    value: state.mode, cls: 'seg-full', label: 'Enter the risk or the amount to win',
    onChange: (m) => { state.mode = m; render(); persist(); },
  });

  const amountF = stakeField({ label: 'Risk', value: state.amount, ctx, onChange: (v) => { state.amount = v; render(); persist(); } });
  const oddsF = oddsField({ label: 'American odds', value: state.odds, onChange: (v) => { state.odds = v; render(); persist(); } });

  const root = h('section', { class: 'screen', 'data-screen': id, hidden: true },
    h('div', { class: 'card card-hero' },
      hero.root,
      h('div', { class: 'res-row' }, totalRes.root, impliedRes.root)
    ),
    modeSeg.root,
    h('div', { class: 'card card-inputs' }, amountF.root, oddsF.root)
  );

  function render() {
    const unit = ctx.unitSize();
    const mode = ctx.probMode();
    modeSeg.set(state.mode);
    amountF.setLabel(state.mode === 'risk' ? 'Risk' : 'To win');
    amountF.paint();
    const amount = stakeDollars(state.amount, unit);
    const am = oddsValue(state.odds);
    impliedRes.setLabel(mode === 'cents' ? 'Implied price' : 'Implied probability');
    impliedRes.set(fmtProb(toImplied(am), mode), fmtProb(toImplied(am), mode), Number.isFinite(am) ? fmtDecimal(payoutFromRisk(1, am).decimal) + ' decimal' : '');
    if (!Number.isFinite(amount) || !Number.isFinite(am) || !(amount > 0)) {
      hero.setLabel(state.mode === 'risk' ? 'Profit' : 'Risk needed');
      hero.set('—', null, state.mode === 'risk' ? 'Enter a stake and odds' : 'Enter an amount to win and odds');
      totalRes.set('—');
      return;
    }
    if (state.mode === 'risk') {
      const r = payoutFromRisk(amount, am);
      hero.setLabel('Profit');
      setMoney(hero, r.profit, unit, { signed: true, tone: 'pos', sub: 'risking ' + fmtMoney(amount) + ' at ' + fmtOdds(am), unitsFirst: false });
      setMoney(totalRes, r.total, unit, { tone: '' });
    } else {
      const r = payoutFromWin(amount, am);
      hero.setLabel('Risk needed');
      setMoney(hero, r.stake, unit, { tone: '', sub: 'to win ' + fmtMoney(amount) + ' at ' + fmtOdds(am), unitsFirst: false });
      setMoney(totalRes, r.total, unit, { tone: '' });
    }
  }

  return { id, title: 'Payout', icon: ICON, root, render };
}
