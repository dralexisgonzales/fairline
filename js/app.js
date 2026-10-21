// Fairline app bootstrap: settings context, screens, tabs, theme, service worker.
import * as store from './store.js';
import { FEE_PRESETS } from './math.js';
import { h, svg, toast } from './ui.js';
import { createSettings } from './settings.js';
import * as convert from './calcs/convert.js';
import * as fairline from './calcs/fairline.js';
import * as parlay from './calcs/parlay.js';
import * as hedge from './calcs/hedge.js';
import * as payout from './calcs/payout.js';

const settings = store.loadSettings();

function feePreset() {
  return FEE_PRESETS.find((p) => p.id === settings.feePreset) || FEE_PRESETS[0];
}
function feeRate() {
  const p = feePreset();
  if (p.id === 'custom') return Number(settings.feeCustom) > 0 ? Number(settings.feeCustom) : 0;
  return p.rate;
}
function feeLabel() {
  const p = feePreset();
  if (p.id === 'kalshi') return 'Kalshi';
  if (p.id.startsWith('poly')) return 'Polymarket';
  if (p.id === 'custom') return 'custom';
  return '';
}

const ctx = {
  settings,
  unitSize: () => (Number(settings.unit) > 0 ? Number(settings.unit) : 0),
  probMode: () => (settings.probMode === 'cents' ? 'cents' : 'pct'),
  setProbMode: (m) => ctx.update({ probMode: m }),
  feeRate,
  feeLabel,
  openSettings: (focus) => sheet.open(focus),
  settingsOpen: () => sheet.isOpen(),
  afterSettingsClose: () => renderAll(),
  update(patch) {
    Object.assign(settings, patch);
    store.saveSettings(settings);
    applyTheme();
    renderAll();
    sheet.render();
  },
};

const calcs = [convert, fairline, parlay, hedge, payout].map((m) => m.create(ctx));
const sheet = createSettings(ctx);

// ----- Layout -----
const main = document.getElementById('screens');
calcs.forEach((c) => main.append(c.root));
document.body.append(sheet.root);

const tabs = document.getElementById('tabs');
const tabBtns = calcs.map((c) =>
  h('button', { type: 'button', class: 'tab', 'data-id': c.id, 'aria-label': c.title, onclick: () => switchTo(c.id) },
    svg(c.icon, 22), h('span', { class: 'tab-label', text: c.title })
  )
);
tabs.append(...tabBtns);
document.getElementById('settingsBtn').addEventListener('click', () => sheet.open());

let active = null;
function switchTo(id) {
  if (active === id) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  active = id;
  calcs.forEach((c) => { c.root.hidden = c.id !== id; });
  tabBtns.forEach((b) => {
    const on = b.dataset.id === id;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  store.save('tab', id);
  window.scrollTo(0, 0);
  heroOffscreen = false;
  lastHero = null;
  updateMini();
}

function renderAll() { calcs.forEach((c) => c.render()); updateMini(); }

// ----- Compact answer strip: keeps the answer visible once the answer card scrolls away -----
const miniLabel = h('span', { class: 'mini-label' });
const miniValue = h('span', { class: 'mini-value' });
const miniLabel2 = h('span', { class: 'mini-label' });
const miniValue2 = h('span', { class: 'mini-value' });
const miniSecond = h('span', { class: 'mini-second', hidden: true }, miniLabel2, miniValue2);
const miniBtn = h('button', { type: 'button', class: 'mini-btn', 'aria-label': 'Scroll back to the answer', onclick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) }, miniLabel, miniValue, miniSecond);
const mini = h('div', { class: 'mini', 'aria-hidden': 'true' }, miniBtn);
document.body.append(mini);
let heroOffscreen = false;
let lastHero = null;
const heroValue = (el) => el.querySelector('.res-value') || el;
// Bottom edge of the sticky header, including the phone's safe area (notch).
const topEdge = () => Math.max(1, Math.round(document.querySelector('.top').getBoundingClientRect().bottom));
// The strip appears once the big number itself is fully hidden, so it never covers the value it repeats.
const heroGone = (el) => { const r = heroValue(el).getBoundingClientRect(); return r.bottom < topEdge() || r.top > window.innerHeight; };
const shortLabel = (el) => el?.dataset.mini ?? (el?.querySelector('.res-label')?.textContent || '');
function activeHero() {
  const c = calcs.find((x) => x.id === active);
  if (!c) return null;
  // The first hero that is actually shown (Hedge keeps one per mode).
  return [...c.root.querySelectorAll('.card-hero .res-hero')].find((el) => el.offsetParent !== null) || null;
}
function updateMini() {
  const hero = activeHero();
  if (!hero) { lastHero = null; mini.classList.remove('is-on'); mini.setAttribute('aria-hidden', 'true'); miniBtn.tabIndex = -1; return; }
  // When the visible hero changes (tab or mode switch), read its position directly instead of waiting for an observer event.
  if (hero !== lastHero) { lastHero = hero; heroOffscreen = heroGone(hero); }
  const card = hero.closest('.card-hero');
  miniLabel.textContent = shortLabel(hero);
  miniValue.textContent = hero.querySelector('.res-value')?.textContent || '';
  // Second chip: the main money tile of the answer card (payout, locked profit, stake split),
  // or the other side on Fair line.
  const tiles = [...(card?.querySelectorAll('.res-row .res:not(.is-empty), .res-line:not(.is-empty)') || [])].filter((t) => !t.hidden && !t.closest('[hidden]'));
  // A tile that provides its own strip text wins; otherwise the first dollar tile.
  miniBtn.classList.remove('is-pair');
  miniLabel2.hidden = false;
  const custom = tiles.find((t) => t.dataset.miniText);
  const money = custom || tiles.find((t) => /\$/.test(t.querySelector('.res-value')?.textContent || ''));
  const eyebrows = card ? [...card.querySelectorAll('.eyebrow')] : [];
  const heroes = card ? [...card.querySelectorAll('.res-hero')] : [];
  if (money) {
    miniLabel2.textContent = custom ? '' : shortLabel(money);
    miniLabel2.hidden = !miniLabel2.textContent;
    miniValue2.textContent = custom ? custom.dataset.miniText : (money.querySelector('.res-value')?.textContent || '');
    miniSecond.hidden = false;
    // Odds and percentages read on their own; a dollar headline keeps its (short) label,
    // unless the tile supplies its own longer text (the arbitrage split), where room is tight.
    miniLabel.hidden = !!custom || !/\$/.test(miniValue.textContent) || !miniLabel.textContent;
  } else if (eyebrows.length === 2 && heroes.length === 2) {
    miniBtn.classList.add('is-pair');
    // Bare side letters: the inputs already show the odds, and this always fits.
    miniLabel.textContent = eyebrows[0].textContent.split(' \u00B7 ')[0].replace(/^Side /, '');
    miniLabel2.textContent = eyebrows[1].textContent.split(' \u00B7 ')[0].replace(/^Side /, '');
    miniValue2.textContent = heroes[1].querySelector('.res-value')?.textContent || '';
    miniSecond.hidden = miniValue2.textContent === '—';
    miniLabel.hidden = false;
  } else {
    miniSecond.hidden = true;
    miniLabel.hidden = false;
  }
  const on = heroOffscreen && miniValue.textContent !== '—';
  mini.classList.toggle('is-on', on);
  mini.setAttribute('aria-hidden', String(!on));
  miniBtn.tabIndex = on ? 0 : -1;
  // Very long figures shrink; a label shows whole or not at all (checked after layout).
  [miniValue, miniValue2].forEach((el) => el.classList.toggle('is-long', el.textContent.length >= 14));
  if (on) requestAnimationFrame(() => {
    [miniLabel, miniLabel2].forEach((el) => { if (!el.hidden && el.scrollWidth > el.clientWidth + 1) el.hidden = true; });
  });
}
let heroWatch = null;
function watchHeroes() {
  heroWatch?.disconnect();
  heroWatch = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      const hero = en.target.closest('.res-hero');
      if (hero === activeHero()) { heroOffscreen = !en.isIntersecting; updateMini(); }
    });
  }, { rootMargin: '-' + topEdge() + 'px 0px 0px 0px', threshold: 0 });
  calcs.forEach((c) => c.root.querySelectorAll('.card-hero .res-hero').forEach((el) => heroWatch.observe(heroValue(el))));
}
watchHeroes();
window.addEventListener('resize', () => { watchHeroes(); lastHero = null; updateMini(); });
new MutationObserver(() => updateMini()).observe(main, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

// ----- Theme -----
const media = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const t = settings.theme === 'light' ? 'light' : settings.theme === 'auto' ? (media.matches ? 'dark' : 'light') : 'dark';
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#0a0c11' : '#f3f4f7');
}
media.addEventListener?.('change', () => { if (settings.theme === 'auto') applyTheme(); });

// ----- Boot -----
applyTheme();
renderAll();
const lastTab = store.load('tab', null);
switchTo(calcs.some((c) => c.id === lastTab) ? lastTab : 'fairline');

if (!store.load('hinted', false)) {
  setTimeout(() => { toast('Tap any result to copy it', 2600); store.save('hinted', true); }, 900);
}

// iOS number pads have no Done key: a tap anywhere outside a field puts the keyboard away.
document.addEventListener('pointerdown', (e) => {
  const a = document.activeElement;
  if (!a || a.tagName !== 'INPUT') return;
  if (e.target.closest('input, .field-box, .sheet-panel')) return;
  a.blur();
}, { capture: true });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
