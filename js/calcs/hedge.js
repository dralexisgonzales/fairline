// Hedge an open bet (mode A) or arbitrage two prices (mode B).
import { h, oddsField, oddsValue, stakeField, stakeDollars, segmented, result, setMoney, disclosure, debounce } from '../ui.js';
import { hedge, hedgeOutcomes, arb } from '../math.js';
import { fmtOdds, fmtMoney, fmtUnits, fmtPctSigned, fmtProb } from '../format.js';
import * as store from '../store.js';

export const ICON = '<path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z"/><path d="M9 12l2 2 4-4"/>';

export function create(ctx) {
  const id = 'hedge';
  const state = store.load('calc:' + id, {
    mode: 'A',
    A: { stake: { v: '100', mode: '$' }, orig: { sign: '+', v: '200' }, hedge: { sign: '-', v: '150' }, manual: { v: '', mode: '$' } },
    B: { a: { sign: '-', v: '110' }, b: { sign: '+', v: '120' }, total: { v: '1000', mode: '$' } },
  });
  const persist = debounce(() => store.save('calc:' + id, state));

  const modeSeg = segmented({
    options: [{ id: 'A', label: 'Hedge a bet' }, { id: 'B', label: 'Arbitrage' }],
    value: state.mode, cls: 'seg-full', label: 'Hedge mode',
    onChange: (m) => { state.mode = m; render(); persist(); },
  });

  // ----- Mode A: hedge an open bet -----
  const aHero = result({ label: 'Bet to lock profit', hero: true });
  const aLocked = result({ label: 'Locked profit' });
  const aBreak = result({ label: 'Bet to break even' });
  const aStake = stakeField({ label: 'Original stake', value: state.A.stake, ctx, onChange: (v) => { state.A.stake = v; render(); persist(); } });
  const aOrig = oddsField({ label: 'Original odds', value: state.A.orig, placeholder: '200', onChange: (v) => { state.A.orig = v; render(); persist(); } });
  const aHedge = oddsField({ label: 'Hedge odds now', value: state.A.hedge, placeholder: '150', onChange: (v) => { state.A.hedge = v; render(); persist(); } });
  const aManual = stakeField({ label: 'Hedge amount', value: state.A.manual, ctx, placeholder: '0', onChange: (v) => { state.A.manual = v; render(); persist(); } });
  const aWinO = result({ label: 'If original wins' });
  const aWinH = result({ label: 'If hedge bet wins' });
  const manual = disclosure({ label: 'Try a different hedge amount' },
    h('div', { class: 'res-row' }, aWinO.root, aWinH.root),
    aManual.root
  );

  const paneA = h('div', { class: 'pane' },
    h('div', { class: 'card card-hero' },
      aHero.root,
      h('div', { class: 'res-row' }, aLocked.root, aBreak.root)
    ),
    h('div', { class: 'card card-inputs' },
      aStake.root,
      h('div', { class: 'row-2' }, aOrig.root, aHedge.root)
    ),
    manual.root
  );

  // ----- Mode B: arbitrage -----
  const bHero = result({ label: 'Locked profit', hero: true });
  const bStakeA = result({ label: 'Put on side A' });
  const bStakeB = result({ label: 'Put on side B' });
  const bReturn = result({ label: 'Return either way', cls: 'res-line' });
  const bSum = result({ label: 'Combined implied', cls: 'res-pill' });
  const bA = oddsField({ label: 'Side A odds', value: state.B.a, onChange: (v) => { state.B.a = v; render(); persist(); } });
  const bB = oddsField({ label: 'Side B odds', value: state.B.b, placeholder: '120', onChange: (v) => { state.B.b = v; render(); persist(); } });
  const bTotal = stakeField({ label: 'Total to put in', value: state.B.total, ctx, placeholder: '1000', onChange: (v) => { state.B.total = v; render(); persist(); } });

  const paneB = h('div', { class: 'pane' },
    h('div', { class: 'card card-hero' },
      h('div', { class: 'card-head card-head-end' }, bSum.root),
      bHero.root,
      h('div', { class: 'res-row' }, bStakeA.root, bStakeB.root),
      bReturn.root
    ),
    h('div', { class: 'card card-inputs' },
      h('div', { class: 'row-2' }, bA.root, bB.root),
      bTotal.root
    )
  );

  const root = h('section', { class: 'screen', 'data-screen': id, hidden: true }, paneA, paneB);
  // The mode switch sits between the answer and the inputs, within thumb reach.
  paneA.insertBefore(modeSeg.root, paneA.children[1]);

  function renderA() {
    const unit = ctx.unitSize();
    aStake.paint(); aManual.paint();
    const stake = stakeDollars(state.A.stake, unit);
    const orig = oddsValue(state.A.orig);
    const hAm = oddsValue(state.A.hedge);
    if (!Number.isFinite(stake) || !Number.isFinite(orig) || !Number.isFinite(hAm) || !(stake > 0)) {
      aHero.setLabel('Bet to lock profit');
      aHero.set('—', null, 'Enter your stake and both odds');
      aLocked.set('—'); aBreak.set('—'); aWinO.set('—'); aWinH.set('—');
      return;
    }
    const r = hedge(stake, orig, hAm);
    const units = unit > 0 ? ' (' + fmtUnits(r.guaranteed / unit, { signed: true }) + ')' : '';
    if (r.guaranteed >= -0.005) {
      aHero.setLabel('Bet to lock profit at ' + fmtOdds(hAm));
      setMoney(aHero, r.equalStake, unit, { tone: '', sub: 'locks ' + fmtMoney(r.guaranteed, { signed: true }) + units + ' either way' });
      aLocked.setLabel('Locked profit');
    } else {
      aHero.setLabel('Bet to lock the result at ' + fmtOdds(hAm));
      setMoney(aHero, r.equalStake, unit, { tone: '', sub: 'locks ' + fmtMoney(r.guaranteed, { signed: true }) + units + ' either way' });
      aLocked.setLabel('Locked loss');
    }
    setMoney(aLocked, r.guaranteed, unit, { signed: true });
    if (r.breakEvenPossible) {
      setMoney(aBreak, r.breakEvenStake, unit, { tone: '', sub: fmtMoney(r.breakEvenIfOriginalWins, { signed: true }) + ' if original wins', unitsFirst: false });
    } else {
      aBreak.set('None', 'None', 'no hedge breaks even in both outcomes', 'neg');
    }
    const amount = stakeDollars(state.A.manual, unit);
    if (Number.isFinite(amount) && amount >= 0) {
      const o = hedgeOutcomes(stake, orig, amount, hAm);
      setMoney(aWinO, o.ifOriginalWins, unit, { signed: true });
      setMoney(aWinH, o.ifHedgeWins, unit, { signed: true });
    } else {
      aWinO.set('—', null, 'enter an amount');
      aWinH.set('—', null, 'enter an amount');
    }
  }

  function renderB() {
    const unit = ctx.unitSize();
    bTotal.paint();
    const a = oddsValue(state.B.a), b = oddsValue(state.B.b);
    const total = stakeDollars(state.B.total, unit);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      bHero.setLabel('Locked profit');
      bHero.set('—', null, 'Enter both prices');
      bStakeA.set('—'); bStakeB.set('—'); bReturn.set('—'); bSum.set('—');
      bSum.setLabel('Combined implied');
      return;
    }
    const r = arb(a, b, Number.isFinite(total) && total > 0 ? total : 0);
    bSum.setLabel(r.exists ? 'Arb · combined' : 'No arb · combined');
    bSum.set(fmtProb(r.sum, 'pct', 2), fmtProb(r.sum, 'pct', 2), '', r.exists ? 'pos' : 'neg');
    bStakeA.setLabel('Put on ' + fmtOdds(a));
    bStakeB.setLabel('Put on ' + fmtOdds(b));
    if (!(total > 0)) {
      bHero.setLabel(r.exists ? 'Locked return' : 'Locked loss');
      bHero.set(fmtPctSigned(r.roi, 2), fmtPctSigned(r.roi, 2), 'enter a total for dollars', r.exists ? 'pos' : 'neg');
      bStakeA.set(fmtProb(r.shareA, 'pct', 1), fmtProb(r.shareA, 'pct', 1), 'of total');
      bStakeB.set(fmtProb(r.shareB, 'pct', 1), fmtProb(r.shareB, 'pct', 1), 'of total');
      bReturn.set('—');
      return;
    }
    // Round side A to the cent and give the remainder to side B so the two always add up to the total.
    const sA = Math.round(r.stakeA * 100) / 100;
    const sB = Math.round((total - sA) * 100) / 100;
    bHero.setLabel(r.exists ? 'Locked profit' : 'Locked loss');
    setMoney(bHero, r.profit, unit, { signed: true, sub: fmtPctSigned(r.roi, 2) + ' on ' + fmtMoney(total), unitsFirst: false });
    setMoney(bStakeA, sA, unit, { tone: '', sub: fmtProb(r.shareA, 'pct', 1) });
    setMoney(bStakeB, sB, unit, { tone: '', sub: fmtProb(r.shareB, 'pct', 1) });
    setMoney(bReturn, r.returnTotal, unit, { tone: '' });
  }

  function render() {
    modeSeg.set(state.mode);
    paneA.hidden = state.mode !== 'A';
    paneB.hidden = state.mode !== 'B';
    if (state.mode === 'A') {
      paneA.insertBefore(modeSeg.root, paneA.children[1]);
      renderA();
    } else {
      paneB.insertBefore(modeSeg.root, paneB.children[1]);
      renderB();
    }
  }

  return { id, title: 'Hedge', icon: ICON, root, render };
}
