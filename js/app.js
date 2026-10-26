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
  feeLabel: () => feePreset().short,
  openSettings: (focus) => settingsSheet.open(focus),
  settingsOpen: () => settingsSheet.isOpen(),
  afterSettingsClose: () => renderAll(),
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
const main = document.getElementById('screens');
calcs.forEach((c) => main.append(c.root));
const dock = document.getElementById('dock');
const tabs = document.getElementById('tabs');
dock.insertBefore(keypad.root, tabs);

const tabBtns = calcs.map((c) =>
  h('button', { type: 'button', class: 'tab', 'data-id': c.id, 'aria-label': c.title, onclick: () => switchTo(c.id) },
    h('span', { class: 'tab-ic' }, svg(c.icon, 22)), h('span', { class: 'tab-label', text: c.tab || c.title })
  )
);
tabs.append(...tabBtns);

// ----- Glossary -----
const GLOSSARY = [
  ['American odds', 'The −110 / +150 style. Minus: what you risk to win $100. Plus: what you win on a $100 risk.'],
  ['Chance to win (implied probability)', 'How often a bet has to win just to break even at those odds. −110 means 52.4%.'],
  ['Book’s cut (vig, hold)', 'The sportsbook’s built-in margin. Both sides of a line add up to more than 100%; the extra is the cut.'],
  ['Fair odds', 'The odds with the book’s cut removed. What the line says about the real chance.'],
  ['Parlay', 'One bet on several picks. Every pick has to win. The odds multiply, and so does the risk.'],
  ['Hedge', 'Betting the other side of a bet you already have, to lock in a result before it settles.'],
  ['Both sides (arbitrage)', 'When two books disagree enough that you can bet both sides and profit whichever wins.'],
  ['Unit (u)', 'Your standard bet size. If your unit is $25, a 2u bet is $50. Set it in Settings.'],
  ['Bankroll', 'The money you have set aside for betting. Units are usually 1% to 2% of it.'],
  ['Decimal odds', 'What $1 turns into if the bet wins, stake included. −110 is 1.91.'],
  ['Prediction market', 'Kalshi, Polymarket, Novig: you buy contracts priced in cents. A 62¢ contract means a 62% chance.'],
  ['Trading fee', 'What a prediction market charges per contract when you take a price. It makes your real price a little worse.'],
];
const glossarySheet = sheet({
  title: 'What the words mean',
  body: h('dl', { class: 'glossary' }, GLOSSARY.map(([t, d]) => [h('dt', { text: t }), h('dd', { text: d })])),
});
document.body.append(settingsSheet.root, glossarySheet.root);
document.getElementById('helpBtn').addEventListener('click', () => glossarySheet.open());
document.getElementById('settingsBtn').addEventListener('click', () => settingsSheet.open());

// Sheets sit above the keypad so their fields can use it.
function placeSheets() {
  const kp = keypad.root.getBoundingClientRect().height;
  document.documentElement.style.setProperty('--sheet-bottom', kp + 'px');
}
window.addEventListener('resize', placeSheets);

let active = null;
function switchTo(id) {
  if (active === id) return;
  active = id;
  calcs.forEach((c) => { c.root.hidden = c.id !== id; });
  tabBtns.forEach((b) => { const on = b.dataset.id === id; b.classList.toggle('is-active', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  store.save('tab', id);
  const c = calcs.find((x) => x.id === id);
  c.render();
  keypad.setFields(c.fields(), true);
}
function renderAll() { calcs.forEach((c) => c.render()); const c = calcs.find((x) => x.id === active); if (c) keypad.setFields(c.fields(), false); }

// ----- Theme -----
const media = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const t = settings.theme === 'light' ? 'light' : settings.theme === 'auto' ? (media.matches ? 'dark' : 'light') : 'dark';
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#0b0c0f' : '#f4f2ec');
}
media.addEventListener?.('change', () => { if (settings.theme === 'auto') applyTheme(); });

// ----- Boot -----
applyTheme();
calcs.forEach((c) => c.render());
const lastTab = store.load('tab', null);
switchTo(calcs.some((c) => c.id === lastTab) ? lastTab : 'fairline');
placeSheets();
if (!store.load('hinted2', false)) {
  setTimeout(() => { toast('Tap any result to copy it', 2600); store.save('hinted2', true); }, 1200);
}
// A tap on empty space just keeps the current field; nothing to dismiss.
window.addEventListener('scroll', () => window.scrollTo(0, 0));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // When a new version activates, reload once so the whole shell swaps together.
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (navigator.serviceWorker.controller) location.reload(); });
      reg.update?.();
    }).catch(() => {});
  });
}
