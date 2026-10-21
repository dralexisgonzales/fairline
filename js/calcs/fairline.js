// No-vig / fair line. The most-used screen.
import { h, oddsField, oddsValue, result, debounce } from '../ui.js';
import { noVig } from '../math.js';
import { fmtOdds, fmtDecimal, fmtProb, fmtPctSigned } from '../format.js';
import * as store from '../store.js';

export const ICON = '<path d="M12 3v18"/><path d="M4 7h16"/><path d="M7 7l-4 7a3.5 3.5 0 0 0 7 0L7 7z"/><path d="M17 7l-4 7a3.5 3.5 0 0 0 7 0L17 7z"/><path d="M8 21h8"/>';

export function create(ctx) {
  const id = 'fairline';
  const state = store.load('calc:' + id, { a: { sign: '-', v: '110' }, b: { sign: '-', v: '110' } });
  const persist = debounce(() => store.save('calc:' + id, state));

  const headA = h('div', { class: 'eyebrow', text: 'Side A' });
  const headB = h('div', { class: 'eyebrow', text: 'Side B' });
  const oddsA = result({ label: 'Fair odds, side A', hero: true, cls: 'res-col' });
  const oddsB = result({ label: 'Fair odds, side B', hero: true, cls: 'res-col' });
  const probA = result({ label: 'Fair probability', cls: 'res-col' });
  const probB = result({ label: 'Fair probability', cls: 'res-col' });
  const hold = result({ label: 'Hold', cls: 'res-pill' });

  const fA = oddsField({ label: 'Side A', value: state.a, onChange: (v) => { state.a = v; render(); persist(); } });
  const fB = oddsField({ label: 'Side B', value: state.b, onChange: (v) => { state.b = v; render(); persist(); } });

  const root = h('section', { class: 'screen', 'data-screen': id, hidden: true },
    h('div', { class: 'card card-hero' },
      h('div', { class: 'card-head' }, h('span', { class: 'caption', text: 'Fair odds' }), hold.root),
      h('div', { class: 'cols' },
        h('div', { class: 'col' }, headA, oddsA.root, probA.root),
        h('div', { class: 'col' }, headB, oddsB.root, probB.root)
      )
    ),
    h('div', { class: 'card card-inputs' },
      h('div', { class: 'row-2' }, fA.root, fB.root)
    )
  );

  function render() {
    const mode = ctx.probMode();
    const a = oddsValue(state.a), b = oddsValue(state.b);
    headA.textContent = 'Side A' + (Number.isFinite(a) ? ' · ' + fmtOdds(a) : '');
    headB.textContent = 'Side B' + (Number.isFinite(b) ? ' · ' + fmtOdds(b) : '');
    probA.setLabel(mode === 'cents' ? 'Fair price' : 'Fair probability');
    probB.setLabel(mode === 'cents' ? 'Fair price' : 'Fair probability');
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      oddsA.set('—', null, Number.isFinite(a) ? '' : 'Enter odds');
      oddsB.set('—', null, Number.isFinite(b) ? '' : 'Enter odds');
      probA.set('—'); probB.set('—'); hold.set('—');
      hold.setLabel('Hold');
      return;
    }
    const r = noVig(a, b);
    oddsA.set(fmtOdds(r.fairOddsA), fmtOdds(r.fairOddsA, { ascii: true }), fmtDecimal(r.fairDecA) + ' decimal', 'accent');
    oddsB.set(fmtOdds(r.fairOddsB), fmtOdds(r.fairOddsB, { ascii: true }), fmtDecimal(r.fairDecB) + ' decimal', 'accent');
    probA.set(fmtProb(r.fairA, mode), fmtProb(r.fairA, mode), fmtProb(r.impliedA, mode) + ' implied');
    probB.set(fmtProb(r.fairB, mode), fmtProb(r.fairB, mode), fmtProb(r.impliedB, mode) + ' implied');
    if (r.hold < -1e-9) {
      hold.setLabel('Arb');
      hold.set(fmtPctSigned(-r.hold, 2), fmtPctSigned(-r.hold, 2), '', 'pos');
    } else {
      hold.setLabel('Hold');
      hold.set(fmtProb(r.hold, 'pct', 2), fmtProb(r.hold, 'pct', 2), '', r.hold > 0.08 ? 'neg' : '');
    }
  }

  return { id, title: 'Fair line', icon: ICON, root, render };
}
