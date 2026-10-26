// Odds <-> chance.
import { h, field, oddsValue, segmented, result, sentence, examplePill, parseNum, debounce } from '../ui.js';
import { toImplied, probToAmerican, probToDecimal, effectivePrice } from '../math.js';
import { fmtOdds, fmtDecimal, fmtProb, fmtCentsExact } from '../format.js';
import * as store from '../store.js';

export const ICON = '<path d="M7 4v16"/><path d="M3 8l4-4 4 4"/><path d="M17 20V4"/><path d="M13 16l4 4 4-4"/>';
const trim = (n, d) => Number.isFinite(n) ? String(Number(n.toFixed(d))) : '';

export function create(ctx) {
  const id = 'convert';
  const state = store.load('calc:' + id, { src: 'odds', odds: { sign: '-', v: '110', ghost: true }, prob: { v: '', ghost: false } });
  if (typeof state.prob === 'string') state.prob = { v: state.prob, ghost: false };
  const persist = debounce(() => store.save('calc:' + id, state));

  const hero = result({ label: 'Chance to win', hero: true });
  const say = sentence();
  const modeSeg = segmented({ options: [{ id: 'pct', label: '%' }, { id: 'cents', label: '¢' }], value: ctx.probMode(), cls: 'seg-mini', label: 'Show chance as percent or cents', onChange: (m) => ctx.setProbMode(m) });

  const oddsF = field({ type: 'odds', label: 'American odds', value: state.odds, ctx, keypad: ctx.keypad, onChange: (v) => { state.odds = v; state.src = 'odds'; render(); persist(); } });
  const probF = field({ type: 'percent', label: 'Chance to win', value: state.prob, suffix: '%', placeholder: '52.4', maxLen: 6, ctx, keypad: ctx.keypad, onChange: (v) => { state.prob = v; state.src = 'prob'; render(); persist(); } });
  oddsF.el.addEventListener('click', () => { if (state.src !== 'odds') { state.src = 'odds'; render(); persist(); } });
  probF.el.addEventListener('click', () => { if (state.src !== 'prob') { state.src = 'prob'; render(); persist(); } });

  const ex = examplePill();
  const answer = h('div', { class: 'answer' },
    h('div', { class: 'screen-head' }, modeSeg.root, h('span', { class: 'spacer' }), ex.el),
    hero.root, say.el
  );
  const root = h('section', { class: 'screen', 'data-screen': id, hidden: true },
    answer,
    h('div', { class: 'slots' }, h('div', { class: 'row-2' }, oddsF.el, probF.el))
  );

  let hadValid = false;
  function render() {
    const cents = ctx.probMode() === 'cents';
    ex.set(oddsF.isGhost() || probF.isGhost());
    answer.classList.toggle('is-example', oddsF.isGhost() && state.src === 'odds');
    modeSeg.set(ctx.probMode());
    probF.setSuffix(cents ? '¢' : '%');
    probF.setLabel(cents ? 'Price in cents' : 'Chance to win');
    let p = NaN, am = NaN;
    if (state.src === 'odds') {
      am = oddsValue(state.odds);
      p = toImplied(am);
      probF.set({ v: trim(p * 100, p < 0.01 || p > 0.995 ? 2 : 1), ghost: false });
      probF.el.classList.add('is-computed'); oddsF.el.classList.remove('is-computed');
    } else {
      const pv = parseNum(state.prob.v);
      p = pv > 0 && pv < 100 ? pv / 100 : NaN;
      am = probToAmerican(p);
      const txt = Number.isFinite(am) ? fmtOdds(am, { ascii: true }) : '';
      oddsF.set(txt ? { sign: txt.startsWith('-') ? '-' : '+', v: txt.slice(1), ghost: false } : { sign: '-', v: '', ghost: false });
      oddsF.el.classList.add('is-computed'); probF.el.classList.remove('is-computed');
      const bad = Number.isFinite(pv) && pv >= 100;
      probF.setSub(Number.isFinite(pv) && !(pv > 0 && pv < 100) ? 'Use a number above 0 and below 100' : '', bad ? 'is-error' : '');
    }
    if (state.src === 'odds') probF.setSub('');

    if (!Number.isFinite(p)) {
      if (hadValid) { answer.classList.add('is-stale'); return; }
      hero.setLabel(state.src === 'odds' ? (cents ? 'Price' : 'Chance to win') : 'American odds');
      hero.set('—', null, '');
      say.set(state.src === 'odds' ? 'Type odds like \u2212110 or +150.' : (cents ? 'Type a price in cents, like 62.' : 'Type a chance like 52.4.'));
      return;
    }
    answer.classList.remove('is-stale'); hadValid = true;
    const dec = probToDecimal(p);
    const rate = ctx.feeRate();
    const label = ctx.feePreset().label;
    if (state.src === 'odds') {
      hero.setLabel(cents ? 'Price this implies' : 'Chance to win this implies');
      hero.set(fmtProb(p, cents ? 'cents' : 'pct'), fmtProb(p, cents ? 'cents' : 'pct'), '');
      let t = 'A ' + fmtOdds(am) + ' bet has to win that often just to break even. Decimal odds ' + fmtDecimal(dec) + '.';
      if (cents) t = fmtOdds(am) + ' is the same as a ' + fmtProb(p, 'cents') + ' contract. ' + feeLine(p, rate, label);
      say.set(t);
    } else {
      hero.setLabel('Odds for a ' + fmtProb(p, cents ? 'cents' : 'pct') + (cents ? ' price' : ' chance'));
      hero.set(fmtOdds(am), fmtOdds(am, { ascii: true }), '');
      let t = 'A bet that wins ' + fmtProb(p, 'pct') + ' of the time is fairly priced at these odds (' + fmtDecimal(dec) + ' decimal).';
      if (cents) t = 'A ' + fmtProb(p, 'cents') + ' contract pays $1 if it wins, like a bet at these odds. ' + feeLine(p, rate, label);
      say.set(t);
    }
  }
  function feeLine(p, rate, label) {
    if (!(rate > 0)) return label + ' charges no fee on this, so the price you see is what you pay.';
    const eff = effectivePrice(p, rate);
    return label + ' adds a ' + fmtCentsExact(eff.fee) + ' fee, so you really pay ' + fmtProb(eff.price, 'cents', 2) + ' (like ' + fmtOdds(probToAmerican(eff.price)) + ').';
  }

  return { id, title: 'Convert', tab: 'Convert', icon: ICON, root, render, fields: () => (state.src === 'odds' ? [oddsF, probF] : [probF, oddsF]) };
}
