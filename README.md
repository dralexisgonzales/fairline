# Fairline

A personal odds calculator for sports betting and prediction markets. Converts American odds and probabilities, strips the vig off a line, prices parlays, works out hedges and arbitrage, and does payout math. Installs to a phone home screen and works fully offline.

No build step. No dependencies. No accounts, analytics, or network calls. Everything is plain HTML, CSS and JavaScript, and all inputs and settings are saved only on the device.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The app shell |
| `css/app.css` | All styling, dark and light themes |
| `js/math.js` | Every formula, as pure functions |
| `js/format.js` | Number and odds formatting |
| `js/ui.js` | Shared inputs and tap-to-copy results |
| `js/calcs/*.js` | One file per calculator |
| `js/settings.js` | Settings sheet (bankroll, units, fees, theme) |
| `js/app.js` | Tabs, theme, service worker registration |
| `sw.js` | Service worker: caches the app for offline use |
| `manifest.webmanifest` | Home screen install metadata |
| `tests/math.html` | Browser-run checks for every formula |

## Run locally

Any static file server works. For example:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765 in a browser. The math tests are at http://localhost:8765/tests/math.html.

## Deploy

Hosted on Cloudflare Pages, connected to this GitHub repository. Every push to `main` deploys automatically. Cloudflare serves the folder as-is, so the build command is empty and the output directory is `/`.

When you change any file that the service worker caches, bump the `VERSION` string at the top of `sw.js` so installed phones pick up the new version on their next open.

## Math reference

- Implied probability of American odds: negative odds `|o| / (|o| + 100)`, positive odds `100 / (o + 100)`.
- Fair (no-vig) probability: each side's implied probability divided by the sum of both.
- Hold: `1 − 1 / (sum of implied probabilities)`. For a −110 / −110 line that is 4.55%.
- Parlay: combined probability is the product of the legs' implied probabilities; fair decimal odds are its reciprocal.
- Hedge: original payout = stake × decimal odds. Equal-profit hedge = payout ÷ opposite decimal odds. Guaranteed profit = payout − stake − hedge.
- Arbitrage: an arb exists when the implied probabilities sum to under 100%. Stakes are proportional to each side's implied probability.
- Prediction market taker fee per contract: `rate × price × (1 − price)`. Kalshi uses 7%, which peaks at 1.75¢ on a 50¢ contract.
