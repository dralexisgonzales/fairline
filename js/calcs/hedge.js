// Hedge a bet you already have, or bet both sides at two books.
import { h, field, oddsValue, stakeDollars, segmented, result, setMoney, sentence, disclosure, debounce, svg } from '../ui.js';
import { hedge, hedgeOutcomes, arb } from '../math.js';
import { fmtOdds, fmtMoney, fmtPctSigned, fmtProb } from '../format.js';
import * as store from '../store.js';

export const ICON = '<path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z"/><path d="M9 12l2 2 4-4"/>';

export function create(ctx) {
  const id = 'hedge';
  const state = store.load('calc:' + id, {
    mode: 'A',
    A: { hedge: { sign: '-', v: '150', ghost: true }, orig: { sign: '+', v: '200', ghost: true }, stake: { v: '100', mode: '$', ghost: true }, manual: { v: '', mode: '$', ghost: false } },
    B: { a: { sign: '-', v: '110', ghost: true }, b: { sign: '+', v: '120', ghost: true }, total: { v: '1000', mode: '$', ghost: true } },
  });
  const persist = debounce(() => store.save('calc:' + id, state));
  const kp = ctx.keypad;

  const modeSeg = segmented({ options: [{ id: 'A', label: 'Hedge a bet' }, { id: 'B', label: 'Both sides' }], value: state.mode, cls: 'seg-mini', label: 'Mode',
    onChange: (m) => { state.mode = m; render(); persist(); kp.setFields(fieldsList(), true); } });

  // ----- A: hedge an open bet -----
  const aHero = result({ label: 'Bet on the other side', hero: true, mini: 'Bet' });
  const aSay = sentence();
  const aVerdict = h('div', { class: 'verdict', hidden: true });
  const aLocked = result({ label: 'Locked result' });
  const aBreak = result({ label: 'Break-even bet' });
  const aHedge = field({ type: 'odds', label: 'Other side’s odds now', value: state.A.hedge, ctx, keypad: kp, onChange: (v) => { state.A.hedge = v; render(); persist(); } });
  const aOrig = field({ type: 'odds', label: 'Your bet’s odds', value: state.A.orig, ctx, keypad: kp, onChange: (v) => { state.A.orig = v; render(); persist(); } });
  const aStake = field({ type: 'money', label: 'Your stake', value: state.A.stake, ctx, keypad: kp, onChange: (v) => { state.A.stake = v; render(); persist(); } });
  const aManual = field({ type: 'money', label: 'Hedge amount to try', value: state.A.manual, placeholder: '0', ctx, keypad: kp, onChange: (v) => { state.A.manual = v; render(); persist(); } });
  const aWinO = result({ label: 'If your bet wins' });
  const aWinH = result({ label: 'If the other side wins' });
  const manual = disclosure({ label: 'Try a different hedge amount' }, aManual.el, h('div', { class: 'tiles' }, aWinO.root, aWinH.root));
  manual.root.querySelector('.disclosure').addEventListener('click', () => setTimeout(() => kp.setFields(fieldsList(), false), 0));

  const paneA = h('div', { class: 'pane-a' },
    h('div', { class: 'answer' },
      h('div', { class: 'screen-head' }, h('span', { class: 'screen-title', text: 'Hedge' }), modeSeg.root),
      aHero.root, aSay.el, aVerdict,
      h('div', { class: 'tiles' }, aLocked.root, aBreak.root)
    ),
    h('div', { class: 'slots' }, h('div', { class: 'row-2' }, aHedge.el, aOrig.el), aStake.el, manual.root)
  );

  // ----- B: both sides at two books -----
  const bHero = result({ label: 'Guaranteed profit', hero: true });
  const bSay = sentence();
  const bVerdict = h('div', { class: 'verdict', hidden: true });
  const bOnA = result({ label: 'Put on book A' });
  const bOnB = result({ label: 'Put on book B' });
  const bA = field({ type: 'odds', label: 'Book A odds', value: state.B.a, ctx, keypad: kp, onChange: (v) => { state.B.a = v; render(); persist(); } });
  const bB = field({ type: 'odds', label: 'Book B odds (other side)', value: state.B.b, ctx, keypad: kp, onChange: (v) => { state.B.b = v; render(); persist(); } });
  const bTotal = field({ type: 'money', label: 'Total to split', value: state.B.total, ctx, keypad: kp, onChange: (v) => { state.B.total = v; render(); persist(); } });
  const modeSegB = segmented({ options: [{ id: 'A', label: 'Hedge a bet' }, { id: 'B', label: 'Both sides' }], value: state.mode, cls: 'seg-mini', label: 'Mode',
    onChange: (m) => { state.mode = m; render(); persist(); kp.setFields(fieldsList(), true); } });

  const paneB = h('div', { class: 'pane-b' },
    h('div', { class: 'answer' },
      h('div', { class: 'screen-head' }, h('span', { class: 'screen-title', text: 'Both sides' }), modeSegB.root),
      bHero.root, bSay.el, bVerdict,
      h('div', { class: 'tiles' }, bOnA.root, bOnB.root)
    ),
    h('div', { class: 'slots' }, h('div', { class: 'row-2' }, bA.el, bB.el), bTotal.el)
  );
  [paneA, paneB].forEach((p) => { p.style.display = 'contents'; });

  const root = h('section', { class: 'screen', 'data-screen': id, hidden: true }, paneA, paneB);

  function fieldsList() {
    if (state.mode === 'A') return manual.isOpen() ? [aHedge, aOrig, aStake, aManual] : [aHedge, aOrig, aStake];
    return [bA, bB, bTotal];
  }

  let hadA = false, hadB = false;
  function renderA() {
    const unit = ctx.unitSize();
    const lead = ctx.leadUnits();
    aStake.paint(); aManual.paint();
    const stake = stakeDollars(state.A.stake, unit);
    const orig = oddsValue(state.A.orig);
    const hAm = oddsValue(state.A.hedge);
    const answer = paneA.querySelector('.answer');
    if (!Number.isFinite(stake) || !Number.isFinite(orig) || !Number.isFinite(hAm) || !(stake > 0)) {
      if (hadA) { answer.classList.add('is-stale'); return; }
      aHero.setLabel('Bet on the other side'); aHero.set('—', null, '');
      aSay.set('Enter the other side’s odds now, your bet’s odds, and what you staked.');
      aVerdict.hidden = true; aLocked.set('—'); aBreak.set('—'); aWinO.set('—'); aWinH.set('—');
      return;
    }
    answer.classList.remove('is-stale'); hadA = true;
    const r = hedge(stake, orig, hAm);
    const even = Math.abs(r.guaranteed) < 0.005;
    const profit = r.guaranteed > 0.005;
    aHero.setLabel('Bet this on the other side at ' + fmtOdds(hAm));
    setMoney(aHero, r.equalStake, unit, { tone: 'plain', leadUnits: lead });
    const noHedge = hedgeOutcomes(stake, orig, 0, hAm);
    if (profit) {
      aSay.set('You win ' + fmtMoney(r.guaranteed, { signed: true }) + ' whichever side wins. Unhedged: ' + fmtMoney(noHedge.ifOriginalWins, { signed: true }) + ' or ' + fmtMoney(noHedge.ifHedgeWins, { signed: true }) + '.');
      aVerdict.hidden = true;
    } else if (even) {
      aSay.set('That gets you out flat: $0 either way. Unhedged: ' + fmtMoney(noHedge.ifOriginalWins, { signed: true }) + ' or ' + fmtMoney(noHedge.ifHedgeWins, { signed: true }) + '.');
      aVerdict.hidden = true;
    } else {
      aSay.set('Hedging locks in a ' + fmtMoney(-r.guaranteed) + ' loss either way. Unhedged: ' + fmtMoney(noHedge.ifOriginalWins, { signed: true }) + ' or ' + fmtMoney(noHedge.ifHedgeWins, { signed: true }) + '.');
      aVerdict.replaceChildren(svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>', 18), 'No profit can be locked at these odds');
      aVerdict.hidden = false;
    }
    aLocked.setLabel(even ? 'Locked result' : profit ? 'Locked profit' : 'Locked loss');
    setMoney(aLocked, r.guaranteed, unit, { signed: true, leadUnits: lead });
    if (r.breakEvenPossible) {
      aBreak.setLabel('Break-even bet');
      setMoney(aBreak, r.breakEvenStake, unit, { tone: '', sub: '$0 if your bet loses', unitsFirst: false, leadUnits: lead });
    } else {
      aBreak.setLabel('Break-even bet');
      aBreak.set('None', 'None', 'not possible at these odds', 'neg');
    }
    const amount = stakeDollars(state.A.manual, unit);
    if (Number.isFinite(amount) && amount >= 0) {
      const o = hedgeOutcomes(stake, orig, amount, hAm);
      setMoney(aWinO, o.ifOriginalWins, unit, { signed: true, leadUnits: lead });
      setMoney(aWinH, o.ifHedgeWins, unit, { signed: true, leadUnits: lead });
    } else { aWinO.set('—', null, 'enter an amount'); aWinH.set('—', null, 'enter an amount'); }
  }

  function renderB() {
    const unit = ctx.unitSize();
    const lead = ctx.leadUnits();
    bTotal.paint();
    const a = oddsValue(state.B.a), b = oddsValue(state.B.b);
    const total = stakeDollars(state.B.total, unit);
    const answer = paneB.querySelector('.answer');
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      if (hadB) { answer.classList.add('is-stale'); return; }
      bHero.setLabel('Guaranteed profit'); bHero.set('—', null, ''); bVerdict.hidden = true;
      bSay.set('Enter one side’s odds at book A and the other side’s odds at book B.');
      bOnA.set('—'); bOnB.set('—');
      return;
    }
    answer.classList.remove('is-stale'); hadB = true;
    const r = arb(a, b, Number.isFinite(total) && total > 0 ? total : 0);
    const sumText = fmtProb(r.sum, 'pct', 2);
    bOnA.setLabel('Put on book A at ' + fmtOdds(a));
    bOnB.setLabel('Put on book B at ' + fmtOdds(b));
    if (!(total > 0)) {
      bHero.setLabel(r.exists ? 'Guaranteed return' : 'Guaranteed loss');
      bHero.set(fmtPctSigned(r.roi, 2), fmtPctSigned(r.roi, 2), '', r.exists ? 'pos' : 'neg');
      bOnA.set(fmtProb(r.shareA, 'pct', 1), fmtProb(r.shareA, 'pct', 1), 'of your total');
      bOnB.set(fmtProb(r.shareB, 'pct', 1), fmtProb(r.shareB, 'pct', 1), 'of your total');
    } else {
      const sA = Math.round(r.stakeA * 100) / 100;
      const sB = Math.round((total - sA) * 100) / 100;
      bHero.setLabel(Math.abs(r.profit) < 0.005 ? 'Break even' : r.exists ? 'Guaranteed profit on ' + fmtMoney(total) : 'Guaranteed loss on ' + fmtMoney(total));
      setMoney(bHero, r.profit, unit, { signed: true, leadUnits: lead });
      setMoney(bOnA, sA, unit, { tone: '', sub: fmtProb(r.shareA, 'pct', 1) + ' of it', leadUnits: lead });
      setMoney(bOnB, sB, unit, { tone: '', sub: fmtProb(r.shareB, 'pct', 1) + ' of it', leadUnits: lead });
    }
    if (r.exists) {
      bVerdict.hidden = true;
      bSay.set('The two prices add up to ' + sumText + ', under 100%. Split as shown and you get back ' + (total > 0 ? fmtMoney(r.returnTotal) : fmtPctSigned(r.roi, 2)) + ' whichever side wins (' + fmtPctSigned(r.roi, 2) + ').');
    } else {
      bSay.set('The two prices add up to ' + sumText + '. Only under 100% can you bet both sides and profit. Here you would lose ' + fmtPctSigned(r.roi, 2).replace('−', '') + '.');
      bVerdict.replaceChildren(svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>', 18), 'No guaranteed profit at these prices');
      bVerdict.hidden = Math.abs(r.roi) < 0.00005;
    }
  }

  function render() {
    modeSeg.set(state.mode); modeSegB.set(state.mode);
    paneA.hidden = state.mode !== 'A';
    paneB.hidden = state.mode !== 'B';
    if (state.mode === 'A') renderA(); else renderB();
  }

  return { id, title: 'Hedge', tab: 'Hedge', icon: ICON, root, render, fields: fieldsList };
}
