# Putting Fairline on your phone

**Your address is https://dralexisgonzales.github.io/fairline/**

The app is already published there. Part 1 below is done and is kept only as a record of how the hosting is set up. Parts 2 and 3 are on your iPhone.

The code lives in a public GitHub repository: https://github.com/dralexisgonzales/fairline

## Part 1: how the hosting works (already done)

Fairline is hosted on **GitHub Pages**, straight from the repository, at https://dralexisgonzales.github.io/fairline/ . Every push to the `main` branch is published within a minute or two. Nothing else to do.

It moved there on 6 November 2026 because the earlier Cloudflare addresses (`fairline-app.pages.dev` and `fairline-2bi.pages.dev`) were being blocked by home-network security filters. Those two Cloudflare projects still exist and now send every visit on to the GitHub address. They can be deleted in the Cloudflare dashboard (account dralexisgonzales@gmail.com) at any time.

How it is set up, in case it ever needs redoing: repository **Settings → Pages → Build and deployment**: source **Deploy from a branch**, branch **main**, folder **/ (root)**. The repository must be public for the free plan. A `.nojekyll` file in the repository tells GitHub to publish the files exactly as they are.

## Part 2: add it to your iPhone home screen

1. On your iPhone, open **Safari** (it must be Safari, not Chrome) and go to `https://dralexisgonzales.github.io/fairline/`.
2. Tap the **Share** button: the square with an arrow pointing up, in the middle of the bar at the bottom of the screen.
3. Scroll down the list and tap **Add to Home Screen**.
4. The name is already **Fairline**. Tap **Add** in the top right.
5. Close Safari. Find the gold-and-black Fairline icon on your home screen and open it from there. It runs full screen with no browser bars.

The first time you open it from the icon, leave it open for a few seconds while it saves itself for offline use. After that it works with no signal at all.

If you added an old `pages.dev` address to your home screen earlier, delete that icon (press and hold it, then **Remove App**) and add the new one. Saved settings and numbers do not carry over between addresses, so enter them again once.

## Part 3: first-time settings (30 seconds)

1. Tap the gear in the top right.
2. Enter your **unit size** and your **bankroll** in dollars.
3. Pick the **fee** for the exchange you use most. Novig pregame (no fee) is already selected; Novig live, Novig parlay, Kalshi and Polymarket are in the list.
4. Tap **Done**. These are saved on the phone and stay until you change them.

## Android

Open `https://dralexisgonzales.github.io/fairline/` in Chrome, tap the three dots in the top right, then **Add to Home screen** (or **Install app**), then **Install**.

## Updates

When the app is updated and pushed to GitHub, Cloudflare publishes it within a minute. Your phone picks up the new version the next time or two you open the app. Nothing to install.

## If the app will not open ("Safari cannot open the page")

Versions before 27 October 2026 had a bug in the part of the app that saves it for offline use, which could block the app from opening after an update. That is fixed, but a phone that was already stuck needs one clean start: in iPhone **Settings → Apps → Safari → Advanced → Website Data**, find **github.io** (or **pages.dev** for an old address), swipe it left and tap **Delete**, then open the app again. This also clears your saved settings and numbers, so enter your unit size and fee once more. After that one time, updates arrive cleanly.
