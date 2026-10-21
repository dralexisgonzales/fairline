// Hedge an open bet (mode A) or arbitrage two prices (mode B).
import { h, oddsField, oddsValue, stakeField, stakeDollars, segmented, result, setMoney, debounce } from '../ui.js';
import { hedge, hedgeOutcomes, arb } from '../math.js';
import { fmtOdds, fmtMoney, fmtPctSigned, fmtProb } from '../format.js';
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
    value: state.mode, cls: 'seg-full',
    onChange: (m) => { state.mode = m; render(); persist(); },
  });

  // ----- Mode A -----
  const aHero = result({ label: 'Locked profit', hero: true });
  const aEqual = result({ label: 'Equal-profit hedge' });
  const aBreak = result({ label: 'Break-even hedge' });
  const aStake = stakeField({ label: 'Original stake', value: state.A.stake, ctx, onChange: (v) => { state.A.stake = v; render(); persist(); } });
  const aOrig = oddsField({ label: 'Original odds', value: state.A.orig, placeholder: '200', onChange: (v) => { state.A.orig = v; render(); persist(); } });
  const aHedge = oddsField({ label: 'Hedge odds now', value: state.A.hedge, placeholder: '150', onChange: (v) => { state.A.hedge = v; render(); persist(); } });
  const aManual = stakeField({ label: 'Hedge amount', value: state.A.manual, ctx, placeholder: '0', onChange: (v) => { state.A.manual = v; render(); persist(); } });
  const aWinO = result({ label: 'If original wins' });
  const aWinH = result({ label: 'If hedge wins' });

  const paneA = h('div', { class: 'pane' },
    h('div', { class: 'card card-hero' },
      h('div', { class: 'card-head' }, h('span', { class: 'card-title', text: 'Hedge' })),
      aHero.root,
      h('div', { class: 'res-row' }, aEqual.root, aBreak.root)
    ),
    h('div', { class: 'card card-inputs' },
      aStake.root,
      h('div', { class: 'row-2' }, aOrig.root, aHedge.root)
    ),
    h('div', { class: 'card card-inputs' },
      h('div', { class: 'card-head' }, h('span', { class: 'card-title card-title-sm', text: 'Try any hedge amount' })),
      h('div', { class: 'res-row' }, aWinO.root, aWinH.root),
      aManual.root
    )
  );

  // ----- Mode B -----
  const bHero = result({ label: 'Locked profit', hero: true });
  const bStakeA = result({ label: 'Put on side A' });
  const bStakeB = result({ label: 'Put on side B' });
  const bReturn = result({ label: 'Return either way' });
  const bSum = result({ label: 'Combined implied', cls: 'res-pill' });
  const bA = oddsField({ label: 'Side A odds', value: state.B.a, onChange: (v) => { state.B.a = v; render(); persist(); } });
  const bB = oddsField({ label: 'Side B odds', value: state.B.b, placeholder: '120', onChange: (v) => { state.B.b = v; render(); persist(); } });
  const bTotal = stakeField({ label: 'Total to put in', value: state.B.total, ctx, placeholder: '1000', onChange: (v) => { state.B.total = v; render(); persist(); } });

  const paneB = h('div', { class: 'pane' },
    h('div', { class: 'card card-hero' },
      h('div', { class: 'card-head' }, h('span', { class: 'card-title', text: 'Arbitrage' }), bSum.root),
      bHero.root,
      h('div', { class: 'res-row' }, bStakeA.root, bStakeB.root),
      h('div', { class: 'res-row res-row-1' }, bReturn.root)
    ),
    h('div', { class: 'card card-inputs' },
      h('div', { class: 'row-2' }, bA.root, bB.root),
      bTotal.root
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
      aHero.set('—'); aEqual.set('—'); aBreak.set('—'); aWinO.set('—'); aWinH.set('—');
      aHero.setLabel('Locked profit');
      return;
    }
    const r = hedge(stake, orig, hAm);
    aHero.setLabel(r.guaranteed >= -0.005 ? 'Locked profit' : 'Locked loss');
    setMoney(aHero, r.guaranteed, unit, { signed: true, sub: 'hedge ' + fmtMoney(r.equalStake) + ' at ' + fmtOdds(hAm) });
    setMoney(aEqual, r.equalStake, unit, { tone: 'accent' });
    if (r.breakEvenPossible) {
      setMoney(aBreak, r.breakEvenStake, unit, { tone: 'accent', sub: 'original wins: ' + fmtMoney(r.breakEvenIfOriginalWins, { signed: true }) });
    } else {
      aBreak.set('None', 'None', 'any hedge locks a loss here', 'neg');
    }
    const manual = stakeDollars(state.A.manual, unit);
    if (Number.isFinite(manual) && manual >= 0) {
      const o = hedgeOutcomes(stake, orig, manual, hAm);
      setMoney(aWinO, o.ifOriginalWins, unit, { signed: true });
      setMoney(aWinH, o.ifHedgeWins, unit, { signed: true });
    } else {
      const o = hedgeOutcomes(stake, orig, 0, hAm);
      setMoney(aWinO, o.ifOriginalWins, unit, { signed: true, sub: 'no hedge' });
      setMoney(aWinH, o.ifHedgeWins, unit, { signed: true, sub: 'no hedge' });
    }
  }

  function renderB() {
    const unit = ctx.unitSize();
    bTotal.paint();
    const a = oddsValue(state.B.a), b = oddsValue(state.B.b);
    const total = stakeDollars(state.B.total, unit);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      bHero.set('—'); bStakeA.set('—'); bStakeB.set('—'); bReturn.set('—'); bSum.set('—');
      bHero.setLabel('Locked profit');
      return;
    }
    const r = arb(a, b, Number.isFinite(total) && total > 0 ? total : 0);
    bSum.setLabel(r.exists ? 'Arb' : 'No arb');
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
    bHero.setLabel(r.exists ? 'Locked profit' : 'Locked loss');
    setMoney(bHero, r.profit, unit, { signed: true, sub: fmtPctSigned(r.roi, 2) + ' on ' + fmtMoney(total) });
    setMoney(bStakeA, r.stakeA, unit, { tone: 'accent', sub: fmtProb(r.shareA, 'pct', 1) + ' of total' });
    setMoney(bStakeB, r.stakeB, unit, { tone: 'accent', sub: fmtProb(r.shareB, 'pct', 1) + ' of total' });
    setMoney(bReturn, r.returnTotal, unit, { tone: '' });
  }


  function render() {
    modeSeg.set(state.mode);
    paneA.hidden = state.mode !== 'A';
    paneB.hidden = state.mode !== 'B';
    if (state.mode === 'A') renderA(); else renderB();
  }

  return { id, title: 'Hedge', icon: ICON, root, render };
}
