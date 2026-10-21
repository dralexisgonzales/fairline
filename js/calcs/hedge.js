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

  // The mode switch stays at the top so it never moves between modes.
  const modeSeg = segmented({
    options: [{ id: 'A', label: 'Hedge a bet' }, { id: 'B', label: 'Arbitrage' }],
    value: state.mode, cls: 'seg-full', label: 'Hedge mode',
    onChange: (m) => { state.mode = m; render(); persist(); },
  });

  // ----- Mode A: hedge an open bet -----
  const aHero = result({ label: 'Bet to lock profit', hero: true, mini: 'Bet' });
  const aLocked = result({ label: 'Locked profit', mini: 'Locked' });
  const aBreak = result({ label: 'Bet to break even' });
  const aStake = stakeField({ label: 'Original stake', value: state.A.stake, ctx, onChange: (v) => { state.A.stake = v; render(); persist(); } });
  const aOrig = oddsField({ label: 'Original odds', value: state.A.orig, placeholder: '200', onChange: (v) => { state.A.orig = v; render(); persist(); } });
  const aHedge = oddsField({ label: 'Hedge odds now', value: state.A.hedge, placeholder: '150', onChange: (v) => { state.A.hedge = v; render(); persist(); } });
  const aManual = stakeField({ label: 'Hedge amount', value: state.A.manual, ctx, placeholder: '0', onChange: (v) => { state.A.manual = v; render(); persist(); } });
  const aWinO = result({ label: 'If original wins' });
  const aWinH = result({ label: 'If hedge bet wins' });
  const manual = disclosure({ label: 'Try a different hedge amount' },
    aManual.root,
    h('div', { class: 'res-row' }, aWinO.root, aWinH.root)
  );

  const paneA = h('div', { class: 'pane' },
    h('div', { class: 'card card-hero' },
      aHero.root,
      h('div', { class: 'res-row' }, aLocked.root, aBreak.root)
    ),
    h('div', { class: 'card card-inputs' },
      h('div', { class: 'row-2' }, aHedge.root, aOrig.root),
      aStake.root
    ),
    manual.root
  );

  // ----- Mode B: arbitrage -----
  const bHero = result({ label: 'Locked profit', hero: true, mini: 'Profit' });
  const bStakeA = result({ label: 'Put on side A' });
  const bStakeB = result({ label: 'Put on side B' });
  const bSum = result({ label: 'Implied total', cls: 'res-line' });
  const bA = oddsField({ label: 'Side A odds', value: state.B.a, onChange: (v) => { state.B.a = v; render(); persist(); } });
  const bB = oddsField({ label: 'Side B odds', value: state.B.b, placeholder: '120', onChange: (v) => { state.B.b = v; render(); persist(); } });
  const bTotal = stakeField({ label: 'Total to put in', value: state.B.total, ctx, placeholder: '1000', onChange: (v) => { state.B.total = v; render(); persist(); } });

  const paneB = h('div', { class: 'pane' },
    h('div', { class: 'card card-hero' },
      bHero.root,
      h('div', { class: 'res-row' }, bStakeA.root, bStakeB.root),
      bSum.root
    ),
    h('div', { class: 'card card-inputs' },
      bTotal.root,
      h('div', { class: 'row-2' }, bA.root, bB.root)
    )
  );

  const root = h('section', { class: 'screen', 'data-screen': id, hidden: true }, modeSeg.root, paneA, paneB);

  function renderA() {
    const unit = ctx.unitSize();
    aStake.paint(); aManual.paint();
    const stake = stakeDollars(state.A.stake, unit);
    const orig = oddsValue(state.A.orig);
    const hAm = oddsValue(state.A.hedge);
    if (!Number.isFinite(stake) || !Number.isFinite(orig) || !Number.isFinite(hAm) || !(stake > 0)) {
      aHero.setLabel('Bet to lock profit');
      aHero.set('—', null, 'Enter the hedge odds, your odds and your stake');
      aLocked.set('—'); aBreak.set('—'); aWinO.set('—'); aWinH.set('—');
      return;
    }
    const r = hedge(stake, orig, hAm);
    const locksProfit = r.guaranteed >= -0.005;
    const even = Math.abs(r.guaranteed) < 0.005;
    aHero.setLabel((locksProfit ? 'Bet to lock profit at ' : 'Bet to lock the result at ') + fmtOdds(hAm));
    setMoney(aHero, r.equalStake, unit, { tone: '', sub: 'whichever side wins' });
    aLocked.setLabel(even ? 'Break even' : locksProfit ? 'Locked profit' : 'Locked loss');
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
      bStakeA.setLabel('Put on side A'); bStakeB.setLabel('Put on side B');
      delete bStakeA.root.dataset.miniText;
      bStakeA.set('—'); bStakeB.set('—'); bSum.set('—');
      bSum.setLabel('Implied total');
      return;
    }
    const r = arb(a, b, Number.isFinite(total) && total > 0 ? total : 0);
    let sumText = fmtProb(r.sum, 'pct', 2);
    if (r.exists && sumText === '100.00%') sumText = fmtProb(r.sum, 'pct', 3);   // never show "100.00%" next to "arb"
    if (r.exists && /^100\.0+%$/.test(sumText)) sumText = '<100%';
    bSum.setLabel(r.exists ? 'Implied total \u00B7 arb' : 'Implied total \u00B7 no arb');
    bSum.set(sumText, sumText, '', r.exists ? 'pos' : 'neg');
    bStakeA.setLabel('Put on ' + fmtOdds(a));
    bStakeB.setLabel('Put on ' + fmtOdds(b));
    if (!(total > 0)) {
      const even = Math.abs(r.roi) < 0.00005;
      bHero.setLabel(even ? 'Break even' : r.exists ? 'Locked return' : 'Locked loss');
      bHero.set(fmtPctSigned(r.roi, 2), fmtPctSigned(r.roi, 2), 'enter a total for dollars', even ? '' : r.exists ? 'pos' : 'neg');
      bStakeA.set(fmtProb(r.shareA, 'pct', 1), fmtProb(r.shareA, 'pct', 1), 'of total');
      bStakeB.set(fmtProb(r.shareB, 'pct', 1), fmtProb(r.shareB, 'pct', 1), 'of total');
      delete bStakeA.root.dataset.miniText;
      return;
    }
    // Round side A to the cent and give the remainder to side B so the two always add up to the total.
    const sA = Math.round(r.stakeA * 100) / 100;
    const sB = Math.round((total - sA) * 100) / 100;
    bHero.setLabel(Math.abs(r.profit) < 0.005 ? 'Break even' : r.exists ? 'Locked profit' : 'Locked loss');
    bHero.setMini(r.profit < -0.005 ? 'Loss' : 'Profit');
    setMoney(bHero, r.profit, unit, { signed: true, sub: fmtPctSigned(r.roi, 2) + ' on ' + fmtMoney(total) + ' \u00B7 returns ' + fmtMoney(r.returnTotal) + ' either way' });
    setMoney(bStakeA, sA, unit, { tone: '', sub: fmtProb(r.shareA, 'pct', 1) + ' of total' });
    setMoney(bStakeB, sB, unit, { tone: '', sub: fmtProb(r.shareB, 'pct', 1) + ' of total' });
    const whole = (x) => '$' + Math.round(x).toLocaleString('en-US');
    bStakeA.root.dataset.miniText = sA + sB >= 10000
      ? 'A ' + whole(sA) + ' \u00B7 B ' + whole(sB)        // keep the strip short on big totals
      : 'A ' + fmtMoney(sA) + ' \u00B7 B ' + fmtMoney(sB);
  }

  function render() {
    modeSeg.set(state.mode);
    paneA.hidden = state.mode !== 'A';
    paneB.hidden = state.mode !== 'B';
    if (state.mode === 'A') renderA(); else renderB();
  }

  return { id, title: 'Hedge', icon: ICON, root, render };
}
