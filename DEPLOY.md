# Putting Fairline on your phone

**Your address is https://fairline-app.pages.dev**

The app is already published there. Part 1 below is done and is kept only as a record of how the hosting is set up. Parts 2 and 3 are on your iPhone.

The code lives in a private GitHub repository: https://github.com/dralexisgonzales/fairline

## Part 1: how the hosting works (already done)

Fairline is hosted on Cloudflare Pages, in the Cloudflare account signed in as dralexisgonzales@gmail.com. Two Pages projects are connected to the same GitHub repository, with the same settings:

| Project | Address | Status |
|---|---|---|
| `fairline-app` | https://fairline-app.pages.dev | **Use this one.** Created 26 October 2026. |
| `fairline` | https://fairline-2bi.pages.dev | The original. It still publishes every push, but the address does not load on some home networks. Safe to delete in the Cloudflare dashboard if you no longer want it. |

Settings on both projects:

- **Production branch:** `main`
- **Framework preset:** `None`
- **Build command:** empty
- **Build output directory:** `/` (the repository root)

Every push to `main` on GitHub publishes to both addresses within about a minute. Nothing else to do.

If you ever need to set this up again from scratch (a new Cloudflare account, say):

1. Open https://dash.cloudflare.com and log in.
2. In the menu on the left, click **Workers & Pages**, then **Create application**, then the **Pages** tab, then **Connect to Git**.
3. Click **Connect GitHub**, choose the **dralexisgonzales** account, choose **Only select repositories**, tick **fairline**, and click **Install & Authorize**.
4. Back in Cloudflare, click **fairline**, then **Begin setup**.
5. Project name: anything you like (it becomes the address, `name.pages.dev`). Production branch `main`, framework preset `None`, build command empty, build output directory `/`.
6. Click **Save and Deploy** and wait about a minute for **Success**.

## Part 2: add it to your iPhone home screen

1. On your iPhone, open **Safari** (it must be Safari, not Chrome) and go to `https://fairline-app.pages.dev`.
2. Tap the **Share** button: the square with an arrow pointing up, in the middle of the bar at the bottom of the screen.
3. Scroll down the list and tap **Add to Home Screen**.
4. The name is already **Fairline**. Tap **Add** in the top right.
5. Close Safari. Find the gold-and-black Fairline icon on your home screen and open it from there. It runs full screen with no browser bars.

The first time you open it from the icon, leave it open for a few seconds while it saves itself for offline use. After that it works with no signal at all.

If you added the old address to your home screen earlier, delete that icon (press and hold it, then **Remove App**) and add the new one. Your saved settings and numbers do not carry over between the two addresses, so enter them again once.

## Part 3: first-time settings (30 seconds)

1. Tap the gear in the top right.
2. Enter your **unit size** and your **bankroll** in dollars.
3. Pick the **fee** for the exchange you use most. Novig pregame (no fee) is already selected; Novig live, Novig parlay, Kalshi and Polymarket are in the list.
4. Tap **Done**. These are saved on the phone and stay until you change them.

## Android

Open `https://fairline-app.pages.dev` in Chrome, tap the three dots in the top right, then **Add to Home screen** (or **Install app**), then **Install**.

## Updates

When the app is updated and pushed to GitHub, Cloudflare publishes it within a minute. Your phone picks up the new version the next time or two you open the app. Nothing to install.
