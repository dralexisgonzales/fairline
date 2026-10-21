# Putting Fairline on your phone

Three parts. Part 1 is a one-time setup on a computer (about 5 minutes). Parts 2 and 3 are on your iPhone.

The code is already in a private GitHub repository: https://github.com/dralexisgonzales/fairline

## Part 1: connect the repository to Cloudflare Pages (one time, on a computer)

1. Open https://dash.cloudflare.com in your browser and log in to your Cloudflare account.
2. In the menu on the left, click **Workers & Pages**. (On some accounts it sits under a heading called **Compute (Workers)**.)
3. Click the blue **Create** button (it may say **Create application**).
4. At the top of the page that opens there are two tabs, **Workers** and **Pages**. Click **Pages**.
5. Click **Connect to Git** (or **Import an existing Git repository**).
6. Click **Connect GitHub**. A GitHub window opens.
   - If GitHub asks which account, choose **dralexisgonzales**.
   - Choose **Only select repositories**, open the dropdown, and tick **fairline**.
   - Click **Install & Authorize**. You may be asked for your GitHub password or a code from your phone. That is normal.
7. You are back in Cloudflare. **fairline** now appears in the list. Click it, then click **Begin setup**.
8. Fill in the form exactly like this:
   - **Project name:** `fairline` (this becomes your web address, `fairline.pages.dev`; if Cloudflare says the name is taken, use `fairline-odds` or anything you like)
   - **Production branch:** `main`
   - **Framework preset:** `None`
   - **Build command:** leave empty
   - **Build output directory:** type a single forward slash: `/`
   - Leave everything else alone.
9. Click **Save and Deploy**.
10. Wait about a minute. When the page says **Success**, your address is shown at the top. It looks like `https://fairline.pages.dev`. Click **Continue to project** if asked. That address is your app. Open it on any phone or computer.

From now on, every time code is pushed to the GitHub repository, Cloudflare publishes it automatically. You never have to come back here.

## Part 2: add it to your iPhone home screen

1. On your iPhone, open **Safari** (it must be Safari, not Chrome) and go to your address, for example `https://fairline.pages.dev`.
2. Tap the **Share** button: the square with an arrow pointing up, in the middle of the bar at the bottom of the screen.
3. Scroll down the list and tap **Add to Home Screen**.
4. The name is already **Fairline**. Tap **Add** in the top right.
5. Close Safari. Find the gold-and-black Fairline icon on your home screen and open it from there. It runs full screen with no browser bars.

The first time you open it from the icon, leave it open for a few seconds while it saves itself for offline use. After that it works with no signal at all.

## Part 3: first-time settings (30 seconds)

1. Tap the gear in the top right.
2. Enter your **bankroll** and your **unit size** in dollars.
3. Pick the **prediction market fee** you use most. Kalshi taker is already selected.
4. Tap **Done**. These are saved on the phone and stay until you change them.

## Android

Open the address in Chrome, tap the three dots in the top right, then **Add to Home screen** (or **Install app**), then **Install**.

## Updates

When the app is updated and pushed to GitHub, Cloudflare publishes it within a minute. Your phone picks up the new version the next time or two you open the app. Nothing to install.
