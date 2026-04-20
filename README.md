# PaceLog — Personal Running Tracker

A single-user running tracker that lives entirely in your browser and syncs to your own Supabase database. No signup, no subscription, no third-party tracking. You own the data; just you point the app at your Supabase project.

---

## What's in this package

| File | Purpose |
|---|---|
| `Running Tracker.html` | **Open this file.** The entry point. |
| `index.html` | Alias of the above (same file, web-server-friendly name). |
| `app.jsx` | Top-level layout, routing, sidebar. |
| `pages.jsx` | Home, History, Stats, Goals, Plan, Profile screens. |
| `data-provider.jsx` | React context — loads from Supabase, dispatches mutations. Also hosts the modals (AddRun, Goal, Plan, Config). |
| `supabase-client.jsx` | Supabase REST wrapper — CRUD calls for runs, goals, plan, profile. |
| `charts.jsx` | Line/bar charts, heatmap, mini-maps, splits chart. |
| `styles.css` | Full stylesheet — JetBrains Mono + Inter, dark theme. |
| `data.jsx` | Formatting helpers (pace, duration). No seed data. |
| `config.js` | Empty placeholder — Supabase URL/key are pasted in at runtime via the UI. |
| `supabase-schema.sql` | Run this once in your Supabase SQL editor. |

---

## Installation — 5 minutes

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → sign up (free tier is plenty) → **New project**.
2. Give it a name (e.g. `pacelog`), set a database password, pick a region, click Create.
3. Wait ~1 minute for the project to provision.

### 2. Run the schema

1. In the Supabase dashboard, open **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open `supabase-schema.sql` from this package, copy its entire contents, paste into the editor.
4. Click **Run**.

You should see `Success. No rows returned`. Four tables are now created: `runs`, `goals`, `plan`, `profile`. They're empty — the way it should be.

### 3. Copy your project credentials

1. Still in Supabase, go to **Project Settings** → **API** (left sidebar, gear icon).
2. Copy the **Project URL** (looks like `https://abcdefghij.supabase.co`).
3. Copy the **anon / public** key (a long JWT starting with `eyJ...`). **Do not** use the `service_role` key.

### 4. Open the app

1. Unzip this package somewhere on your computer.
2. Double-click **`Running Tracker.html`**. It opens in your browser.
3. On first launch you'll see a **"Connect to Supabase"** screen with a sync-settings dialog. Paste the **Project URL** and the **anon key** from step 3.
4. Click **Connect**.

That's it. The sidebar status will flip to `synced · cloud` and the app is yours.

---

## Using it

- **Home** — week/month summary, 12-week volume chart, pace trend, recent runs.
- **History** — every run, filterable and sortable. Click any row for the detail modal.
- **Stats & trends** — monthly totals, pace distribution, day-of-week heatmap, best times.
- **Goals & streaks** — set targets (km/min/runs), tick them off as you go.
- **Training plan** — 4-week calendar view, drop workouts on any day.
- **Profile** — edit your name, taglines, PRs. Achievements are computed from your actual runs.

### Logging a run

`+ Log run` (top-right on Home, or sidebar). Distance, duration, type, optional notes, elevation, heart rate. **Intervals:** add segments for workouts with structure — each segment has its own distance, duration, auto-computed speed, and note ("warmup", "tempo rep", "rest", etc.). When segments are present, the overall distance/duration auto-sum.

### Tweaks panel

Toggle **Tweaks** in the toolbar for live theme controls (accent color, grid density, etc.).

### Starting fresh

Sidebar → **Sync settings** → red **Start fresh — erase all data** button. Wipes all runs, goals, plan entries, and your profile (local cache + Supabase). Asks for confirmation.

---

## Deploying it online (optional)

The whole app is static files. To get a personal URL:

- **Netlify / Vercel / Cloudflare Pages:** drag-and-drop the folder. Done.
- **GitHub Pages:** push to a repo, enable Pages.
- **Any web host:** upload the files. Make sure `Running Tracker.html` (or `index.html`) is at the root.

Your Supabase URL + key are stored in the browser's localStorage — they never get baked into the files. Anyone using the hosted app has to paste their own creds, so you can host it publicly without leaking credentials.

---

## Security notes

- The schema includes **Row Level Security** policies. By default they allow the `anon` key to read/write — fine for personal use on a project only you know the URL of.
- For multi-user or public deployments, you'd want to add real Supabase auth and tighten the policies. This app doesn't ship that — it's intentionally single-user.
- Don't commit your anon key to a public repo if you're hosting the site somewhere public. Paste it in the Sync dialog instead.

---

## Troubleshooting

**"Could not connect" when pasting credentials**
Double-check the URL has no trailing slash and the key is the `anon` key, not `service_role`. Open DevTools → Console for a hint.

**Runs aren't saving**
Likely RLS is rejecting writes. Re-run `supabase-schema.sql` — the policies at the bottom should exist on all four tables.

**App looks broken / blank**
Open it via `file://` in a modern browser (Chrome, Edge, Safari, Firefox). Very old browsers won't support the inline Babel transform. If you want, put the folder behind a local static server: `npx serve .` from the folder.

**I want to reset a single table**
In Supabase SQL editor: `delete from public.runs;` (or `goals`, `plan`). The Profile row has a fixed `id=1` — don't delete that row, `update` it instead.

---

## Stack

- Vanilla React 18 + Babel standalone (no build step — everything runs from the browser).
- Supabase REST client loaded on demand from CDN.
- JetBrains Mono + Inter from Google Fonts.
- No analytics, no telemetry, no outbound calls beyond Supabase and the CDNs.

---

## License

Yours. Do whatever you want with it.
