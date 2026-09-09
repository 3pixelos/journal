# Trading Journal

A private trading journal and performance dashboard. Multi-user: **every trader has
their own login and their own P&L**. The journal is the one shared surface.

- **React + Vite** frontend
- **Supabase** for Postgres, Auth and Storage
- Dark-mode first, mobile-friendly, no server of your own to run

---

## Privacy model — read this first

| Data | Who can see it |
|---|---|
| Trades, prices, P&L, accounts, goals, risk limits | **Only you.** Enforced by RLS (`user_id = auth.uid()`). |
| Trading rules / reminders | **Only you.** |
| Journal entries marked *public* | Everyone signed in — text, tags, screenshots and the win/loss label. Never the amounts. |
| Journal entries marked *private* | Only you. |
| Display name | Everyone signed in (it is the byline on shared entries). |

A shared journal entry can be linked to one of your trades, but **the trade itself is
never exposed** — no symbol prices, no size, no P&L. Others see only what you wrote,
your tags, and the charts you attached. This is enforced in the database, not just the
UI: the `trades` table has a single policy limiting every operation to the owner, so
another user's session physically cannot read a row.

---

## 1. Set up Supabase

1. Open your project → **SQL Editor** → **New query**.
2. Paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and run it.
3. Then run the migrations in order, each as its own query:
   - [`supabase/002_reminders_and_presence.sql`](supabase/002_reminders_and_presence.sql) — trading rules + "last active"
   - [`supabase/003_journal_outcome.sql`](supabase/003_journal_outcome.sql) — win/loss labels on entries

That one file creates every table, relationship, index, RLS policy, the
`trade-screenshots` storage bucket and its policies, and a trigger that gives each new
signup a profile, default risk settings and a starter pre-market checklist. It is
idempotent — safe to re-run after edits.

4. **Authentication → Providers → Email**: leave email/password enabled. Disable
   "Confirm email" if you want signups to be usable immediately without a confirmation
   click.
5. **Authentication → URL Configuration**: add your deployed URL (and
   `http://localhost:5173`) to *Redirect URLs* so password resets come back to the app.

### Who can sign up

By default anyone with the app URL can create an account. Since this is for you and a
small group, lock it down after your traders have registered:
**Authentication → Providers → Email → disable "Allow new users to sign up."**
You can still add people manually from **Authentication → Users → Add user**.

---

## 2. Configure the app

Credentials live in environment variables — nothing is hardcoded. The Supabase **anon
key** is designed to be shipped in a browser bundle (it is publishable, and RLS is what
actually protects the data), but it still does not belong in git.

```bash
cp .env.example .env.local
```

Then fill in `.env.local`:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Both come from **Project Settings → API**. They are read in exactly one place,
[`src/lib/supabase.js`](src/lib/supabase.js), and Vite only exposes variables prefixed
with `VITE_`. `.env.local` is gitignored.

> Never put the **service_role** key in this project. It bypasses RLS entirely and would
> expose every user's trades to anyone who opened the site.

---

## 3. Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173, create an account, and start logging.

---

## 4. Deploy to Vercel

```bash
git init && git add -A && git commit -m "Trading journal"
git remote add origin git@github.com:YOU/trading-journal.git
git push -u origin main
```

Then in Vercel: **New Project → import the repo**. Framework preset *Vite* is detected
automatically (build `npm run build`, output `dist`). Before the first deploy, add both
environment variables under **Settings → Environment Variables**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`vercel.json` already rewrites all routes to `index.html` so client-side routing works
on refresh. Finally, add the production URL to Supabase's Redirect URLs.

---

## What's in it

**Dashboard** — today and this week at a glance, progress against your weekly goal,
weekly and daily max-loss meters that warn you when you hit them, P&L by day for the
current week, equity curve, recent trades.

**Trades** — a **month calendar** of daily P&L, green for winning days and red for
losing ones, with weekly subtotals and a click-through to any day's trades (or a List
view if you prefer the table). Log symbol, direction, entry/exit, size, contract
multiplier, fees, account and date. P&L auto-calculates from the prices (with one-tap multiplier presets for MNQ,
NQ, MES, ES, GC) and stays editable for partial fills or broker-reported totals. Filter
by range, symbol, direction, account and tags.

**Journal** — a per-trade or standalone entry covering setup, reasoning, emotional
state, mistakes and what you'd do differently, plus tags and chart screenshots. Every
entry has a **Public / Private** toggle and an optional **win / loss / breakeven** label
you can set later, straight from the feed. Two views: *My journal* and *Team feed*, and
in the feed you can filter by person or by outcome.

**Reminders** — your own trading rules ("no more than 2 trades per day"), each with the
reason behind it. Active rules appear on the dashboard every day.

**Trading floor** — see who else is online right now and which page they're on, or when
they were last active. Live over Supabase Realtime presence.

**Analytics** — win rate, average win vs. average loss, profit factor, payoff ratio,
expectancy, max drawdown, equity curve, P&L by day/week/month, best and worst days,
performance by symbol, weekday, direction and tag.

---

## Project layout

```
supabase/schema.sql      Everything the database needs, in one runnable file
src/lib/supabase.js      Client — the only place env vars are read
src/lib/calc.js          Stats engine: P&L, win rate, profit factor, curves, streaks
src/lib/api.js           Tag/attachment syncing and cascade-aware deletes
src/lib/storage.js       Screenshot upload + signed URLs for the private bucket
src/context/AuthContext  Session, profile and settings
src/components/          Reusable UI, trade form, journal form, tag picker, uploader
src/pages/               Dashboard, Trades, Journal, Reminders, Analytics, Settings
src/context/Presence     Realtime "who's online" + last-seen heartbeat
```

## Theme

Black-and-white by design: green means a win, red means a loss, and nothing else
competes for that signal. Light and dark both ship — toggle in the top bar, and the
choice is remembered.

## Notes

- **Screenshots** live in a **private** bucket. The app fetches short-lived signed URLs
  on demand; there are no public image links to leak.
- **Dates** are handled in local time throughout, so a late-evening trade lands on the
  day you actually took it. Weeks start on Monday.
- **P&L** is stored as the net figure per trade. The calculator is
  `(exit − entry) × direction × quantity × multiplier − fees`.
