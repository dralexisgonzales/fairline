// Tiny persistence layer over localStorage. Everything stays on the device.
const PREFIX = 'fairline:';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable: ignore, the app still works */
  }
}

export function clearInputs() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX + 'calc:'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
}

export const DEFAULT_SETTINGS = {
  bankroll: null,       // dollars
  unit: null,           // dollars
  feePreset: 'novig',   // id from FEE_PRESETS
  feeCustom: 0.05,      // rate used when feePreset === 'custom'
  theme: 'dark',        // 'dark' | 'light' | 'auto'
  probMode: 'pct',      // 'pct' | 'cents' (Convert only)
  leadUnits: false,     // show money as units first
};

export function loadSettings() {
  const s = { ...DEFAULT_SETTINGS, ...load('settings', {}) };
  // v2: Novig (no pregame fee) becomes the default once, for phones that saved v1's default.
  if (!s.v2) { if (s.feePreset === 'kalshi') s.feePreset = 'novig'; s.v2 = true; save('settings', s); }
  return s;
}

export function saveSettings(s) {
  save('settings', s);
}
