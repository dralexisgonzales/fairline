// Display formatting. Display strings use a typographic minus (U+2212);
// copy strings use ASCII so they paste cleanly into books and spreadsheets.
const MINUS = '−';

const num = (x, d) =>
  Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export function fmtOdds(am, { ascii = false } = {}) {
  if (!Number.isFinite(am)) return '—';
  let r = Math.round(am);
  if (Math.abs(r) < 100) r = r < 0 ? -100 : 100;   // guard against rounding into the dead zone
  if (r === -100) r = 100;                          // -100 and +100 are the same price; show +100
  const sign = r > 0 ? '+' : (ascii ? '-' : MINUS);
  return sign + Math.abs(r);
}

export function fmtDecimal(d) {
  if (!Number.isFinite(d)) return '—';
  const digits = d < 1.1 ? 3 : 2;
  return num(d, digits);
}

// p is a fraction. mode: 'pct' | 'cents'
export function fmtProb(p, mode = 'pct', digits = 1) {
  if (!Number.isFinite(p)) return '—';
  const v = p * 100;
  return mode === 'cents' ? num(v, digits) + '¢' : num(v, digits) + '%';
}

export function fmtPctSigned(x, digits = 1) {
  if (!Number.isFinite(x)) return '—';
  const v = x * 100;
  const sign = v > 0 ? '+' : v < 0 ? MINUS : '';
  return sign + num(Math.abs(v), digits) + '%';
}

export function fmtMoney(x, { ascii = false, signed = false } = {}) {
  if (!Number.isFinite(x)) return '—';
  const neg = x < -0.005;
  const abs = Math.abs(x);
  const body = '$' + num(abs, 2);
  if (neg) return (ascii ? '-' : MINUS) + body;
  return (signed && abs >= 0.005 ? '+' : '') + body;
}

export function fmtUnits(x, { ascii = false, signed = false } = {}) {
  if (!Number.isFinite(x)) return '—';
  const neg = x < -0.0005;
  const abs = Math.abs(x);
  let s = num(abs, 2).replace(/\.?0+$/, '');
  if (s === '') s = '0';
  const body = s + 'u';
  if (neg) return (ascii ? '-' : MINUS) + body;
  return (signed && abs >= 0.0005 ? '+' : '') + body;
}

export function fmtCentsExact(x) {
  // x is a fraction of $1; show cents with up to 2 decimals (1.75¢)
  if (!Number.isFinite(x)) return '—';
  const c = x * 100;
  return num(c, c % 1 === 0 ? 0 : 2) + '¢';
}

export function toAscii(s) {
  return String(s).replace(/−/g, '-').replace(/ /g, ' ');
}
