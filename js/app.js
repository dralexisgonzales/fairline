// Fairline v2 bootstrap: keypad-driven shell, tabs, sheets, theme, service worker.
import * as store from './store.js';
import { FEE_PRESETS } from './math.js';
import { h, svg, toast, sheet } from './ui.js';
import { createKeypad } from './keypad.js';
import { createSettings } from './settings.js';
import * as convert from './calcs/convert.js';
import * as fairline from './calcs/fairline.js';
import * as parlay from './calcs/parlay.js';
import * as hedge from './calcs/hedge.js';
import * as payout from './calcs/payout.js';

const settings = store.loadSettings();

// ----- Haptics: iOS plays a tick when a native switch toggles; Android vibrates -----
const hapticEl = document.getElementById('haptic');
function haptic() {
  try { if (hapticEl) hapticEl.click(); } catch {}
  try { navigator.vibrate?.(5); } catch {}
}

const keypad = createKeypad({ haptic });
const app = document.getElementById('app');
const main = document.getElementById('screens');
const dock = document.getElementById('dock');
const tabs = document.getElementById('tabs');

function feePreset() { return FEE_PRESETS.find((p) => p.id === settings.feePreset) || FEE_PRESETS[0]; }
function feeRate() {
  const p = feePreset();
  if (p.id === 'custom') return Number(settings.feeCustom) > 0 ? Number(settings.feeCustom) : 0;
  return p.rate;
}

const ctx = {
  settings, keypad,
  unitSize: () => (Number(settings.unit) > 0 ? Number(settings.unit) : 0),
  leadUnits: () => !!settings.leadUnits && Number(settings.unit) > 0,
  probMode: () => (settings.probMode === 'cents' ? 'cents' : 'pct'),
  setProbMode: (m) => ctx.update({ probMode: m }),
  feeRate,
  feePreset,
  openSettings: (focus) => settingsSheet.open(focus),
  settingsOpen: () => settingsSheet.isOpen(),
  afterSettingsClose: () => { dock.insertBefore(keypad.root, tabs); keypad.close(); renderAll(); },
  takeKeypad: (panel) => { panel.append(keypad.root); },
  update(patch) {
    Object.assign(settings, patch);
    store.saveSettings(settings);
    applyTheme();
    renderAll();
    settingsSheet.render();
  },
};

const calcs = [convert, fairline, parlay, hedge, payout].map((m) => m.create(ctx));
const settingsSheet = createSettings(ctx);

// ----- Layout -----
calcs.forEach((c) => main.append(c.root));
dock.insertBefore(keypad.root, tabs);
function placeDock() {
  document.documentElement.style.setProperty('--dock-h', dock.getBoundingClientRect().height + 'px');
  // Tight: the room left for the answer and slots is small (notched phones, short browsers).
  // Measured without the header fold so it cannot flap: app height minus dock minus a full header.
  // Room between a full header (with the phone's top inset) and the dock. Independent of the tight state itself.
  const sat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
  const avail = app.clientHeight - dock.offsetHeight - 52 - sat;
  app.classList.toggle('tight', avail < 400);
  const c = calcs.find((x) => x.id === active);
  const screen = c ? c.root : null;
  if (screen) screen.classList.toggle('fits', screen.scrollHeight <= screen.clientHeight + 1);
}
keypad.onOpenChange((open) => {
  app.classList.toggle('kb-open', open);
  if (!open) { const c = calcs.find((x) => x.id === active); if (c) c.root.scrollTop = 0; }
  setTimeout(() => { placeDock(); keypad.active()?.reveal?.(); }, 0);
});
window.addEventListener('resize', placeDock);


const tabBtns = calcs.map((c) =>
  h('button', { type: 'button', class: 'tab', 'data-id': c.id, 'aria-label': c.title, onclick: () => switchTo(c.id) },
    h('span', { class: 'tab-ic' }, svg(c.icon, 22)), h('span', { class: 'tab-label', text: c.tab || c.title })
  )
);
tabs.append(...tabBtns);

// ----- Glossary -----
const GLOSSARY = [
  ['American odds', 'The −110 / +150 style. Minus: what you risk to win $100. Plus: what you win on a $100 risk.'],
  ['Chance to win', 'How often a bet has to win just to break even at those odds. −110 means 52.4%. Also called implied probability.'],
  ['Book’s cut', 'The sportsbook’s built-in margin, also called vig or hold. The two sides of a line add up to more than 100%; the extra is the cut.'],
  ['Fair odds', 'The odds with the book’s cut removed: what the line says about the real chance.'],
  ['Stake', 'The money you put on a bet.'],
  ['Parlay and legs', 'One bet on several picks; each pick is a leg. Every leg has to win. The odds multiply, and so does the risk.'],
  ['Hedge', 'Betting the other side of a bet you already have, to lock in a result before it settles.'],
  ['Locked profit', 'What you end up with whichever side wins, once you have hedged.'],
  ['Break-even bet', 'The hedge size that gets your stake back if your first bet loses, so the worst case is $0.'],
  ['Both sides (arbitrage)', 'When two books disagree enough that you can bet both sides and profit whichever wins.'],
  ['Unit (u)', 'Your standard bet size. If your unit is $25, a 2u bet is $50. Set it in Settings.'],
  ['Bankroll', 'The money you have set aside for betting. A unit is usually 1% to 2% of it.'],
  ['Decimal odds', 'What $1 turns into if the bet wins, stake included. −110 is 1.91.'],
  ['Prediction market and contracts', 'Kalshi, Polymarket, Novig: you buy contracts priced in cents that pay $1 if they win. A 62¢ contract means a 62% chance.'],
  ['Trading fee', 'What a prediction market charges when you take a price. Pregame means before the game starts; Novig charges nothing then.'],
];
const glossarySheet = sheet({ title: 'What the words mean', body: h('dl', { class: 'glossary' }, GLOSSARY.map(([t, d]) => [h('dt', { text: t }), h('dd', { text: d })])), onOpen: () => keypad.close() });
document.body.append(settingsSheet.root, glossarySheet.root);
document.getElementById('helpBtn').addEventListener('click', () => glossarySheet.open());
document.getElementById('settingsBtn').addEventListener('click', () => settingsSheet.open());

let active = null;
function switchTo(id) {
  settingsSheet.close(); glossarySheet.close();
  if (active === id) return;
  active = id;
  calcs.forEach((c) => { c.root.hidden = c.id !== id; });
  tabBtns.forEach((b) => { const on = b.dataset.id === id; b.classList.toggle('is-active', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  store.save('tab', id);
  const c = calcs.find((x) => x.id === id);
  c.render();
  keypad.setFields(c.fields());
  c.root.scrollTop = 0;
  const first = c.fields()[0];
  if (first) keypad.focus(first, true);
  placeDock();
}
function renderAll() { calcs.forEach((c) => c.render()); const c = calcs.find((x) => x.id === active); if (c && !settingsSheet.isOpen()) keypad.setFields(c.fields()); placeDock(); }
keypad.onActive(() => setTimeout(placeDock, 0));

// ----- Theme -----
const media = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const t = settings.theme === 'light' ? 'light' : settings.theme === 'auto' ? (media.matches ? 'dark' : 'light') : 'dark';
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#0b0c0f' : '#f4f2ec');
}
media.addEventListener?.('change', () => { if (settings.theme === 'auto') applyTheme(); });

// If the answer block changes height while a slot is focused, keep that slot in view.
if ('ResizeObserver' in window) {
  const ro = new ResizeObserver(() => keypad.active()?.reveal?.());
  document.querySelectorAll('.answer').forEach((el) => ro.observe(el));
}

// ----- Boot -----
applyTheme();
calcs.forEach((c) => c.render());
const lastTab = store.load('tab', null);
switchTo(calcs.some((c) => c.id === lastTab) ? lastTab : 'fairline');
placeDock();
if (!store.load('hinted2', false)) {
  setTimeout(() => { toast('Tap a result to copy', 2600); store.save('hinted2', true); }, 1200);
}
window.addEventListener('scroll', () => window.scrollTo(0, 0));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      let had = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) location.reload(); had = true; });
      reg.update?.();
    }).catch(() => {});
  });
}
