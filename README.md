# Lion Heart Quintet

Sign-up site for the Lion Heart Quintet grappling tournament. Plain HTML, CSS and JavaScript with no build step.

- `index.html`: event details and rules (the first page people see)
- `register.html`: sign-up form
- `assets/js/config.js`: form URL and colour theme
- `assets/js/i18n.js`: all text in English, Russian and Armenian
- `apps-script/Code.gs`: saves sign-ups to a Google Sheet and sends a Telegram alert

## Before going live

1. Connect sign-ups (below).
2. Have the Russian and Armenian checked by native speakers. Both are drafts. The waiver PDF (`assets/docs`) is English only.
3. Set the date in `assets/js/i18n.js` (`datePill` and `dateValue`, in all three languages).

## Connect sign-ups: Google Sheet and Telegram

### 1. Make a Telegram bot

1. In Telegram, message [@BotFather](https://t.me/BotFather), send `/newbot` and follow the steps.
2. Copy the token it gives you. Treat it like a password.
3. Send your new bot any message. To get alerts in a group instead, add the bot to the group and post a message there.

### 2. Set up the Google Sheet

1. Create a new Google Sheet, then open **Extensions > Apps Script**.
2. Replace everything in the editor with the contents of `apps-script/Code.gs`, then save.
3. Open **Project Settings** (gear icon). Under **Script Properties**, add `TELEGRAM_BOT_TOKEN` with your token.
4. Back in the editor, choose `showTelegramChatId` from the function menu and click **Run**. Google will ask for permission the first time. Copy the ID it prints.
5. Add a second script property, `TELEGRAM_CHAT_ID`, with that ID.
6. Run `testSetup`. You should get a Telegram message, and a `Sign-ups` tab should appear in the Sheet.

### 3. Publish it

1. Click **Deploy > New deployment**, and choose **Web app** as the type.
2. Set **Execute as** to **Me**, and **Who has access** to **Anyone**.
3. Click **Deploy** and copy the URL ending in `/exec`.
4. Paste that URL into `formEndpoint` in `assets/js/config.js`, and redeploy the site.

AKfycbzqgUrOj5unt2De1NPncrCWrwMUCPCutepgtKDvhkqkCU8Pj2BTRbIqOSfVAVgwpdZq
If you change `Code.gs` later, go to **Deploy > Manage deployments**, edit the deployment and choose **New version**, or the change won't take effect.

## Host on Vercel

From this folder, run:

    npx vercel

Follow the prompts, then run `npx vercel --prod` to publish. There is nothing to build, and Vercel's "Other" framework preset is correct.

## Preview locally

    python3 -m http.server 8137

Then open http://localhost:8137.

## Colour theme

Set `theme` in `assets/js/config.js` to `"orange"` for the black-to-blue background with the orange circle, or `"neutral"` for the current design.
