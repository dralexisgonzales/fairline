# BUILD BRIEF: Fairline

## What this is

A personal odds calculator for sports betting and prediction markets. It converts between American odds and probabilities, strips the vig off sportsbook lines, prices parlays, works out hedges, and does basic payout math. It lives on my phone as a home screen web app.

The goal is that it's extremely useful and extremely fast to use. I'll open it many times a day mid-decision, usually with one hand, and I want the answer in a couple of taps. Every screen should earn its place. If something isn't useful in that moment, it doesn't belong on the main screens.

I also want it to look and feel like a premium, award-level product. Exceptional UI, premium functionality, zero clutter. That's the bar.

## Who it's for

Just me. I'm not technical at all. I bet sports with a model, track confidence in units, and trade prediction markets (Kalshi primarily, some Polymarket). I think in American odds and in percentages.

## The calculators (v1)

### 1. Odds to probability converter
- Input American odds, see implied probability as a percentage.
- Input a probability, see the American odds.
- Both directions, live as I type, no submit button.
- Decimal odds shown as a secondary readout. No fractional odds anywhere in the app.
- Probability can be shown as a percentage (62%) or as cents (62¢), since prediction markets quote in cents. Percentage is the default. One toggle switches it.

### 2. No-vig / fair line
- Input both sides of a line (for example -110 / -110, or -150 / +130).
- Output: the fair (no-vig) probability of each side, the fair American odds of each side, and the sportsbook's hold percentage.
- Standard method: each side's implied probability divided by the sum of both implied probabilities.
- This is the most-used screen in the app.

### 3. Parlay fair value
- Add legs as American odds. Any number of legs, add and remove freely.
- Output: the true combined probability (product of the implied probabilities), the fair parlay odds in American, and the parlay payout on a given stake.
- Optional: a field for the odds the book is actually paying on the parlay, so I can see the gap between fair and offered.

### 4. Hedge calculator
This one has to be mathematically correct. Two modes.

Mode A, hedge an open bet:
- Inputs: my original stake, the original American odds, and the current American odds available on the opposite side.
- Outputs: the hedge stake that locks in the same profit regardless of outcome, and what that guaranteed profit (or loss) is. Also show the hedge stake that just gets me to break even, and the profit in each outcome for any hedge amount I type in manually.
- Math: original payout = stake × decimal odds. Equal-profit hedge stake = original payout ÷ opposite decimal odds. Guaranteed profit = original payout minus original stake minus hedge stake.

Mode B, arbitrage across two prices:
- Inputs: American odds on side A (one book or market) and American odds on side B (another book or market), plus a total amount to put in.
- Outputs: whether an arb exists (sum of implied probabilities under 100%), how to split the total between the two sides, and the locked profit in dollars and as a percentage.
- Math: stake on each side proportional to its implied probability.

### 5. Payout calculator
- Inputs: stake and American odds.
- Outputs: profit and total return.
- A flip between "risk" and "to win" (enter what I want to win, get what I need to risk, and vice versa).
- Stake can be entered in dollars or units, with the other shown alongside.

## Bankroll and units
- In settings I set a bankroll in dollars and a unit size in dollars. Both saved on the device.
- Anywhere a stake appears, I can enter it in dollars or in units and see both.
- Unit size changes should flow through everywhere instantly.

## Prediction market fees
- When a probability is entered as a prediction market price, I want to be able to see the effective price after the market's taker fee.
- Default fee model: Kalshi taker. Fee per contract = 0.07 × price × (1 − price), rounded up to the next cent. Peaks at 1.75¢ on a 50¢ contract.
- Presets available in settings: Kalshi taker (0.07), Polymarket sports (0.03), Polymarket politics/finance/tech (0.04), Polymarket crypto (0.07), none (0), and custom (I type a rate). Polymarket uses the same price × (1 − price) shape with those rates.
- The fee setting lives in settings, not on the main screens. On the converter, a small "after fees" readout is enough.

## Platform and hosting facts
- Progressive web app. Installs to the iPhone home screen via Safari's Add to Home Screen and runs full screen with its own icon. Also works on Android.
- Works fully offline after install. All math is local. No accounts, no login, no analytics, no data leaving the phone.
- Remembers my last inputs on each calculator and my settings between sessions.
- Hosted on Cloudflare Pages (free). Source in a GitHub repo (free). I already have Cloudflare and GitHub accounts.
- Set up the repo, the build, and the Cloudflare Pages deployment. Where anything needs me (logging in, clicking approve, connecting the repo to Cloudflare), give me exact step-by-step instructions written for someone who is not technical.
- Dark mode by default, light mode available.
- Phone first. Numeric keypad should come up on number fields. A +/- toggle so I never have to find the minus sign for American odds.
- Tap any result to copy it.

## Not in v1 (so you know where this is headed)
- Edge/EV and Kelly sizing against a true probability.
- Live prices from Kalshi/Polymarket APIs.
- Bet logging and CLV tracking.
- Multi-book line comparison.

## How I want the work done
- Build the full v1 yourself first.
- Then spin up a set of Sonnet subagents to review it independently: one on the math (verify every formula with worked examples, including edge cases like +100, -100, even money, extreme longshots, and three-leg parlays), one on the phone UX (ease of use, speed to answer, one-handed use, clutter), and one on visual quality against the bar of an award-level product. Each one reports back with specific issues.
- Fix what they find, then send them back out. Keep looping until every reviewer signs off that the output is exceptional and hits the goals in this brief with nothing left to flag.
- When you're done, give me: the live URL, exactly how to add it to my iPhone home screen, and a short list of what each calculator does in plain language.
