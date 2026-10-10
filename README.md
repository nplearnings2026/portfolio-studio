# Portfolio Studio

A personal net worth and portfolio tracker that runs entirely in the browser. It covers stocks, a 401(k), CDs, savings, property and a mortgage, with projections, tax estimates and a retirement goal. Data syncs between devices through your own OneDrive.

This repository holds only the page. **No financial data or API keys are stored here.** Each device keeps its data in browser storage and syncs it to a file in the owner's OneDrive.

## Files

| File | Purpose |
|---|---|
| `index.html` | The page and its styles, plus the security policy |
| `app.js` | All the app's code |
| `manifest.webmanifest`, `icon*.png`, `icon.svg` | Lets phones install it from the home screen |
| `sw.js` | Offline cache, so the app opens without a connection |

## Publish on GitHub Pages

1. Create a **public** repository named `portfolio-studio`.
2. Upload every file in this folder to the root of the repository, on the `main` branch.
3. Go to **Settings → Pages**, choose **Deploy from a branch**, then `main` and `/ (root)`, and save.
4. After a minute the site is live at `https://<your-username>.github.io/portfolio-studio/`.

## Connect OneDrive (one time)

1. In the Azure portal, open the app registration **Portfolio Studio** and go to **Authentication → Single-page application**.
2. Add this redirect URI exactly, **including the trailing slash**:
   `https://<your-username>.github.io/portfolio-studio/`
   Keep `http://localhost:8080/` if you want to test locally.
3. API permissions must include **Microsoft Graph → Files.ReadWrite.AppFolder** and **User.Read**. Both are delegated permissions.
4. Open the site, go to **Settings → Saving and sync**, and choose **Sign in to OneDrive**. Use your **personal** Microsoft account.

The app can only see its own folder: **OneDrive › Apps › Portfolio Studio**. It keeps `portfolio-data.json` there. If that folder holds exactly one `.json` file with another name, the app uses that file instead.

## Install on a phone

- **iPhone:** open the site in **Safari**, tap **Share → Add to Home Screen**, then open the new icon. Sign in to OneDrive **inside the installed app**, because home-screen apps have separate storage from Safari.
- **Android:** open the site in **Chrome**, tap **⋮ → Install app** (or **Add to Home screen**), and sign in inside the app.

Enter your price-feed API key on each device under **Settings → Live price feed**. Keys never sync. An optional **Backup key** for the other provider prices symbols the main one can't, such as some mutual funds on Finnhub.

## How sync behaves

- **When it syncs:** when the app opens, when you return to it, every 5 minutes, and about 2 seconds after each change.
- **Sync first:** when the app opens, it syncs before making any automatic save (daily snapshot, price refresh), so a device with an older copy can't overwrite newer data.
- **Conflicts:** the most recently *edited* copy wins. Automatic saves don't count as edits. Net worth history from every device is always combined by date.
- **Items that would be lost:** if a sync would drop an item that was added on another device and never synced here (or the reverse), the app asks first.
- **Backups:** each device keeps 20 backups in the browser, and once a day saves the OneDrive copy to `Apps › Portfolio Studio › backups` (newest 40 kept). Restore either kind from **Settings → Backups**.
- **Old versions:** if a copy of the app finds data saved by a newer version, it pauses saving and syncing and asks you to reload.
- **Offline:** changes stay on the device and upload when it's back online.
- **Sign-in:** Microsoft sign-in for browser apps lasts about 24 hours. After that, the app signs you back in automatically when it opens, as long as your Microsoft session is still active. Otherwise a **Sign in again** banner appears.
- **Sign out on this device:** uploads any changes not yet in OneDrive, then removes your data, history and backups from that device, which then shows sample data. If it can't reach OneDrive and there are unsent changes, it warns you first. Price-feed keys stay. The file stays in OneDrive, and signing in again loads it.

## Test locally

From this folder, run:

```
python3 -m http.server 8080 --bind 127.0.0.1
```

Then open `http://localhost:8080/`. Opening `index.html` straight from disk works too, but OneDrive sync and the offline cache need a web address.

## Updating the app

Raise `APP_BUILD` (and `APP_VERSION`) near the top of `app.js` with every change, and set the same number in `index.html`'s `<script src="app.js?v=…">`. Then replace the changed files in the repository, usually `app.js` and `index.html` together. Changes appear the next time the app opens online. On a phone, close the app fully and reopen it.

Calculation rules for every number in the app are documented separately in `PORTFOLIO-STUDIO-RULES.md`.
