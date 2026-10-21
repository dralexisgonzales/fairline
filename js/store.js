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
  feePreset: 'kalshi',  // id from FEE_PRESETS
  feeCustom: 0.05,      // rate used when feePreset === 'custom'
  theme: 'dark',        // 'dark' | 'light' | 'auto'
  probMode: 'pct',      // 'pct' | 'cents'
};

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...load('settings', {}) };
}

export function saveSettings(s) {
  save('settings', s);
}
