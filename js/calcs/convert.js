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
  const modeSeg = segmented({ options: [{ id: 'pct', label: 'Percent' }, { id: 'cents', label: 'Cents' }], value: ctx.probMode(), cls: 'seg-mini', label: 'Show chance as percent or cents', onChange: (m) => { ctx.setProbMode(m); ctx.keypad.focus(probF, false); } });

  const oddsF = field({ type: 'odds', label: 'Odds', value: state.odds, ctx, keypad: ctx.keypad, onChange: (v) => { state.odds = v; if (state.src !== 'odds') { state.src = 'odds'; ctx.keypad.setFields([oddsF, probF]); } render(); persist(); } });
  const probF = field({ type: 'percent', label: 'Chance to win', value: state.prob, suffix: '%', placeholder: '\u2014', maxLen: 6, ctx, keypad: ctx.keypad, onChange: (v) => { state.prob = v; if (state.src !== 'prob') { state.src = 'prob'; ctx.keypad.setFields([probF, oddsF]); } render(); persist(); } });
  oddsF.noAdvance = true; probF.noAdvance = true;
  // Tapping the calculated box does not change anything until the first key: the old answer stays until there is a new one.

  const ex = examplePill();
  const answer = h('div', { class: 'answer' },
    h('div', { class: 'screen-head' }, modeSeg.root, h('span', { class: 'spacer' }), ex.el),
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
    probF.setSuffix(cents ? '¢' : '%');
    probF.setLabel(cents ? 'Price in cents' : 'Chance to win');
    let p = NaN, am = NaN;
    if (state.src === 'odds') {
      am = oddsValue(state.odds);
      p = toImplied(am);
      probF.set({ v: Number.isFinite(p) ? (p * 100).toFixed(p < 0.01 || p > 0.995 ? 2 : 1) : '', ghost: false });
      probF.el.classList.add('is-computed'); oddsF.el.classList.remove('is-computed');
      probF.setSub(Number.isFinite(p) ? (ctx.keypad.active() === probF ? 'type to change it' : 'calculated') : '');
    } else {
      const pv = parseNum(state.prob.v);
      p = pv > 0 && pv < 100 ? pv / 100 : NaN;
      am = probToAmerican(p);
      const txt = Number.isFinite(am) ? fmtOdds(am, { ascii: true }) : '';
      oddsF.set(txt ? { sign: txt.startsWith('-') ? '-' : '+', v: txt.slice(1), ghost: false } : { sign: '-', v: '', ghost: false });
      oddsF.el.classList.add('is-computed'); probF.el.classList.remove('is-computed');
      oddsF.setSub(Number.isFinite(am) ? (ctx.keypad.active() === oddsF ? 'type to change it' : 'calculated') : '');
      const bad = Number.isFinite(pv) && pv >= 100;
      probF.setSub(Number.isFinite(pv) && !(pv > 0 && pv < 100) ? 'Use a number above 0 and below 100' : '', bad ? 'is-error' : '');
    }
    if (state.src === 'odds') oddsF.setSub(''); else if (!Number.isFinite(parseNum(state.prob.v)) || (parseNum(state.prob.v) > 0 && parseNum(state.prob.v) < 100)) probF.setSub('');

    if (!Number.isFinite(p)) {
      if (hadValid) {
        answer.classList.add('is-stale'); hero.setLabel('Waiting for a number');
        if (state.src === 'odds') probF.set({ v: '', ghost: false }); else oddsF.set({ sign: state.odds.sign || '-', v: '', ghost: false });
        return;
      }
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
      hero.setLabel((cents ? 'Price for ' : 'Chance to win at ') + fmtOdds(am));
      hero.set(fmtProb(p, cents ? 'cents' : 'pct'), fmtProb(p, cents ? 'cents' : 'pct'), cents && rate > 0 ? 'after fee ' + fmtProb(effectivePrice(p, rate).price, 'cents', 2) : (cents ? '' : 'decimal odds ' + fmtDecimal(dec)));
      let t = 'A ' + fmtOdds(am) + ' bet has to win that often just to break even.';
      if (cents) t = 'On a betting exchange, ' + fmtOdds(am) + ' is a ' + tidy(fmtProb(p, 'cents')) + ' price: pay that now, get $1 back if it wins. ' + feeLine(p, rate, label);
      say.set(t);
    } else {
      hero.setLabel('Odds for a ' + tidy(fmtProb(p, cents ? 'cents' : 'pct')) + (cents ? ' price' : ' chance'));
      hero.set(fmtOdds(am), fmtOdds(am, { ascii: true }), cents && rate > 0 ? 'after fee ' + fmtProb(effectivePrice(p, rate).price, 'cents', 2) + ', like ' + fmtOdds(probToAmerican(effectivePrice(p, rate).price)) : 'decimal odds ' + fmtDecimal(dec));
      let t = 'If something wins ' + tidy(fmtProb(p, 'pct')) + ' of the time, these odds are exactly break-even on it.';
      if (cents) t = 'A ' + tidy(fmtProb(p, 'cents')) + ' price means a ' + tidy(fmtProb(p, 'pct')) + ' chance: pay ' + tidy(fmtProb(p, 'cents')) + ' now, get $1 back if it wins. Same thing as these odds. ' + feeLine(p, rate, label);
      say.set(t);
    }
  }
  function feeLine(p, rate, label) {
    if (!(rate > 0)) return label === 'Novig pregame' ? 'Your fee setting is Novig: no fee before the game starts.' : (label === 'None' ? '' : 'Your fee setting is ' + label + ': no fee here.');
    const eff = effectivePrice(p, rate);
    return (label === 'Custom' ? 'Your custom fee adds ' : 'Your fee setting is ' + label + ': the fee adds ') + fmtCentsExact(eff.fee) + ', so you really pay ' + fmtProb(eff.price, 'cents', 2) + ' (like ' + fmtOdds(probToAmerican(eff.price)) + ' odds).';
  }

  return { id, title: 'Convert', tab: 'Convert', icon: ICON, root, render, fields: () => (state.src === 'odds' ? [oddsF, probF] : [probF, oddsF]) };
}
