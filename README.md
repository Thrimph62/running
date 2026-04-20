# Pacelog — Running Tracker

Dark, chart-forward running tracker. Runs on GitHub Pages. Syncs across devices via Supabase.

---

## Part A — Supabase (data sync)

1. Go to **[supabase.com](https://supabase.com)** → sign in with GitHub → **New project** (free tier is fine)
2. Wait ~1 min for it to provision
3. Open **SQL Editor → New query**, paste the entire contents of **`supabase-schema.sql`**, click **Run**
4. Open **Settings → API** and copy:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public** key (a long `eyJ...` string)

## Part B — GitHub Pages (hosting)

1. On **[github.com](https://github.com)** → **New repository** → public → name it e.g. `running`
2. Click **Add file → Upload files** → drag in every file from this folder → **Commit**
3. **Settings → Pages** → Source: **Deploy from branch**, branch: **main**, folder: **`/ (root)`** → **Save**
4. Wait ~60 seconds, then visit `https://<your-username>.github.io/running/`

## Part C — Configure credentials (one-time, in GitHub)

Open **`config.js`** in your repo → click the pencil icon → paste your Supabase URL and anon key:

```js
window.PACELOG_CONFIG = {
  supabaseUrl: "https://xxxxx.supabase.co",
  supabaseKey: "eyJhbGci...",
};
```

Commit. Pages redeploys in ~60s. **Every device that visits the URL is now connected automatically — no per-device setup.**

If you'd rather not commit the key to GitHub, leave `config.js` blank and each device will show a Sync-settings dialog on first visit instead.

## Updates

Edit files on GitHub.com (pencil icon on any file) → commit. Pages redeploys in ~60s. All devices get the update on next refresh.

## How it works

- **Hosting:** GitHub Pages serves static HTML/JS/CSS
- **Data:** Supabase Postgres, accessed from the browser via the anon public key
- **Security:** The schema includes Row Level Security policies so only authenticated users can write. For personal use, the simplest path is to keep the anon key unpublished (don't commit it — it lives in each device's `localStorage` only).
- **Fallback:** Without Supabase configured, the app uses bundled seed data so it still looks good.
