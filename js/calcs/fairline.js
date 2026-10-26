// Fair odds: the line with the book's cut removed.
import { h, field, oddsValue, result, sentence, examplePill, debounce } from '../ui.js';
import { noVig } from '../math.js';
import { fmtOdds, fmtProb, fmtPctSigned } from '../format.js';
import * as store from '../store.js';

export const ICON = '<path d="M12 3v18"/><path d="M4 7h16"/><path d="M7 7l-4 7a3.5 3.5 0 0 0 7 0L7 7z"/><path d="M17 7l-4 7a3.5 3.5 0 0 0 7 0L17 7z"/><path d="M8 21h8"/>';

export function create(ctx) {
  const id = 'fairline';
  const state = store.load('calc:' + id, { a: { sign: '-', v: '110', ghost: true }, b: { sign: '-', v: '110', ghost: true } });
  const persist = debounce(() => store.save('calc:' + id, state));

  const headA = h('div', { class: 'eyebrow', text: 'Side A' });
  const headB = h('div', { class: 'eyebrow', text: 'Side B' });
  const oddsA = result({ label: 'Fair odds, side A', hero: true, cls: 'res-col' });
  const oddsB = result({ label: 'Fair odds, side B', hero: true, cls: 'res-col' });
  const cut = result({ label: 'Book’s cut', cls: 'res-pill' });
  const say = sentence();

  const fA = field({ type: 'odds', label: 'Side A', value: state.a, ctx, keypad: ctx.keypad, onChange: (v) => { state.a = v; render(); persist(); } });
  const fB = field({ type: 'odds', label: 'Side B', value: state.b, ctx, keypad: ctx.keypad, onChange: (v) => { state.b = v; render(); persist(); } });
  // A two-way line usually has a plus side: when B is started from empty and A is minus, default B to plus.
  fB.el.addEventListener('click', () => { if (fB.text() === '' && state.a.sign === '-') fB.setSign('+'); });

  const ex = examplePill();
  const answer = h('div', { class: 'answer' },
    h('div', { class: 'screen-head' }, cut.root, h('span', { class: 'spacer' }), ex.el),
    h('div', { class: 'cols' }, h('div', { class: 'col' }, headA, oddsA.root), h('div', { class: 'col' }, headB, oddsB.root)),
    say.el
  );
  const root = h('section', { class: 'screen', 'data-screen': id, hidden: true },
    answer,
    h('div', { class: 'slots' }, h('div', { class: 'row-2' }, fA.el, fB.el))
  );

  let hadValid = false;
  function render() {
    const a = oddsValue(state.a), b = oddsValue(state.b);
    ex.set(fA.isGhost() || fB.isGhost(), fA.isGhost() && fB.isGhost());
    answer.classList.toggle('is-example', fA.isGhost() && fB.isGhost());
    headA.textContent = 'Side A' + (Number.isFinite(a) ? ' · ' + fmtOdds(a) : '');
    headB.textContent = 'Side B' + (Number.isFinite(b) ? ' · ' + fmtOdds(b) : '');
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      if (hadValid) { answer.classList.add('is-stale'); cut.setLabel('From the last full line'); return; }
      oddsA.set('—', null, 'Enter odds'); oddsB.set('—', null, 'Enter odds'); cut.set('—');
      say.set('Type both sides of a line, like −110 and −110, to see the odds without the book’s cut.');
      return;
    }
    answer.classList.remove('is-stale'); hadValid = true;
    const r = noVig(a, b);
    oddsA.set(fmtOdds(r.fairOddsA), fmtOdds(r.fairOddsA, { ascii: true }), 'fair \u00B7 ' + fmtProb(r.fairA, 'pct') + ' chance');
    oddsB.set(fmtOdds(r.fairOddsB), fmtOdds(r.fairOddsB, { ascii: true }), 'fair \u00B7 ' + fmtProb(r.fairB, 'pct') + ' chance');
    if (r.hold < -1e-9) {
      cut.setLabel('No cut'); cut.set(fmtPctSigned(-r.hold, 2), fmtPctSigned(-r.hold, 2), '', 'pos');
      say.set('No cut here: the two chances add up to under 100%, so betting both sides locks in ' + fmtPctSigned(-r.hold, 2) + '. See Hedge, Both sides.');
    } else {
      cut.setLabel('Book’s cut'); cut.set(fmtProb(r.hold, 'pct', 1), fmtProb(r.hold, 'pct', 1), '', r.hold > 0.08 ? 'neg' : '');
      say.set('These are the odds with the book’s cut taken out.' + (r.hold > 0.08 ? ' The cut on this line is steep.' : ''));
    }
  }

  return { id, title: 'Fair odds', tab: 'Fair odds', icon: ICON, root, render, fields: () => [fA, fB] };
}
