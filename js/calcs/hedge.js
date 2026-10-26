// Hedge a bet you already have, or bet both sides at two books.
import { h, field, oddsValue, stakeDollars, segmented, result, setMoney, sentence, examplePill, disclosure, debounce, svg } from '../ui.js';
import { hedge, hedgeOutcomes, arb } from '../math.js';
import { fmtOdds, fmtMoney, fmtPctSigned, fmtProb } from '../format.js';
import * as store from '../store.js';

export const ICON = '<path d="M4 8h13"/><path d="M14 5l3 3-3 3"/><path d="M20 16H7"/><path d="M10 13l-3 3 3 3"/>';

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
  const aLocked = result({ label: 'Locked result' });
  const aBreak = result({ label: 'Break-even bet' });
  const aHedge = field({ type: 'odds', label: 'Other side’s odds now', value: state.A.hedge, ctx, keypad: kp, onChange: (v) => { state.A.hedge = v; render(); persist(); } });
  const aOrig = field({ type: 'odds', label: 'Your bet’s odds', value: state.A.orig, ctx, keypad: kp, onChange: (v) => { state.A.orig = v; render(); persist(); } });
  const aStake = field({ type: 'money', label: 'Your stake', value: state.A.stake, ctx, keypad: kp, onChange: (v) => { state.A.stake = v; render(); persist(); } });
  const aManual = field({ type: 'money', label: 'Hedge amount to try', value: state.A.manual, placeholder: '0', ctx, keypad: kp, onChange: (v) => { state.A.manual = v; render(); persist(); } });
  const aWinO = result({ label: 'If your bet wins' });
  const aWinH = result({ label: 'If the other side wins' });
  const manual = disclosure({ label: 'Try a different hedge amount' }, aManual.el);
  manual.root.querySelector('.disclosure').addEventListener('click', () => setTimeout(() => { kp.setFields(fieldsList()); if (manual.isOpen()) kp.focus(aManual); else render(); }, 0));
  const exA = examplePill();
  const tilesA = h('div', { class: 'tiles' }, aLocked.root, aBreak.root);
  const tilesManual = h('div', { class: 'tiles', hidden: true }, aWinO.root, aWinH.root);

  const paneA = h('div', { class: 'pane-a' },
    h('div', { class: 'answer' },
      h('div', { class: 'screen-head' }, modeSeg.root, h('span', { class: 'spacer' }), exA.el),
      aHero.root, aSay.el,
      tilesA, tilesManual
    ),
    h('div', { class: 'slots' }, h('div', { class: 'row-2' }, aHedge.el, aOrig.el), aStake.el, manual.root)
  );

  // ----- B: both sides at two books -----
  const bHero = result({ label: 'Guaranteed profit', hero: true });
  const bSay = sentence();
  const bOnA = result({ label: 'Put on book A' });
  const bOnB = result({ label: 'Put on book B' });
  const bA = field({ type: 'odds', label: 'Book A odds', value: state.B.a, ctx, keypad: kp, onChange: (v) => { state.B.a = v; render(); persist(); } });
  const bB = field({ type: 'odds', label: 'Book B odds', value: state.B.b, ctx, keypad: kp, onChange: (v) => { state.B.b = v; render(); persist(); } });
  bB.el.addEventListener('click', () => { if (bB.text() === '' && state.B.a.sign === '-') bB.setSign('+'); });
  const exB = examplePill();
  const bTotal = field({ type: 'money', label: 'Total to split', value: state.B.total, ctx, keypad: kp, onChange: (v) => { state.B.total = v; render(); persist(); } });
  const modeSegB = segmented({ options: [{ id: 'A', label: 'Hedge a bet' }, { id: 'B', label: 'Both sides' }], value: state.mode, cls: 'seg-mini', label: 'Mode',
    onChange: (m) => { state.mode = m; render(); persist(); kp.setFields(fieldsList(), true); } });

  const paneB = h('div', { class: 'pane-b' },
    h('div', { class: 'answer' },
      h('div', { class: 'screen-head' }, modeSegB.root, h('span', { class: 'spacer' }), exB.el),
      bHero.root, bSay.el,
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
    exA.set([aHedge, aOrig, aStake].some((f) => f.isGhost()));
    answer.classList.toggle('is-example', [aHedge, aOrig, aStake].every((f) => f.isGhost()));
    const manualFocused = kp.active() === aManual;
    tilesManual.hidden = !manualFocused; tilesA.hidden = manualFocused;
    if (!Number.isFinite(stake) || !Number.isFinite(orig) || !Number.isFinite(hAm) || !(stake > 0)) {
      if (hadA) { answer.classList.add('is-stale'); return; }
      aHero.setLabel('Bet on the other side'); aHero.set('—', null, '');
      aSay.set('Enter the other side’s odds now, your bet’s odds, and what you staked.');
      aLocked.set('—'); aBreak.set('—'); aWinO.set('—'); aWinH.set('—');
      return;
    }
    answer.classList.remove('is-stale'); hadA = true;
    const r = hedge(stake, orig, hAm);
    const even = Math.abs(r.guaranteed) < 0.005;
    const profit = r.guaranteed > 0.005;
    aHero.setLabel('Bet this on the other side at ' + fmtOdds(hAm));
    setMoney(aHero, r.equalStake, unit, { tone: '', leadUnits: lead });
    const noHedge = hedgeOutcomes(stake, orig, 0, hAm);
    const unhedged = 'Without it: ' + fmtMoney(noHedge.ifOriginalWins, { signed: true }) + ' if your bet wins, ' + fmtMoney(noHedge.ifHedgeWins, { signed: true }) + ' if it loses.';
    if (profit) aSay.set('That locks in ' + fmtMoney(r.guaranteed, { signed: true }) + ' whichever side wins. ' + unhedged);
    else if (even) aSay.set('That gets you out flat: $0 either way. ' + unhedged);
    else aSay.set('No profit can be locked at these odds: this hedge loses ' + fmtMoney(-r.guaranteed) + ' either way. ' + unhedged);
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
    exB.set([bA, bB, bTotal].some((f) => f.isGhost()));
    answer.classList.toggle('is-example', [bA, bB, bTotal].every((f) => f.isGhost()));
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      if (hadB) { answer.classList.add('is-stale'); return; }
      bHero.setLabel('Guaranteed profit'); bHero.set('—', null, '');
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
      bSay.set('The two chances add up to ' + sumText + ', under 100%. Split it as shown and you get back ' + (total > 0 ? fmtMoney(r.returnTotal) : fmtPctSigned(r.roi, 2)) + ' whichever side wins (' + fmtPctSigned(r.roi, 2) + ').');
    } else if (Math.abs(r.roi) < 0.00005) {
      bSay.set('The two chances add up to exactly 100%: betting both sides gets your money back, no more.');
    } else {
      bSay.set('No guaranteed profit here: the two chances add up to ' + sumText + ', over 100%. Betting both sides would lose ' + fmtPctSigned(r.roi, 2).replace('\u2212', '') + '.');
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
