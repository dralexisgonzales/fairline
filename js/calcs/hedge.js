// Hedge a bet you already have, or bet both sides at two books.
import { h, field, oddsValue, stakeDollars, segmented, result, setMoney, sentence, examplePill, debounce, svg, committedBad } from '../ui.js';
import { hedge, hedgeOutcomes, arb } from '../math.js';
import { fmtOdds, fmtMoney, fmtUnits, fmtPctSigned, fmtProb } from '../format.js';
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
    onChange: (m) => { state.mode = m; root.scrollTop = 0; render(); persist(); kp.setFields(fieldsList()); if (kp.isOpen()) kp.focus(fieldsList()[0], false); ctx.relayout?.(); } });

  // ----- A: hedge an open bet -----
  const aHero = result({ label: 'Bet on the other side', hero: true, mini: 'Bet' });
  const aSay = sentence();
  aSay.el.classList.add('pane-say');
  const aLocked = result({ label: 'Locked result' });
  const aBreak = result({ label: 'Bet to lose nothing' });
  const aHedge = field({ type: 'odds', label: 'Other side', value: state.A.hedge, ctx, keypad: kp, onChange: (v) => { state.A.hedge = v; render(); persist(); } });
  const aOrig = field({ type: 'odds', label: 'Your odds', value: state.A.orig, ctx, keypad: kp, onChange: (v) => { state.A.orig = v; render(); persist(); } });
  const aStake = field({ type: 'money', label: 'Your stake', value: state.A.stake, ctx, keypad: kp, onChange: (v) => { state.A.stake = v; render(); persist(); } });
  const aManual = field({ type: 'money', label: 'Try another amount', value: state.A.manual, hint: 'optional', ctx, keypad: kp, onChange: (v) => { state.A.manual = v; render(); persist(); } });
  const aWinO = result({ label: 'If your bet wins' });
  const aWinH = result({ label: 'If the other side wins' });
  kp.onActive(() => { if (!root.hidden) render(); });
  const exA = examplePill();
  const tilesA = h('div', { class: 'tiles' }, aLocked.root, aBreak.root);
  const capMain = h('span'); const capSum = h('span', { class: 'cap-sum' });
  const manualCap = h('div', { class: 'tiles-cap' }, capMain, capSum);
  const tilesManual = h('div', { class: 'tiles tiles-whatif', hidden: true }, manualCap, aWinO.root, aWinH.root);

  const paneA = h('div', { class: 'pane-a' },
    h('div', { class: 'answer' },
      h('div', { class: 'screen-head' }, modeSeg.root, h('span', { class: 'spacer' }), exA.el),
      aHero.root, aSay.el,
      tilesA, tilesManual
    ),
    h('div', { class: 'slots' }, h('div', { class: 'row-2' }, aOrig.el, aStake.el), h('div', { class: 'row-2' }, aHedge.el, aManual.el))
  );

  // ----- B: both sides at two books -----
  const bHero = result({ label: 'Guaranteed profit', hero: true });
  const bSay = sentence();
  const bOnA = result({ label: 'Put on book A' });
  const bOnB = result({ label: 'Put on book B' });
  const bA = field({ type: 'odds', label: 'Book A', value: state.B.a, ctx, keypad: kp, onChange: (v) => { state.B.a = v; render(); persist(); } });
  const bB = field({ type: 'odds', label: 'Book B', value: state.B.b, ctx, keypad: kp, onChange: (v) => { state.B.b = v; render(); persist(); } });
  kp.onActive((f) => { if (f === bB && (bB.text() === '' || bB.isGhost()) && !bA.isGhost() && state.B.a.sign === '-' && bB.sign === '-') { bB.setSign('+'); state.B.b = bB.get(); render(); kp.refresh(); } });
  const exB = examplePill();
  const bTotal = field({ type: 'money', label: 'Total to split', value: state.B.total, ctx, keypad: kp, onChange: (v) => { state.B.total = v; render(); persist(); } });
  const modeSegB = segmented({ options: [{ id: 'A', label: 'Hedge a bet' }, { id: 'B', label: 'Both sides' }], value: state.mode, cls: 'seg-mini', label: 'Mode',
    onChange: (m) => { state.mode = m; root.scrollTop = 0; render(); persist(); kp.setFields(fieldsList()); if (kp.isOpen()) kp.focus(fieldsList()[0], false); ctx.relayout?.(); } });

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
    if (state.mode === 'A') return [aOrig, aStake, aHedge, aManual];
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
    exA.set([aHedge, aOrig, aStake].some((f) => f.isGhost()), [aHedge, aOrig, aStake].every((f) => f.isGhost()));
    answer.classList.toggle('is-example', [aHedge, aOrig, aStake].every((f) => f.isGhost()));
    const manualFocused = kp.active() === aManual;
    const manualHas = Number.isFinite(stakeDollars(state.A.manual, unit)) && stakeDollars(state.A.manual, unit) >= 0;
    tilesManual.hidden = !manualHas;
    tilesManual.classList.toggle('tiles-keep', manualFocused);
    answer.classList.toggle('whatif-focus', manualFocused);
    answer.classList.toggle('whatif-on', !tilesManual.hidden);
    if (!Number.isFinite(stake) || !Number.isFinite(orig) || !Number.isFinite(hAm) || !(stake > 0)) {
      if (hadA && !committedBad(ctx, aOrig, aHedge)) { answer.classList.add('is-stale'); aHero.setLabel('Waiting for a number'); return; }
      answer.classList.remove('is-stale');
      aHero.setLabel('Bet on the other side'); aHero.set('—', null, '');
      aSay.set(committedBad(ctx, aOrig, aHedge) ? 'Odds start at 100: fix the slot marked in red.' : 'Enter your bet’s odds, what you staked, and the other side’s odds now.');
      aLocked.set('—'); aBreak.set('—'); aWinO.set('—'); aWinH.set('—');
      if (manualHas) { capMain.textContent = 'With ' + (lead && unit > 0 ? fmtUnits(stakeDollars(state.A.manual, unit) / unit) : fmtMoney(stakeDollars(state.A.manual, unit)).replace(/\.00$/, '')) + ' on the other side instead:'; capSum.textContent = ''; }   // no stale what-if next to a dash
      return;
    }
    answer.classList.remove('is-stale'); hadA = true;
    const r = hedge(stake, orig, hAm);
    const even = Math.abs(r.guaranteed) < 0.005;
    const profit = r.guaranteed > 0.005;
    aHero.setLabel(profit ? 'Bet this on the other side at ' + fmtOdds(hAm) : even ? 'Bet this on the other side at ' + fmtOdds(hAm) + ' to get out flat' : 'Hedging at ' + fmtOdds(hAm) + ' loses either way; a full hedge is');
    setMoney(aHero, r.equalStake, unit, { tone: profit ? '' : 'muted', leadUnits: lead });
    const noHedge = hedgeOutcomes(stake, orig, 0, hAm);
    const m$ = (d) => (lead && unit > 0 ? fmtUnits(d / unit, { signed: true }) : fmtMoney(d, { signed: true }));
    const unhedged = 'Without the hedge you end up ' + m$(noHedge.ifOriginalWins) + ' or ' + m$(noHedge.ifHedgeWins) + '.';
    if (profit) aSay.set('Bet that much and you come out ahead whichever side wins. ' + unhedged);
    else if (even) aSay.set('Bet that much and you get out flat, $0 either way. ' + unhedged);
    else aSay.set('At these odds hedging loses a little whichever side wins; there is no profit to lock. ' + unhedged);
    aLocked.setLabel(even ? 'Locked result' : profit ? 'Locked profit' : 'Locked loss');
    setMoney(aLocked, r.guaranteed, unit, { signed: true, leadUnits: lead });
    if (r.breakEvenPossible) {
      aBreak.setLabel('Bet to lose nothing');
      setMoney(aBreak, r.breakEvenStake, unit, { tone: '', sub: 'your worst case becomes $0', unitsFirst: false, leadUnits: lead });
    } else {
      aBreak.setLabel('Bet to lose nothing');
      aBreak.set('None works', 'None works', 'no amount gets you out flat', '');
    }
    const amount = stakeDollars(state.A.manual, unit);
    if (Number.isFinite(amount) && amount >= 0) {
      const o = hedgeOutcomes(stake, orig, amount, hAm);
      capMain.textContent = 'With ' + (lead && unit > 0 ? fmtUnits(amount / unit) : fmtMoney(amount).replace(/\.00$/, '')) + ' on the other side instead:';
      capSum.textContent = (' ' + m$(o.ifOriginalWins) + ' if yours wins, ' + m$(o.ifHedgeWins) + ' if not').replace(/\u2212(?=[$\d])/g, '\u2212\u2060');
      aWinO.setLabel('Your bet wins'); aWinH.setLabel('Other side wins');
      setMoney(aWinO, o.ifOriginalWins, unit, { signed: true, leadUnits: lead });
      setMoney(aWinH, o.ifHedgeWins, unit, { signed: true, leadUnits: lead });
    } else { capMain.textContent = 'Try another amount on the other side:'; capSum.textContent = ''; aWinO.setLabel('Your bet wins'); aWinH.setLabel('Other side wins'); aWinO.set('—', null, 'enter an amount'); aWinH.set('—', null, 'enter an amount'); }
  }

  function renderB() {
    const unit = ctx.unitSize();
    const lead = ctx.leadUnits();
    bTotal.paint();
    const a = oddsValue(state.B.a), b = oddsValue(state.B.b);
    const total = stakeDollars(state.B.total, unit);
    const answer = paneB.querySelector('.answer');
    exB.set([bA, bB, bTotal].some((f) => f.isGhost()), [bA, bB, bTotal].every((f) => f.isGhost()));
    answer.classList.toggle('is-example', [bA, bB, bTotal].every((f) => f.isGhost()));
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      if (hadB && !committedBad(ctx, bA, bB)) { answer.classList.add('is-stale'); bHero.setLabel('Waiting for a number'); return; }
      answer.classList.remove('is-stale');
      bHero.setLabel('Guaranteed profit'); bHero.set('—', null, '');
      bSay.set(committedBad(ctx, bA, bB) ? 'Odds start at 100: fix the book marked in red.' : 'Enter one side’s odds at book A and the other side’s odds at book B.');
      bOnA.setLabel('Bet at book A'); bOnB.setLabel('Bet at book B'); bOnA.set('—'); bOnB.set('—');
      return;
    }
    answer.classList.remove('is-stale'); hadB = true;
    const r = arb(a, b, Number.isFinite(total) && total > 0 ? total : 0);
    const sumText = fmtProb(r.sum, 'pct', 2);
    const sA = Math.round(r.stakeA * 100) / 100;
    const sB = Math.round(((Number.isFinite(total) ? total : 0) - sA) * 100) / 100;
    bOnA.setLabel('Bet at book A \u00B7 ' + fmtOdds(a));
    bOnB.setLabel('Bet at book B \u00B7 ' + fmtOdds(b));
    if (!(total > 0)) {
      bHero.setLabel(r.exists ? 'Guaranteed return' : 'Guaranteed loss');
      bHero.set(fmtPctSigned(r.roi, 2), fmtPctSigned(r.roi, 2), '', r.exists ? 'pos' : 'neg');
      bOnA.set(fmtProb(r.shareA, 'pct', 1), fmtProb(r.shareA, 'pct', 1), 'of your total');
      bOnB.set(fmtProb(r.shareB, 'pct', 1), fmtProb(r.shareB, 'pct', 1), 'of your total');
    } else {
      bHero.setLabel(Math.abs(r.profit) < 0.005 ? 'Break even' : r.exists ? 'Guaranteed profit on ' + (lead ? fmtUnits(total / unit) : fmtMoney(total).replace(/\.00$/, '')) : 'Guaranteed loss on ' + (lead ? fmtUnits(total / unit) : fmtMoney(total).replace(/\.00$/, '')));
      setMoney(bHero, r.profit, unit, { signed: true, leadUnits: lead });
      setMoney(bOnA, sA, unit, { tone: '', sub: fmtProb(r.shareA, 'pct', 1) + ' of it', leadUnits: lead });
      setMoney(bOnB, sB, unit, { tone: '', sub: fmtProb(r.shareB, 'pct', 1) + ' of it', leadUnits: lead });
    }
    if (r.exists) {
      bSay.set(total > 0
        ? 'Together they return ' + fmtMoney(r.returnTotal) + ' whichever side wins, a ' + fmtPctSigned(r.roi, 2).replace(/^\+/, '') + ' profit. Place both before the odds move.'
        : 'Split your money as shown and you get back ' + fmtPctSigned(r.roi, 2) + ' whichever side wins. Add a total to see dollars.');
    } else if (Math.abs(r.roi) < 0.00005) {
      bSay.set('Betting both sides here gets exactly your money back, nothing more.');
    } else {
      bSay.set('No guaranteed profit here: betting both sides would lose ' + fmtPctSigned(r.roi, 2).replace('\u2212', '') + ' whichever side wins. It only works when the two prices disagree enough.');
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
