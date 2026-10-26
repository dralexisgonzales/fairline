// Odds <-> chance.
import { h, field, oddsValue, segmented, result, sentence, examplePill, parseNum, debounce } from '../ui.js';
import { toImplied, probToAmerican, probToDecimal, effectivePrice } from '../math.js';
import { fmtOdds, fmtDecimal, fmtProb, fmtCentsExact } from '../format.js';
import * as store from '../store.js';

export const ICON = '<path d="M7 4v16"/><path d="M3 8l4-4 4 4"/><path d="M17 20V4"/><path d="M13 16l4 4 4-4"/>';
const trim = (n, d) => Number.isFinite(n) ? String(Number(n.toFixed(d))) : '';
const tidy = (t) => t.replace(/\.0(?=[%\u00A2])/, '');

export function create(ctx) {
  const id = 'convert';
  const state = store.load('calc:' + id, { src: 'odds', odds: { sign: '-', v: '110', ghost: true }, prob: { v: '', ghost: false } });
  if (typeof state.prob === 'string') state.prob = { v: state.prob, ghost: false };
  const persist = debounce(() => store.save('calc:' + id, state));

  const hero = result({ label: 'Chance to win', hero: true });
  const say = sentence();
  const modeSeg = segmented({ options: [{ id: 'pct', label: 'Percent' }, { id: 'cents', label: 'Cents' }], value: ctx.probMode(), cls: 'seg-mini', label: 'Show chance as percent or cents', onChange: (m) => { ctx.setProbMode(m); if (ctx.keypad.isOpen()) ctx.keypad.focus(probF, false); } });

  const oddsF = field({ type: 'odds', label: 'Odds', value: state.odds, ctx, keypad: ctx.keypad, onChange: (v) => { state.odds = v; if (state.src !== 'odds') { state.src = 'odds'; ctx.keypad.setFields([oddsF, probF]); } render(); persist(); } });
  const probF = field({ type: 'percent', label: 'Chance to win', value: state.prob, suffix: '%', placeholder: '\u2014', maxLen: 6, ctx, keypad: ctx.keypad, onChange: (v) => { state.prob = v; if (state.src !== 'prob') { state.src = 'prob'; ctx.keypad.setFields([probF, oddsF]); } render(); persist(); } });
  oddsF.noAdvance = true; probF.noAdvance = true;
  // Tapping the calculated box does not change anything until the first key: the old answer stays until there is a new one.

  const ex = examplePill();
  const feePill = h('button', { type: 'button', class: 'pill pill-btn pill-fee', hidden: true, 'aria-label': 'Change the fee', onclick: () => ctx.openSettings('fee') });
  const answer = h('div', { class: 'answer' },
    h('div', { class: 'screen-head' }, modeSeg.root, feePill, h('span', { class: 'spacer' }), ex.el),
    hero.root, say.el
  );
  const root = h('section', { class: 'screen', 'data-screen': id, hidden: true },
    answer,
    h('div', { class: 'slots' }, h('div', { class: 'row-2' }, oddsF.el, probF.el))
  );

  ctx.keypad.onActive(() => { if (!root.hidden) render(); });
  let hadValid = false;
  function render() {
    const cents = ctx.probMode() === 'cents';
    ex.set(oddsF.isGhost() || probF.isGhost(), true);
    answer.classList.toggle('is-example', oddsF.isGhost() && state.src === 'odds');
    modeSeg.set(ctx.probMode());
    feePill.hidden = !cents;
    feePill.textContent = ctx.feePreset().short || 'No fee';
    probF.setSuffix(cents ? '¢' : '%');
    probF.setLabel(cents ? 'Price in cents' : 'Chance to win');
    let p = NaN, am = NaN;
    if (state.src === 'odds') {
      am = oddsValue(state.odds);
      p = toImplied(am);
      const feeBox = cents && ctx.feeRate() > 0 && Number.isFinite(p);
      const boxP = feeBox ? listedPriceFor(p, ctx.feeRate()) : p;
      probF.set({ v: Number.isFinite(boxP) ? (boxP * 100).toFixed(boxP < 0.01 || boxP > 0.995 ? 2 : 1) : '', ghost: false });
      probF.el.classList.add('is-computed'); oddsF.el.classList.remove('is-computed');
      probF.setSub(Number.isFinite(p) ? (ctx.keypad.active() === probF ? 'type to change it' : feeBox ? 'listed price to buy at' : 'calculated') : '');
    } else {
      const pv = parseNum(state.prob.v);
      p = pv > 0 && pv < 100 ? pv / 100 : NaN;
      am = probToAmerican(p);
      // The calculated box shows the odds you really get, which with a fee are the all-in odds.
      const shownAm = (cents && ctx.feeRate() > 0 && Number.isFinite(am)) ? probToAmerican(effectivePrice(p, ctx.feeRate()).price) : am;
      const txt = Number.isFinite(shownAm) ? fmtOdds(shownAm, { ascii: true }) : '';
      oddsF.set(txt ? { sign: txt.startsWith('-') ? '-' : '+', v: txt.slice(1), ghost: false } : { sign: '-', v: '', ghost: false });
      oddsF.el.classList.add('is-computed'); probF.el.classList.remove('is-computed');
      oddsF.setSub(Number.isFinite(am) ? (ctx.keypad.active() === oddsF ? 'type to change it' : (cents && ctx.feeRate() > 0 ? 'with the fee' : 'calculated')) : '');
      const bad = Number.isFinite(pv) && pv >= 100;
      probF.setSub(Number.isFinite(pv) && !(pv > 0 && pv < 100) ? 'Use a number above 0 and below 100' : '', bad ? 'is-error' : '');
    }
    if (state.src === 'odds') { if (!oddsF.el.classList.contains('is-invalid')) oddsF.setSub(''); } else if (!Number.isFinite(parseNum(state.prob.v)) || (parseNum(state.prob.v) > 0 && parseNum(state.prob.v) < 100)) probF.setSub('');

    const committedBad = state.src === 'odds' && oddsF.el.classList.contains('is-invalid') && ctx.keypad.active() !== oddsF;
    if (!Number.isFinite(p)) {
      answer.classList.remove('is-stale');
      if (hadValid && !committedBad) {
        answer.classList.add('is-stale'); hero.setLabel('Waiting for a number');
        if (state.src === 'odds') probF.set({ v: '', ghost: false }); else oddsF.set({ sign: state.odds.sign || '-', v: '', ghost: false });
        return;
      }
      hero.setLabel(state.src === 'odds' ? (cents ? 'Price' : 'Chance to win') : 'American odds');
      hero.set('—', null, '');
      say.set(state.src === 'odds' ? (committedBad ? 'Odds start at 100: type something like \u2212110 or +150.' : 'Type odds like \u2212110 or +150.') : (cents ? 'Type a price in cents, like 62.' : 'Type a chance like 52.4.'));
      return;
    }
    answer.classList.remove('is-stale'); hadValid = true;
    const dec = probToDecimal(p);
    const rate = ctx.feeRate();
    const label = ctx.feePreset().label;
    if (state.src === 'odds') {
      const feeOn = cents && rate > 0;
      const shownP = feeOn ? listedPriceFor(p, rate) : p;   // buy at this listed price and, after the fee, you really get these odds
      hero.setLabel((cents ? 'Price for ' : 'Chance to win at ') + fmtOdds(am) + (feeOn ? ' with ' + feeName(label) + ' fee' : ''));
      hero.set(fmtProb(shownP, cents ? 'cents' : 'pct'), fmtProb(shownP, cents ? 'cents' : 'pct'), feeOn ? 'you really pay ' + fmtProb(p, 'cents', 1) + ' after the fee' : 'decimal odds ' + fmtDecimal(dec));
      let t = 'A ' + fmtOdds(am) + ' bet has to win that often just to break even.';
      if (cents) t = feeOn
        ? 'On ' + feeName(label) + ', buy at ' + fmtProb(shownP, 'cents', 1) + ': with the fee you really pay ' + fmtProb(p, 'cents', 1) + ', which is ' + fmtOdds(am) + '. You get $1 back if it wins.'
        : 'On Novig, Kalshi or Polymarket, ' + fmtOdds(am) + ' is a ' + tidy(fmtProb(p, 'cents')) + ' price: pay that now, get $1 back if it wins. ' + feeLine(p, rate, label);
      say.set(t);
    } else {
      // With a fee, the odds you really get are the answer; the raw conversion goes underneath.
      const feeOn = cents && rate > 0;
      const effAm = feeOn ? probToAmerican(effectivePrice(p, rate).price) : am;
      hero.setLabel('Odds for a ' + tidy(fmtProb(p, cents ? 'cents' : 'pct')) + (cents ? ' price' : ' chance') + (feeOn ? ' with ' + feeName(label) + ' fee' : ''));
      hero.set(fmtOdds(effAm), fmtOdds(effAm, { ascii: true }), feeOn ? 'you pay ' + fmtProb(effectivePrice(p, rate).price, 'cents', 1) + ' with the fee \u00B7 ' + fmtOdds(am) + ' before it' : 'decimal odds ' + fmtDecimal(dec));
      let t = 'If something wins ' + tidy(fmtProb(p, 'pct')) + ' of the time, these odds are exactly break-even on it.';
      if (cents) t = 'A ' + tidy(fmtProb(p, 'cents')) + ' price means a ' + tidy(fmtProb(p, 'pct')) + ' chance: pay ' + tidy(fmtProb(p, 'cents')) + ' now, get $1 back if it wins. ' + (feeOn ? 'With the fee you really pay ' + fmtProb(effectivePrice(p, rate).price, 'cents', 1) + ', which is ' + fmtOdds(effAm) + '.' : fmtOdds(am) + ' is that same chance written as odds. ' + feeLine(p, rate, label));
      say.set(t);
    }
  }
  // The listed price whose all-in cost (price + rate*price*(1-price)) equals q: invert the fee formula.
  function listedPriceFor(q, rate) {
    if (!(rate > 0)) return q;
    const r = rate, disc = (1 + r) * (1 + r) - 4 * r * q;
    return disc < 0 ? q : ((1 + r) - Math.sqrt(disc)) / (2 * r);
  }
  function feeName(label) { return label === 'Custom' ? 'your' : label.split(' ')[0]; }
  function feeLine(p, rate, label) {
    if (!(rate > 0)) return label === 'Novig pregame' ? 'No fee on Novig before the game starts.' : (label === 'None' ? '' : 'No fee on ' + label + ' here.');
    return '';
  }

  return { id, title: 'Convert', tab: 'Convert', icon: ICON, root, render, fields: () => (state.src === 'odds' ? [oddsF, probF] : [probF, oddsF]) };
}
