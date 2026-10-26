// Fairline math engine. Pure functions, no DOM.
// Conventions: American odds are numbers like -110 or +150 (|odds| >= 100).
// Probabilities are fractions in [0, 1]. Decimal odds are > 1.

export const isValidAmerican = (am) => Number.isFinite(am) && Math.abs(am) >= 100;

export function toDecimal(am) {
  if (!isValidAmerican(am)) return NaN;
  return am > 0 ? 1 + am / 100 : 1 + 100 / Math.abs(am);
}

export function toImplied(am) {
  if (!isValidAmerican(am)) return NaN;
  return am > 0 ? 100 / (am + 100) : Math.abs(am) / (Math.abs(am) + 100);
}

// Probability -> American. p = 0.5 gives exactly +100 (even money).
export function probToAmerican(p) {
  if (!(p > 0 && p < 1)) return NaN;
  return p <= 0.5 ? ((1 - p) / p) * 100 : (-p / (1 - p)) * 100;
}

export function probToDecimal(p) {
  if (!(p > 0 && p < 1)) return NaN;
  return 1 / p;
}

export function decimalToAmerican(d) {
  if (!(d > 1)) return NaN;
  return d >= 2 ? (d - 1) * 100 : -100 / (d - 1);
}

// No-vig / fair line. Standard multiplicative method.
export function noVig(amA, amB) {
  const impliedA = toImplied(amA);
  const impliedB = toImplied(amB);
  const sum = impliedA + impliedB;
  const fairA = impliedA / sum;
  const fairB = impliedB / sum;
  return {
    impliedA, impliedB,
    fairA, fairB,
    fairOddsA: probToAmerican(fairA),
    fairOddsB: probToAmerican(fairB),
    fairDecA: probToDecimal(fairA),
    fairDecB: probToDecimal(fairB),
    overround: sum - 1,           // e.g. 0.0476 for -110/-110
    hold: 1 - 1 / sum,            // book margin on handle, e.g. 0.0455 for -110/-110
  };
}

// Parlay: legs are American odds. Combined prob = product of implied probs.
export function parlay(legs, stake = 0, offeredAm = NaN) {
  const probs = legs.map(toImplied);
  if (probs.some((p) => !Number.isFinite(p))) return null;
  const prob = probs.reduce((a, b) => a * b, 1);
  const decimal = 1 / prob;
  const american = probToAmerican(prob);
  const fairProfit = stake * (decimal - 1);
  const fairTotal = stake * decimal;
  let offered = null;
  if (isValidAmerican(offeredAm)) {
    const offDec = toDecimal(offeredAm);
    offered = {
      decimal: offDec,
      implied: 1 / offDec,
      profit: stake * (offDec - 1),
      total: stake * offDec,
      // Expected value per $1 staked at the offered price, given the fair prob.
      edge: prob * offDec - 1,
      // Difference in payout vs fair, in dollars (negative = book pays less).
      payoutGap: stake * (offDec - decimal),
    };
  }
  return { probs, prob, decimal, american, fairProfit, fairTotal, offered };
}

// Straight payout. Risk -> win.
export function payoutFromRisk(stake, am) {
  const d = toDecimal(am);
  return { stake, profit: stake * (d - 1), total: stake * d, decimal: d };
}

// Straight payout. To win -> risk needed.
export function payoutFromWin(win, am) {
  const d = toDecimal(am);
  const stake = win / (d - 1);
  return { stake, profit: win, total: stake + win, decimal: d };
}

// Hedge an open bet.
//   stake:   original stake
//   origAm:  original odds
//   hedgeAm: odds available now on the opposite side
export function hedge(stake, origAm, hedgeAm) {
  const dO = toDecimal(origAm);
  const dH = toDecimal(hedgeAm);
  const payout = stake * dO;                 // total return if original wins
  const equalStake = payout / dH;            // equal-profit hedge
  const guaranteed = payout - stake - equalStake;
  // Smallest hedge that returns the original stake if the original loses.
  const breakEvenStake = stake / (dH - 1);
  // Largest hedge before the original-wins outcome turns negative.
  const maxNoLossStake = payout - stake;
  return {
    dO, dH, payout, equalStake, guaranteed,
    breakEvenStake,
    breakEvenIfOriginalWins: payout - stake - breakEvenStake,
    breakEvenPossible: breakEvenStake <= maxNoLossStake + 1e-9,
    maxNoLossStake,
  };
}

// Profit in each outcome for any hedge amount.
export function hedgeOutcomes(stake, origAm, hedgeStake, hedgeAm) {
  const dO = toDecimal(origAm);
  const dH = toDecimal(hedgeAm);
  return {
    ifOriginalWins: stake * (dO - 1) - hedgeStake,
    ifHedgeWins: hedgeStake * (dH - 1) - stake,
  };
}

// Arbitrage across two prices. Stakes proportional to implied probability.
export function arb(amA, amB, total) {
  const pA = toImplied(amA);
  const pB = toImplied(amB);
  const sum = pA + pB;
  const stakeA = (total * pA) / sum;
  const stakeB = (total * pB) / sum;
  const ret = total / sum;                   // same return whichever side wins
  return {
    exists: sum < 1,
    sum,
    shareA: pA / sum,                      // fraction of total that goes on A
    shareB: pB / sum,
    stakeA, stakeB,
    returnTotal: ret,
    profit: ret - total,
    roi: 1 / sum - 1,
  };
}

// Prediction market taker fee per contract, as a fraction of $1.
// fee = rate * price * (1 - price). Kalshi: rate 0.07, peaks at 1.75c on a 50c contract.
export function takerFee(price, rate) {
  if (!(price >= 0 && price <= 1) || !(rate >= 0)) return NaN;
  return rate * price * (1 - price);
}

export function effectivePrice(price, rate) {
  const fee = takerFee(price, rate);
  return { fee, price: price + fee };
}

export const FEE_PRESETS = [
  { id: 'novig', label: 'Novig pregame', short: 'Novig', rate: 0, note: 'No fee on bets placed before the game starts.' },
  { id: 'novig-live', label: 'Novig live', short: 'Novig live', rate: 0.06, note: 'In-game bets: a small fee, at most 1.5\u00A2 per $1 (biggest at a 50\u00A2 price, smaller near 0 or 100).' },
  { id: 'novig-parlay', label: 'Novig parlay', short: 'Novig parlay', rate: 0.10, note: 'Parlays: a fee of at most 2.5\u00A2 per $1, already built into the price you see.' },
  { id: 'kalshi', label: 'Kalshi', short: 'Kalshi', rate: 0.07, note: 'At most 1.75\u00A2 per $1 (biggest at a 50\u00A2 price, smaller near 0 or 100). Kalshi rounds each bet up to the next cent.' },
  { id: 'poly-sports', label: 'Polymarket sports', short: 'Polymarket', rate: 0.03, note: 'At most 0.75\u00A2 per $1 (biggest at a 50\u00A2 price, smaller near 0 or 100).' },
  { id: 'poly-pft', label: 'Polymarket politics', short: 'Polymarket', rate: 0.04, note: 'At most 1\u00A2 per $1 (biggest at a 50\u00A2 price, smaller near 0 or 100).' },
  { id: 'poly-crypto', label: 'Polymarket crypto', short: 'Polymarket', rate: 0.07, note: 'At most 1.75\u00A2 per $1 (biggest at a 50\u00A2 price, smaller near 0 or 100).' },
  { id: 'none', label: 'None', short: '', rate: 0, note: 'No fee applied.' },
  { id: 'custom', label: 'Custom', short: 'custom', rate: null, note: 'Your own rate. The fee is rate \u00D7 price \u00D7 (1 \u2212 price) per $1, so it is biggest at a 50\u00A2 price.' },
];
