// Odds <-> probability converter.
import { h, oddsField, oddsValue, numberField, segmented, result, parseNum, debounce, svg } from '../ui.js';
import { toImplied, probToAmerican, probToDecimal, effectivePrice } from '../math.js';
import { fmtOdds, fmtDecimal, fmtProb, fmtCentsExact } from '../format.js';
import * as store from '../store.js';

export const ICON = '<path d="M7 4v16"/><path d="M3 8l4-4 4 4"/><path d="M17 20V4"/><path d="M13 16l4 4 4-4"/>';

const trim = (n, d) => Number.isFinite(n) ? String(Number(n.toFixed(d))) : '';

export function create(ctx) {
  const id = 'convert';
  const state = store.load('calc:' + id, { src: 'odds', odds: { sign: '-', v: '110' }, prob: '' });
  const persist = debounce(() => store.save('calc:' + id, state));

  const hero = result({ label: 'Implied probability', hero: true });
  const decRes = result({ label: 'Decimal odds' });
  const feeRes = result({ label: 'After fees' });
  const resRow = h('div', { class: 'res-row' }, decRes.root, feeRes.root);
  const modeSeg = segmented({
    options: [{ id: 'pct', label: '%' }, { id: 'cents', label: '¢' }],
    value: ctx.probMode(), cls: 'seg-mini', label: 'Show probabilities as percent or cents',
    onChange: (m) => ctx.setProbMode(m),
  });

  const oddsF = oddsField({
    label: 'American odds', value: state.odds,
    onChange: (v) => { state.odds = v; state.src = 'odds'; render(); persist(); },
  });
  const probF = numberField({
    label: 'Probability', value: state.prob, placeholder: '52.4', suffix: '%', maxLen: 6,
    onChange: (v) => { state.prob = v; state.src = 'prob'; render(); persist(); },
  });

  const root = h('section', { class: 'screen', 'data-screen': id, hidden: true },
    h('div', { class: 'card card-hero' },
      h('div', { class: 'card-head' }, h('span', { class: 'caption', text: 'Odds \u21C4 probability' }), modeSeg.root),
      hero.root,
      resRow
    ),
    h('div', { class: 'card card-inputs' },
      oddsF.root,
      h('div', { class: 'swap', 'aria-hidden': 'true' }, svg('<path d="M7 4v16"/><path d="M3 8l4-4 4 4"/><path d="M17 20V4"/><path d="M13 16l4 4 4-4"/>', 18)),
      probF.root
    )
  );

  function render() {
    const mode = ctx.probMode();
    const cents = mode === 'cents';
    modeSeg.set(mode);
    probF.setSuffix(cents ? '¢' : '%');
    let p = NaN, am = NaN;
    if (state.src === 'odds') {
      am = oddsValue(state.odds);
      p = toImplied(am);
      probF.set(trim(p * 100, p < 0.01 ? 2 : 1));
      probF.setComputed(Number.isFinite(p));
      probF.setPlaceholder(Number.isFinite(p) ? '' : '\u2014');
      oddsF.setComputed(false);
      oddsF.setPlaceholder('110');
      hero.setLabel(cents ? 'Implied price' : 'Implied probability');
      hero.set(fmtProb(p, mode), fmtProb(p, mode), Number.isFinite(am) ? fmtOdds(am) + ' American' : 'Enter odds or a probability');
    } else {
      const pv = parseNum(state.prob);
      p = pv > 0 && pv < 100 ? pv / 100 : NaN;
      am = probToAmerican(p);
      if (Number.isFinite(am)) {
        const txt = fmtOdds(am, { ascii: true });            // maps -100 to +100 like the hero
        oddsF.set({ sign: txt.startsWith('-') ? '-' : '+', v: txt.slice(1) });
      } else {
        oddsF.set({ sign: '-', v: '' });
      }
      oddsF.setComputed(Number.isFinite(am));
      oddsF.setPlaceholder(Number.isFinite(am) ? '' : '\u2014');
      probF.setComputed(false);
      probF.setPlaceholder('52.4');
      hero.setLabel('American odds');
      hero.set(fmtOdds(am), fmtOdds(am, { ascii: true }), Number.isFinite(p) ? fmtProb(p, mode) + (cents ? ' price' : ' probability') : 'Enter odds or a probability');
    }

    const dec = Number.isFinite(p) ? probToDecimal(p) : NaN;
    decRes.set(fmtDecimal(dec));

    // The after-fee readout belongs to prediction-market prices, so it shows in cents mode.
    const rate = ctx.feeRate();
    const showFee = cents && rate > 0;
    feeRes.hide(!showFee);
    resRow.classList.toggle('res-row-1', !showFee);
    if (showFee) {
      feeRes.setLabel('After ' + ctx.feeLabel() + ' fee');
      if (Number.isFinite(p)) {
        const eff = effectivePrice(p, rate);
        feeRes.set(fmtProb(eff.price, mode, 2), fmtProb(eff.price, mode, 2), fmtOdds(probToAmerican(eff.price)) + ' · fee ' + fmtCentsExact(eff.fee));
      } else {
        feeRes.set('—');
      }
    }
  }

  return { id, title: 'Convert', icon: ICON, root, render };
}
