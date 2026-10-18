# E-Diary Planner — Developer Guide

This guide is for anyone who has to **deploy, understand, change or maintain** the E-Diary code. No prior knowledge of the project is assumed. For day-to-day *use* of the diary, see `README.md`.

---

## 1. The short version

| Question | Answer |
|---|---|
| What kind of program is it? | A **static web app**: HTML + CSS + JavaScript files that run entirely inside a web browser. There is **no server-side code and no database server**. |
| Languages | **HTML5**, **CSS3**, **JavaScript (ES2019, plain — no framework)**. Helper scripts: **Batch/PowerShell** (Windows), **Bash** (Mac, Linux), **Node.js** (optional build script). |
| Libraries / frameworks | **None.** No React, no jQuery, no npm packages. Nothing to install to run it. (The optional Google Calendar link loads Google's own sign-in script, `accounts.google.com/gsi/client`, only when you click *Link Google account*.) |
| Build step | **None required.** Edit a file, reload the browser. (`tools/build.mjs` only makes the optional single-file copy.) |
| Where is data stored? | In the **user's own browser** (IndexedDB, falling back to localStorage). Optional copies: a JSON file the user picks, or an encrypted GitHub gist. See section 5. |
| Runs on | **Windows, macOS and Linux** — and phones/tablets — in Chrome, Edge, Firefox, Safari, Brave. See section 3. |
| Internet needed? | No, except for the weather, the optional GitHub sync and the optional Google Calendar link. |
| Size | About 11,000 lines of code; about 700 KB unzipped (plus the same again for the single-file copy). |

---

## 2. Deploying it

Because it is static, "deploying" just means **putting the folder somewhere a browser can open it**. Pick any one of these.

### A. On a single computer (no server)

| System | How |
|---|---|
| Windows 10/11 | Double-click `Start E-Diary (Windows).bat` (opens an Edge app window). `Create Desktop Shortcut (Windows).bat` adds Desktop + Start-menu icons. |
| macOS | Double-click `Create Mac App (Mac).command` once → `~/Applications/E-Diary.app` (drag to Dock). Or `Start E-Diary (Mac).command`. First run: right-click → Open. |
| Linux | `./"Start E-Diary (Linux).sh"` (opens a Chrome/Chromium/Edge/Brave app window, else the default browser). |
| Any | Double-click `index.html` or `E-Diary (single file).html`. |

### B. Hosting it on your own computer or an office server (LAN)

| System | How |
|---|---|
| Windows | `Host on this computer (Windows).bat` — a tiny web server written in PowerShell (`tools/windows/serve.ps1`), no install. Port 8080. |
| macOS | `Host on this computer (Mac).command` — uses the built-in Python 3 or Ruby. |
| Linux | `./"Host on this computer (Linux).sh"` — uses Python 3 (`python3 -m http.server`). |
| Existing web server (IIS, Apache, Nginx, Caddy) | Copy the folder into the web root. No configuration needed. Optional: serve `.webmanifest` as `application/manifest+json`. |

Example Nginx block for a Linux server:

```nginx
server {
    listen 80;
    server_name diary.example.org;
    root /var/www/e-diary;          # the unzipped folder
    index index.html;
    location / { try_files $uri $uri/ =404; }
    types { application/manifest+json webmanifest; }
}
```

Example with Docker (any OS):

```bash
docker run -d -p 8080:80 -v "$PWD":/usr/share/nginx/html:ro nginx:alpine
```

### C. Free public hosting (use from anywhere)

- **GitHub Pages:** new repository → upload the folder's contents → Settings → Pages → *Deploy from a branch*, `main`, `/ (root)`. Address: `https://USER.github.io/REPO/`.
- **Netlify Drop:** drag the folder onto <https://app.netlify.com/drop>.
- **Cloudflare Pages / Vercel / Firebase Hosting:** create a project with *no build command* and output directory = the folder root.

Once it is on **https** (or `http://localhost`), Chrome/Edge offer **Install app**, and the service worker (`sw.js`) makes it work offline.

> Hosting only serves the app's code. Each visitor's diary lives in their own browser; nothing is sent to the host. Do not upload backup `.json` files to a public host.

---

### D. Linking Google Calendar (optional)

**Inside Claude** nothing is needed here: the diary calls the user's **Google Calendar connector** through the artifact's `mcp` capability (`window.claude.use('mcp')` → `callTool('Google Calendar', 'create_event' | 'update_event' | 'delete_event' | 'list_calendars', …)`). The user connects the connector in claude.ai Settings → Connectors and allows calendar access on Google's permission screen; Claude asks once to allow it for the page. The Events & Meetings page also calls `list_events` (read only) to show your Google events, so the artifact's connector manifest lists `create_event`, `update_event`, `delete_event`, `list_calendars` and `list_events`. A drop on a time or on *All day events* sends that item at once through the connector even when the diary is not linked (`GC.afterDrop` → a `one: true` entry in `gcal.map` → `pushOne()`; setting `gcal.auto`). If Google refuses (for example `Insufficient scope`, when the connector was linked without the calendar boxes ticked), the entry stays waiting (`GC.waiting()`), a red notice explains the fix, and waiting items are sent on **Try again**, **Check connection** (`GC.check()`, a harmless `list_calendars`) or the next start.

**Everywhere else** Google only lets a sign-in window talk to web pages whose address you registered, so the link works when the diary is opened from `http://localhost:8080` (the *Host on this computer* launchers) or your own site (GitHub Pages, Netlify…), not from a double-clicked file.

1. <https://console.cloud.google.com/> → create a project.
2. **APIs & Services → Library → Google Calendar API → Enable**.
3. **Google Auth Platform → Branding → Get started**: app name, your e-mail, audience **External**, finish.
4. **Audience → Test users → Add users**: your Gmail address (while the app is in *Testing*, only listed test users can sign in).
5. **Clients → Create client → Web application**, and under **Authorized JavaScript origins** add every address you open the diary from, e.g. `http://localhost:8080` and `https://YOUR-NAME.github.io`. Create, and copy the **Client ID**.
6. In the diary: **Settings → Google Calendar**, paste the Client ID, click **Link Google account**, choose which items to copy.

Browser-only apps get a one-hour token from Google; when it runs out and something changed, a *Reconnect* bar appears — one click, no password — and a drag (which is a click) renews it on the spot. Items deleted or moved in the diary are updated in Google; edits made in Google are not copied back. Example entries are never copied (dragging one makes it the user's own). Without any link, a drag onto a time or the all-day strip offers **Add to Google Calendar**, which opens Google's own "new event" page filled in (`GC.templateUrl`).

---

## 3. Is it deployable on Linux, Windows and Mac?

**Yes, all three.** The app itself is operating-system independent — it only needs a modern browser. Only the convenience scripts are per-OS:

| | Windows | macOS | Linux |
|---|---|---|---|
| Open the app locally | ✅ `.bat` + PowerShell | ✅ `.command` / `.app` | ✅ `.sh` |
| Desktop icon | ✅ `.lnk` shortcut | ✅ `E-Diary.app` | Use Chrome ⋮ → *Install page as app* (creates a `.desktop` entry) |
| Host on this machine | ✅ PowerShell server | ✅ Python/Ruby | ✅ Python / Nginx / Docker |
| Host on a server | IIS or any static host | any | Nginx, Apache, Caddy, Docker |
| Install as app (PWA) | Chrome, Edge | Chrome, Edge, Safari 17+ ("Add to Dock") | Chrome, Chromium, Edge |
| Phones | Android: Chrome; iPhone/iPad: Safari → Add to Home Screen | | |

Tested: Chromium on Linux (all features), app opened from disk (`file://`), from a local server, and through the Windows PowerShell server script (run under PowerShell 7). Supported browsers: Chrome/Edge 100+, Firefox 110+, Safari 16+.

---

## 4. How the code is organised

```
E-Diary/
├── index.html              Page skeleton: loads the CSS, then the JS files in order
├── manifest.webmanifest    App name, icons, colours (makes it installable)
├── sw.js                   Service worker: caches files for offline use
├── css/
│   ├── tokens.css          All colours (light + dark theme) as CSS variables
│   ├── base.css            Reset, buttons, form fields, switches, progress bars
│   ├── binder.css          Leather cover, the two pages, rings, section tabs, top bar, mobile layout
│   ├── views.css           Each section: daily page, task rows, cards, mission, notes, graph
│   ├── calendar.css        Mini calendar, time grid, week/month calendar, drag/resize handles
│   ├── components.css      Dialogs, editors, menus, toasts, rich-text, search, settings
│   ├── study.css           Study planner pages (Yearly, Monthly, Weekly & Daily)
│   ├── finance.css         Finance pages, password log and important websites
│   ├── more.css            Interview Prep, Health and Events & Meetings pages
│   └── diary.css           The physical book: closed cover, page turns, corner guards
├── js/   (loaded in this order — later files use earlier ones)
│   ├── util.js             Date maths ('YYYY-MM-DD' keys), formatting, HTML escaping/sanitising, file helpers
│   ├── xlsx.js             Reads Excel .xlsx (unzips with the browser's DecompressionStream) and CSV files
│   ├── icons.js            All SVG icons (ED.icon('trash'))
│   ├── store.js            Saving/loading: IndexedDB → localStorage → memory; undo; daily snapshots
│   ├── lock.js             Password lock for the whole diary: AES-256-GCM + PBKDF2, the lock screen, auto-lock
│   ├── sample.js           Default settings, starter roles/categories, removable example entries
│   ├── quotes.js           Quote of the day
│   ├── weather.js          Open-Meteo weather + city search, cached 30 min
│   ├── model.js            Business logic: tasks, repeat rules, priorities, carry-forward, stats, search, .ics
│   ├── ui.js               Reusable UI: modal, confirm, prompt, toast, menu, popover, colour/emoji pickers
│   ├── charts.js           Small SVG/HTML charts: columns, paired columns, lines, meters, calendar heatmap, tooltips
│   ├── richtext.js         Small rich-text editor (notes, diary page, mission)
│   ├── tasksui.js          How a task row looks; task context menu; delete/toggle helpers
│   ├── calendar.js         Mini calendar + calendar panel (1/3/5/7 days, month), all-day strip, timeline items
│   ├── tgdrag.js           Drag to move / drag the bottom edge to resize items on the hourly timelines
│   ├── editors.js          Task, event, role, goal, value, category, notebook editors
│   ├── view-daily.js       "Daily Tasks" section
│   ├── view-plan.js        "Monthly Tasks", "Roles", "Goals" sections
│   ├── view-mission.js     "Mission" and "Career Graph" sections (notes + progress analysis)
│   ├── study.js            Study planner data: Excel/CSV import, statistics, session and plan editors
│   ├── view-study.js       "Study Year", "Study Month", "Study Week & Day" sections
│   ├── finance.js          "Finance" section: records and transfers, budget, bills, savings pots, accounts, policies
│   ├── finplan.js          "Finance Plan" section: goal-based plan, India income tax, year-by-year projection, guidance
│   ├── wealth.js           Finance Plan → "Portfolio & risk" and "Wealth report": approaches, allocation, buckets, compounding, SIP, risk, Monte Carlo
│   ├── habits.js           Habit tracker: Daily Tasks group, Monthly Tasks summary/tracker, calendar dots, habit editor
│   ├── fx.js               Shared helpers for the pages below: dialogs built from a field list, page frame, linked calendar events
│   ├── interview.js        "Interview Prep" section: interviews, question bank, practice mode, readiness, documents, mock interviews
│   ├── health.js           "Health" section: medicines and doses, treatments, appointments, readings with charts, reports, medical card
│   ├── meetings.js         "Events & Meetings" section: Google Calendar events (read only) + diary events, agenda, month, meeting plans
│   ├── matrix.js           Planner → Eisenhower Matrix: tasks sorted by urgent/important, moved by drag or menu (t.eis)
│   ├── exam.js             Interview & Exams → Exam Preparation: exams, key dates, syllabus topics, spaced revision, mock tests
│   ├── mindmap.js          Study → Mind Maps: maps of ideas (tree layout both sides), keys, drag to move, ideas → tasks
│   ├── jobs.js             Study → Govt Jobs: Level 13A/14 openings from the weekly feed (db doc jobs/feed), your status/notes
│   ├── vault.js            "Passwords" section: encrypted password log + important websites
│   ├── settings.js         Settings dialog, backup/import/export, help
│   ├── search.js           Search dialog
│   ├── sync.js             Linked diary file + GitHub gist sync, three-way merge, encryption
│   ├── gcal.js             Google Calendar link: Claude connector (mcp) or Google Identity Services + Calendar REST API
│   ├── reminders.js        Alarms / notifications while the app is open
│   ├── holidays.js         Optional India (DoPT) holiday lists
│   ├── cover.js            The closed cover (open / close the diary) and the page-turn animation
│   └── app.js              Starts everything: state, rendering, navigation, clicks, drag & drop, shortcuts
├── icons/                  App icons (SVG, PNG, Windows .ico)
├── tools/
│   ├── build.mjs           Makes "E-Diary (single file).html" (node tools/build.mjs)
│   └── windows/*.ps1       Used by the Windows .bat launchers
├── Start/Create/Host …     Launchers for Windows (.bat), Mac (.command), Linux (.sh)
└── E-Diary (single file).html   Everything above inlined into one file (generated)
```

### 4.1 The one global object: `ED`

Every JS file is a self-contained function that adds its part to a single global object, `window.ED`:

```js
(function () {
  'use strict';
  const ED = window.ED, U = ED.util;
  ED.weather = { … };          // this file's public part
})();
```

| Name | Defined in | What it is |
|---|---|---|
| `ED.util` (usually `U`) | util.js | helper functions |
| `ED.store` | store.js | `ED.store.data` is **the whole diary** (one JS object); `ED.store.commit()` saves it |
| `ED.model` (usually `M`) | model.js | functions that read/change the diary |
| `ED.state` | app.js | what is on screen *right now* (tab, date, selected task…) — not saved |
| `ED.views.daily`, `.monthly`, `.roles`, `.goals`, `.mission`, `.career`, `.studyYear`, `.studyMonth`, `.studyWeek`, `.finance`, `.vault` | view-*.js, finance.js, vault.js | one object per section |
| `ED.study`, `ED.finance`, `ED.vault`, `ED.gcal`, `ED.charts`, `ED.xlsx`, `ED.cover` | study.js, finance.js, vault.js, gcal.js, charts.js, xlsx.js, cover.js | the newer sections and helpers |
| `ED.actions` | many files | click handlers, looked up by name |
| `ED.editors`, `ED.ui`, `ED.calpanel`, `ED.minical`, `ED.tasksUI`, `ED.settings`, `ED.sync`, … | | as named |

Plain `<script>` files (not ES modules) were chosen on purpose: ES modules are blocked when a page is opened straight from disk (`file://`), and the diary must work by double-click.

### 4.2 How a screen is drawn

1. Each view has `left()` and `right()` functions that **return HTML text** for the left and right page.
2. `ED.app.render()` puts that HTML into the pages, then calls the view's `mount()` for anything that needs live JavaScript (the rich-text editors, chart tooltips).
3. **Whenever data changes, the code calls `ED.store.commit()`** → the store saves (after a short pause) and tells the app to re-render.

So the rule for any feature is:

```
change ED.store.data  →  ED.store.commit()  →  screen redraws, data is saved
```

User text is always passed through `U.esc()` (or `U.sanitize()` for rich text) before going into HTML, to prevent script injection.

### 4.3 How clicks work (event delegation)

Buttons don't get their own listeners. They carry a `data-act` attribute:

```html
<button data-act="role-edit" data-id="role-frog">…</button>
```

One listener in `app.js` catches every click, finds the nearest `[data-act]`, and runs `ED.actions['role-edit'](element, event)`. Similar: `data-change="…"` → `ED.changes`, `<form data-form="…">` → `ED.forms`. Drag & drop uses `data-drag` / `data-drop` attributes.

### 4.4 Start-up sequence

`index.html` loads the scripts (`cover.js` shows the closed cover straight away) → `app.js start()` → builds the binder shell → `ED.store.init()` loads the diary (or creates the starter + examples on first run) → applies the theme → `render()` → the cover opens → starts reminders, file/gist sync and the Google Calendar link → registers `sw.js` (only when served over http/https).

### 4.5 Drag, drop and resize on the timelines

- **Task rows, all-day chips and month-grid items** use the browser's HTML5 drag & drop (`data-drag="task|event"` on the item, `data-drop="day|allday|time|master"` on the target; handled in `bindDnD()` in `app.js`).
- **Items on the hourly timelines** (`.tg-item[data-tg]`) use pointer events instead (`tgdrag.js`), because they must also work on touch screens and need live feedback: move in 15-minute steps, drag the bottom edge (`.tg-rs`) to resize, drop on the all-day strip to make an item all-day. On touch, a press-and-hold starts the drag.
- Moving one day of a repeating task/event detaches that day (`M.detach`, `M.moveEvent`); the toast offers **Every day** to apply the change to the whole series instead.

### 4.6 Charts

`charts.js` draws everything the progress pages show: `CH.columns` (done vs planned per period; `fine: true` for small quantities such as hours), `CH.pairs` (two series side by side), `CH.groups` (up to four series side by side), `CH.lines` (running totals with a crosshair; negative values, `marks` diamonds at the baseline, a `marker` line, `dash: true` series, and a shaded `range: {lo, hi, color, name}` such as a bad-to-good band), `CH.meters` (horizontal done/planned bars) and `CH.heat` (a calendar heatmap). A chart's `tools` option puts controls (such as a range switch) above the plot. Each chart returns HTML with a legend, a **Show the numbers** table, and marks carrying `data-tip`; `CH.bind(root)` adds the hover/focus tooltips. Colours come from CSS variables (`--s1`…`--s8`, `--accent`, `--chart-track`) defined for both themes in `tokens.css`.

### 4.7 Study progress and the financial plan (the maths)

- **Study:** a ticked session records `doneOn` (ticked before its day, on it or the next day → its planned day; later → the day it was ticked; editable; `ST.doneOn` also maps any stored date before the planned day to the planned day) and optionally `spent`. `ST.studied(day)` sums time spent by `doneOn`; `ST.planned(day)` sums planned minutes by date; *Plan covered* = planned minutes of ticked sessions ÷ all planned minutes; *Pace* compares that with the planned minutes dated before today. All study graphs are rebuilt on every change, so a tick shows at once.
- **Finance totals** (`FN.totals`): Received = income; Spent = expenses in non-saving categories; Put aside = expenses in categories with `saving: true`; Saved = Received − Spent; transfers are ignored. Amounts are summed and rounded to the paisa.
- **Finance Plan** (`ED.finplan.run()`): one row per financial year (April–March), starting with the current one. Salary grows by the yearly raise until the retirement age, then a pension (in today's money) takes over; living costs and "grows with inflation" entries rise by inflation; each goal is paid in its year at `cost × (1 + its price rise)^years`, or, with a loan, a down payment in that year plus EMIs (`pmt`) for the loan's years. Income tax: `FP.tax(gross, {mode, salaried, deductions, flat, k})` — FY 2026-27 new-regime slabs with the ₹75,000 standard deduction, the section 87A rebate up to ₹12 lakh taxable with marginal relief, surcharge with marginal relief, 4% cess; old regime and a flat rate as options; `k` raises the slabs when *Assume tax slabs rise with inflation* is on. Savings grow by the expected return on the opening balance plus half the year's saving, less tax on that growth. The monthly amount per goal is a SIP (`sipFor`, optional yearly step-up) that reaches the goal's cost (minus money already set aside, grown) by the middle of its year at the after-tax return; goals due this financial year are paid from this year's money instead. With `plan.retFrom = 'portfolio'` the expected return is the chosen approach's growth (`FP.retPct()`).
- **Wealth plan** (`ED.wealth`): six asset classes, each with a median yearly growth g and a volatility σ (defaults: index growth 2005–2025 as in typical Indian wealth reports; volatility = spread of calendar-year returns) and a fixed correlation matrix `RHO`. An approach's weights w give the mean return a = Σ wᵢ(gᵢ + σᵢ²/2) and σ² = ΣΣ wᵢwⱼσᵢσⱼρᵢⱼ; its yearly growth factor is lognormal with s² = ln(1 + σ²/(1+a)²), μ = ln(1+a) − s²/2, so the expected (median) growth is e^μ − 1. The chance of at least t a year over n years is 1 − Φ((ln(1+t) − μ)·√n/s) (`WL.chance`), a bad year in 20 is e^(μ − 1.645 s) − 1. `WL.path(R, retFn)` runs the plan's yearly surplus (+ saved, − drawn for goals) through the portfolio: the emergency fund (months × costs) sits in liquid funds and is topped up with inflation, money for the next three years' draws is parked in debt, the rest grows at `retFn(i)`, tax on growth as in the plan. `WL.simulate` repeats that for 1,000 random markets (seeded PRNG, so stable) and returns P10/P50/P90 per year and the share of runs that never go below zero. Today's value = FV ÷ (1 + discount)ⁿ (default 9%). No historical backtest is included.
- **Reading & writing list** (study planner): `plan.items` holds papers, patents, news, Employment News and items of your own categories (`plan.srcCats`); each category (`ST.SRC_CATS` or your own) has its field labels and a status list; statuses such as *Published*, *Granted*, *Read* or *Applied* count as finished. `ST.sources()` includes them, so sessions can point at a paper as they do at a book. A newer copy of the workbook keeps them.
- **Events & Meetings** (`ED.meetings`): Google events are read with `ED.gcal.readEvents(calId, from, to)` — through the connector's `list_events` inside Claude, or `GET /calendars/{id}/events?singleEvents=true` with the browser sign-in (scope `calendar.events` already allows reading) — and put into one shape by `GC.normEvent` (Google's all-day end date is the day after; the connector's flat `startTime`/`endTime`/`allDay` form is read too). The range read is the month shown plus the next three weeks; results are cached in `localStorage` (`e-diary-google-events-v1`, this browser only) for five minutes and for showing at once next time. Events whose Google id is in `gcal.map` under an `e:` key are the diary's own copies and are shown once, from the diary. A repeat of such an event (Google id `<id>_<date>T…`, `recurringEventId`) is matched too. Each read has a 30-second limit. After a refusal the page does not ask again by itself for five minutes (no retry loop). Meeting plans are stored in `meetings.notes`; an action item becomes a task with `M.addTask`, and ticking it closes that task.
- **Side tabs and pages** (`ED.GROUPS` in app.js): eight side tabs; a tab with several views shows them as `.subnav` buttons in the top bar; `ED.state.groupLast` remembers the page last used in each tab. Views are still separate `ED.views[id]`.
- **Eisenhower Matrix** (`ED.matrix`): looks at open/delegated one-off tasks (overdue and up to 60 days ahead), undated master tasks, and optionally the next open day of repeating tasks. Urgent = `date <= today + settings.matrix.days`; important = prio A/B (`settings.matrix.imp`) or `goalId`; delegated → box 3. A hand placement is stored on the task as `t.eis` ('do' | 'plan' | 'delegate' | 'drop') until "Back to automatic".
- **Exam Preparation** (`ED.exam`): topic status 0–3; `nextRev(t)` = `last + [1,3,7,15,30,60][rev]` days for topics done or revised; the exam day and the last date to apply are linked diary events (`eventId`, `applyEventId`) through `FX.linkEvent`.
- **Mind Maps** (`ED.mindmap`): nodes are a flat list with `parent`; first-level nodes carry `side` ('r'/'l', chosen by balance when added). Layout runs in `mount()`: nodes are rendered, measured (`width: max-content`, max 220px), placed as a two-sided tree, and joined by SVG curves; the view keeps the central idea fixed on screen across redraws. A node's `taskId` links it to a task; done = `node.done` or the task closed.
- **Govt Jobs** (`ED.jobs`): inside Claude the page reads the shared db document `jobs/feed` ({ fetchedAt, items, sources }) that a weekly scheduled task writes, and merges it into `data.jobs.items` by `id`, keeping the user's `status`, `mine` (notes) and `eventId`. Feed text is escaped when shown; links must be http(s). The list found on 10 Oct 2026 is built in (`SEED`, added once: `jobs.seeded`).
- **My websites** (`data.jobs.sites` [{id,name,url,what}]): added on the right page; inside Claude the page also writes names and links (no ids, nothing personal) to the db document `jobs/sources` ({ sites, updatedAt }) for the Monday task to search. Mind maps can be deleted from the left page ("Delete this map", action `mm-delmap`) or the ⋯ menu.
- **Study in the Planner:** `ST.dailyGroup(k)` (today: plus `ST.overdue(k)`, unticked sessions of the last 30 days), `CP.studyList(k)` in the week calendar's day lists (untimed sessions), and a per-day "📘 done/planned" line in the month grid.
- **Interview Prep** (`ED.interview`): practice picks a question at random, weighted new 5 : needs work 4 : ready 1, times up to 3 for questions not practised lately; *Got it* marks it ready, *Needs work* marks it 1; each answer adds to `interview.log[today]`. The readiness page divides the questions not yet ready by the days left to the next interview.
- **Health** (`ED.health`): a medicine is due on a day between `start` and `end` and on its weekdays, once per time in `times`; ticking *Taken* takes `perDose` off `stock` (unticking puts it back), and days of stock left = stock ÷ (perDose × times a day × days a week / 7). Medicines with `remind` ring through `ED.reminders.check` (a hook calls `ED.health.remind`). Interviews and appointments with *Show it in my calendar* keep a diary event in step (`ED.fx.linkEvent`), so they appear on the calendars, ring a reminder and go to Google Calendar like any event.
- **Habits** (`ED.habits`): a habit is due on a day when the day is on or after `start`, before `stop`, and its weekday is in `days` (null = every day). A day's or month's score counts fully = 1 and partly = ½ over the due habits up to today; a streak counts due days in a row marked fully or partly, ending today (or yesterday while today is unmarked).

---

### Added in 1.14
| File | What it does |
|---|---|
| `js/purchases.js` | Grocery lists and Wardrobe "To buy" → Finance → Bills "Planned purchases" (computed, never stored), the grocery task `tk-groc-<list id>` (two-way: date, done, delete → `noPlan`), spending records `fr-pu-groc-<id>` / `fr-pu-ward-<id>` (`fixed` once you edit one). Runs `reconcile()` after every change. |
| `js/gdrive.js` | Google Drive sync: GIS token (scope `drive.file`, shared with Calendar), folder "E-Diary sync" (`appProperties.ediary=folder`), one copy per device (`ediary=dev`, `dev=<id>`). Each copy carries `merged: {device: stamp}`; the merge base for a peer is this device's copy the peer merged (`gd-mine:<stamp>`) combined with the peer's copy merged here last (`gd-base:<device>`). New devices adopt the newest copy. Tested with a fake Drive and randomised three-device runs. |
| `js/look.js` | Appearance: presets and choices → one `<style id="ed-look">` overriding colour variables and background patterns (SVG/CSS, no images); cached in localStorage for the closed cover. |
| `js/mobile.js`, `css/mobile.css` | Phone layout (`html.ed-mobile`): bottom bar, + button, swipe, More sheet; start-up links `?new=task`, `?go=groceries|bills|today`, share target `?title&text&url`. |
| `tools/pi/install.sh`, `update.sh` | Raspberry Pi hosting through Tailscale (`tailscale serve --bg /opt/e-diary`). |
| `js/store.js` (changed) | Saves under a Web Lock (`e-diary-save`) with a revision number in IndexedDB; a window that finds another window's newer save merges it (`mergeOtherWindow`). |

## 5. Where the data is stored

### 5.1 Main copy — inside the browser

| Storage | Name / key | Contents |
|---|---|---|
| **IndexedDB** (preferred) | database `e-diary`, store `kv`, key `db` | the whole diary object (or, when the diary is password-locked, its encrypted envelope — see 5.2a) |
| | keys `snap:YYYY-MM-DD` | automatic daily snapshots (last 7) |
| | `file-handle`, `file-base`, `gist-base` | linked-file handle and last-synced copies used for merging |
| **localStorage** (fallback) | `e-diary-db-v1` | the diary as JSON text (≈5 MB limit) |
| localStorage (small extras) | `e-diary-weather-v1`, `e-diary-fired-v1`, `e-diary-gist-v1`, `e-diary-cover` | weather cache, reminders already shown, GitHub sync settings (token stays only here, never in backups), the title shown on the closed cover |
| sessionStorage | `e-diary-gcal-token` | the one-hour Google access token (gone when the browser closes; never saved in the diary) |

Browser storage is **per browser and per address**. Chrome, Edge and Firefox each keep a separate copy; `file:///…/index.html` and `https://you.github.io/e-diary/` are also separate. Clearing "site data" deletes it — hence the backups.

On disk, the browser keeps these inside its profile folder (e.g. `%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\IndexedDB` on Windows, `~/Library/Application Support/Google/Chrome/Default/IndexedDB` on Mac, `~/.config/google-chrome/Default/IndexedDB` on Linux). Don't edit them by hand; use Export/Import.

### 5.2 Optional copies

| Option | Where | Format |
|---|---|---|
| Export backup | a `.json` file the user downloads | `{ "app": "E-Diary", "format": 1, "exportedAt": …, "data": { …diary… } }` |
| Export tasks | `.csv` (opens in Excel) | one row per task |
| Linked diary file (Chrome/Edge) | a `.json` file the user chooses, e.g. in OneDrive/Google Drive | same as backup; rewritten after each change |
| GitHub gist sync | a *secret* gist in the user's GitHub account, file `e-diary.json` | AES-256-GCM encrypted (key from the user's passphrase with PBKDF2, 250,000 rounds) |
| Copy published on claude.ai | the user's private area of the Claude artifact store | same object, split into ≤60,000-character pieces |

When the diary is password-locked, every one of these (except the CSV) holds the encrypted envelope instead.

### 5.2a The password lock (`js/lock.js`)

- Key: `PBKDF2-SHA256(password, random 16-byte salt, 600,000 rounds)` → AES-256-GCM key, non-extractable, kept only in `ED.lock.key` while the diary is open. The password is never stored; a wrong password fails GCM authentication.
- Envelope: `{ __lock: { v: 1, kdf: 'PBKDF2-SHA256', iter, salt, hint, at }, tasks: { iv, ct }, events: { iv, ct }, … }` — each top-level section sealed separately with a fresh 12-byte IV. A section whose JSON has not changed reuses its last ciphertext (`ED.lock.cache`), so the Claude store only rewrites changed pieces.
- `store.init()` sees an envelope and awaits `ED.lock.startUnlock()` (the lock screen) before anything is drawn. `store.save()` writes `ED.lock.seal(data)`; snapshots, `file-base`/`gist-base` (`ED.lock.idbPut/idbGet`), the diary file and backups (`store.exportPayload()` / `store.openImport()`) and GitHub sync (`enc: 'diary-lock'`) are sealed the same way. The Events page keeps no localStorage copy of Google events while locked. The Claude adapter deletes the documents of sections no longer saved, so no plain copy remains after locking.
- `ED.lock.enable / change / disable` re-seal (or open) the stored copies; `lockNow()` saves and reloads to the lock screen; `settings.lockAfter` minutes of no input locks it automatically.

When two copies both changed (two computers), `sync.js` does a **three-way merge**: it compares each item (task, note, goal, diary day…) with the last copy both sides agreed on, keeps edits from both sides, lets the later edit win if the same item changed on both, and carries deletions across.

### 5.3 What the diary object looks like

```js
{
  meta:       { schema: 1, createdAt, updatedAt, sampleDayNotes: [], sampleMission },
  settings:   { diaryTitle, ownerName, theme, weekStart, h12, carryForward, carryDays,
                dayStart, activeFrom, activeTo, defaultPrio, weather: {name, lat, lon, unit, on},
                builtinQuotes, reminders, sound, cal: {monthly, roles, goals}, sampleBanner },
  tasks:      [ { id, title, prio:'A'|'B'|'C'|'D', num, status, date:'YYYY-MM-DD'|null, time:'HH:MM'|null,
                  dur, startDate, roleId, categoryId, goalId, parentId, eventId, showSub,
                  notes /*HTML*/, checklist:[{id,text,done}], repeat:{freq, interval, days, until}|null,
                  occ:{ 'YYYY-MM-DD': {st} } /*status per day for repeating tasks*/, exdates:[],
                  alarm, alarmBefore, delegatedTo, fwdFrom, createdAt, updatedAt } ],
  events:     [ { id, title, date, allDay, start, end, color, repeat, exdates, location, notes, reminder } ],
  categories: [ { id, name, color, icon } ],
  roles:      [ { id, name, icon, color, desc, order } ],
  goals:      [ { id, title, desc, valueId, roleId, color, startDate, due, done, doneAt } ],
  values:     [ { id, title, color, desc, order } ],
  dayNotes:   { 'YYYY-MM-DD': '<p>diary html</p>' },
  mission:    { html, size },
  notebooks:  [ { id, name, icon } ],
  notes:      [ { id, notebookId, title, html, done, pinned, createdAt, updatedAt } ],
  quotes:     [ { text, author } ],

  study: {                                   // study planner (study.js)
    plan: { id, title, subtitle, start, end, hoursPerWeek, source, importedAt,
            tracks:  [ { id, name, short, day /*0-6, -1 = every day*/, slot, color } ],
            weeks:   [ { n, start, label, phase, note, themes: { trackId: 'topic' } } ],
            notes:   [ { h, text } ], howto: [ '…' ],
            slots:   [ { no, name, time: 'HH:MM'|'', min /*usual length*/ } ],      // any number of slots a day
            books:   [ { id, kind:'book', track, trackId, title, use, access, where } ],
            lectures:[ { id, kind:'lecture', … } ],
            topics:  [ { id, trackId, name } ] } | null,                          // extra topics offered in the editor
    sessions: [ { id, week, date, slot, slotNo, kind, trackId, min /*planned*/, topic,
                  sourceId /*book or lecture*/, source /*chapter, task*/,
                  done, doneAt, doneOn /*day actually studied*/, spent /*minutes actually studied; null = as planned*/,
                  time /*own start time*/, note, own /*added in the diary*/, updatedAt } ]
  },
  finance: {                                 // finance.js — amounts are plain numbers in settings.currency
    cats:     [ { id, name, kind:'expense'|'income', saving /*true: put aside, not spent*/, icon, budget /*per month*/, order } ],
    records:  [ { id, date, type:'expense'|'income'|'transfer', amount, categoryId, accountId /*from*/, toAccountId /*transfers*/, desc, notes, billId } ],
    bills:    [ { id, name, amount, dueDay, categoryId, accountId, active, paid: { 'YYYY-MM': recordId } } ],
    goals:    [ { id, name, target, saved, due, notes } ],
    accounts: [ { id, name, type, institution, last4, opening, notes } ],
    holdings: [ { id, name, type, institution, ref, amount, value, premium, frequency, start, due, notes } ],
    plan: {                                   // finplan.js — all money in today's rupees, rates in % a year
      age, retireAge, years, income /*monthly gross*/, raise, otherIncome, pension, expenses /*monthly*/, inflation,
      retireSpend /*% of costs after retiring*/, emergencyMonths, savings, ret, retTax, stepUp,
      taxMode:'new'|'old'|'flat', flatRate, deductions, indexSlabs,
      goals:  [ { id, type, name, cost, year, inflation, saved, every /*years*/, times, loanPct, loanRate, loanYears, notes } ],
      events: [ { id, name, kind:'in'|'out', amount /*a year*/, from, years, grow:'inflation'|'none'|'custom', rate, taxable } ],
      retFrom: 'own'|'portfolio',
      wealth: { approach:'conservative'|'balanced'|'aggressive'|'custom', compare, custom: { eqL, eqM, debt, gold, arb, cash /*% weights*/ } | null,
                assets: { <assetKey>: { ret, vol } } | null /*own assumptions*/, amount /*null = savings*/, discount, sip /*null = monthly surplus*/, sipStep }
    }
  },
  habits: { list: [ { id, name, icon, days: [0-6] | null, start, stop, notes, order } ],      // habit tracker (habits.js)
            log:  { 'YYYY-MM-DD': { <habitId>: 'full' | 'part' } } },                        // no entry = not yet done
  interview: { list:  [ { id, role, org, ref, date, time, mode, venue, stage, notes, eventId } ],   // interview.js
               qs:    [ { id, cat, q, a, level: 0|1|2, last, tries, star, forId } ], cats: [ 'own category' ],
               docs:  [ { id, text, done } ], mocks: [ { id, date, with, focus, score, notes } ],
               log:   { 'YYYY-MM-DD': questions practised } },
  health: { card: { blood, allergies, conditions, contact, doctor, insurance, notes },            // health.js
            meds: [ { id, name, dose, form, times: ['HH:MM'], days, food, start, end, purpose, doctor, stock, perDose /*0 = not counted*/, remind, notes,
                      stockDay, stockUsed0 } ],   // left = stock − (units ticked Taken since stockDay − stockUsed0): worked out from the ticks, so two devices add up
            taken: { 'YYYY-MM-DD': { '<medId>@HH:MM': 'taken' | 'skipped' } },
            treats: [ { id, name, kind, doctor, place, start, end, status, next, notes } ],
            visits: [ { id, date, time, doctor, place, purpose, outcome, next, cost, eventId } ],
            vitals: [ { id, date, time, sys, dia, pulse, fbs, ppbs, rbs, weight, temp, spo2, notes } ],
            reports: [ { id, date, test, result, lab, link, notes } ] },
  meetings: { cals: ['primary', …], calInfo: { <calId>: { name, color } },                          // meetings.js
              notes: { 'g:<googleEventId>' | 'e:<eventId>' | 'e:<repeatingEventId>@YYYY-MM-DD': { title, date, agenda, attendees, notes, decisions,
                       actions: [ { id, text, who, due, done, taskId } ], updatedAt } } },
  exam: { list: [ { id, name, body, date, time, apply, admit, result, centre, link, status, target, notes, eventId, applyEventId } ],   // exam.js
          topics: [ { id, examId, subj, name, st: 0..3, rev, last, weak, notes } ], mocks: [ { id, examId, date, name, score, max, mins, notes } ],
          log: { 'YYYY-MM-DD': minutes } },
  maps: { list: [ { id, title, nodes: [ { id, parent, text, side, color, done, due, notes, collapsed, taskId } ], createdAt, updatedAt } ] },   // mindmap.js
  jobs: { items: [ { id, org, post, level, mode, area, location, lastDate, published, eligibility, vacancies, link, source, verified, notes,
                     from: 'feed'|'me', seen, fresh, status: ''|'interested'|'applied'|'no', mine, eventId } ], fetchedAt, seeded, sources },   // jobs.js
  sites: [ { id, name, url, category, notes, pinned } ],      // important websites (not secret)
  vault: { v, salt, iter, check: {iv, ct}, hint, items: [ { id, iv, ct, updatedAt } ] } | null,  // password log, encrypted
  gcal:  { map: { 't:<taskId>' | 'e:<eventId>' | 's:<sessionId>': { id /*Google event id*/, h /*hash*/, cal, s /*shape*/, one /*copied by hand*/ } } }
}
```

Tasks also have `allDay: true|false` (an all-day task has no `time`). Settings gained `cover`, `currency`, `vaultLock` (minutes) and `gcal: { on, clientId, calendarId, email, tasks, untimed, events, holidays, study, offer, auto }`.

Key ideas:
- **A task with `date: null` is a Master (undated) task.**
- **Repeating tasks are stored once.** `model.js → M.occurs()` decides if a rule falls on a day; each day's tick is kept in `occ`. Skipped days go into `exdates`.
- Status values: `open` (Normal), `progress`, `done`, `forwarded`, `delegated`, `cancelled`.
- Older diaries are upgraded on load by `store.migrate()`, which fills in any missing fields with defaults.

---

## 6. Editing the code

### 6.1 Tools you need

- **Any text editor.** Recommended: **Visual Studio Code** (free, Windows/Mac/Linux).
- **A browser** — Chrome or Edge have the best developer tools (press **F12**).
- **Optional:** Node.js (only to rebuild the single-file copy), Git (to keep versions / publish to GitHub).

### 6.2 The edit loop

1. Open the `E-Diary` folder in VS Code.
2. Open `index.html` in Chrome (or run a Host script and open `http://localhost:8080`).
3. Edit a `.css` or `.js` file, save, press **Ctrl+R** / **Cmd+R** in the browser.
4. Check the **Console** tab (F12) for errors.
5. When done:
   - run `node tools/build.mjs` if you also use the single-file copy;
   - if the app is hosted, **increase `VERSION` in `sw.js`** (e.g. `'e-diary-1.0.1'`) so installed copies download the new files;
   - if you **added a new file**, add a `<script>`/`<link>` line in `index.html` and its path to the `ASSETS` list in `sw.js` (the build script warns if you forget).

> Tip: while developing over http, tick **"Update on reload"** in DevTools → Application → Service Workers, otherwise the old cached files may be shown.

### 6.3 Common changes — where to look

| I want to… | Edit |
|---|---|
| Change colours or the dark theme | `css/tokens.css` (the variables at the top; dark values appear twice — change both) |
| Change the leather, rings or tabs | `css/binder.css` |
| Rename a section tab | `SECTIONS` at the top of `js/app.js` |
| Change starter roles / categories | `S.roles()` / `S.categories()` in `js/sample.js` (affects **new** diaries only) |
| Remove or change the example entries | `S.addDemo()` in `js/sample.js` |
| Change a default setting (week start, weather city, 24-hour clock…) | `S.settings()` in `js/sample.js` |
| Add quotes | the `Q` list in `js/quotes.js` |
| Change task statuses or priority letters | `M.STATUSES`, `M.PRIOS` in `js/model.js` (also the icons in `js/tasksui.js`) |
| Change how a task row looks | `TU.row()` in `js/tasksui.js` + `.trow` styles in `css/views.css` |
| Add a field to the task editor | `Ed.task()` in `js/editors.js`: add the input in `body`, read it in `collect()`; add a default in `M.newTask()` (`js/model.js`) |
| Change the daily page layout | `js/view-daily.js` + the DAILY part of `css/views.css` |
| Add holidays for another year | `SETS` in `js/holidays.js` |
| Change the weather provider | `js/weather.js` (`refresh()` and `searchCity()`) |
| Read a different study-plan layout from Excel | `ST.fromSheets()` in `js/study.js` (column names are matched in `findCol` lists) |
| Change finance categories for new diaries | `S.financeCats()` in `js/sample.js`; the keyword guesses are `GUESS` in `js/finance.js` |
| Change what goes to Google Calendar | `GC.desired()` in `js/gcal.js` |
| Change the cover or the page-turn | `js/cover.js` + `css/diary.css` (turn off for everyone: remove the `beginTurn` call in `app.js render()`) |
| Change the password generator or auto-lock | `V.generate()` and the auto-lock timer in `js/vault.js` |

### 6.4 Example: add a "Location" field to tasks

1. **Default value** — `js/model.js`, in `M.newTask`: add `location: '',`
2. **Input** — `js/editors.js`, in `Ed.task` where the right-hand column rows are built, add:
   ```js
   row('Location', '<input id="' + P + '-loc" class="field" value="' + e(draft.location || '') + '">') +
   ```
3. **Save it** — in `collect()` add: `f.location = val('loc').trim();`
4. **Show it** — `js/tasksui.js`, in `TU.meta()`:
   ```js
   if (t.location) bits.push('<span class="tm">📍 ' + e(t.location) + '</span>');
   ```
5. Reload. Existing tasks simply have no location until edited — no migration needed.

### 6.5 Example: add a new section tab

1. Create `js/view-yourtab.js`:
   ```js
   (function () {
     const ED = window.ED;
     ED.views.yourtab = {
       id: 'yourtab', label: 'Your Tab',
       left()  { return '<h2 class="pg-title">Your Tab</h2>'; },
       right() { return ''; },
     };
   })();
   ```
2. Add `<script src="js/view-yourtab.js"></script>` in `index.html` **before** `app.js`, and the path to `ASSETS` in `sw.js`.
3. Add `{ id: 'yourtab', label: 'Your Tab' }` to `SECTIONS` in `js/app.js`, and a tab colour in `css/binder.css`:
   ```css
   .tab[data-sec="yourtab"] { --t1: #6a1b9a; --t2: #9c4dcc; }
   ```

### 6.6 Rules to keep the code healthy

- Always change data through `ED.store.data` and finish with `ED.store.commit()`.
- Before a destructive change, call `ED.store.checkpoint('What')` and show `ED.ui.undoToast('…')` so the user can undo.
- Never put user text into HTML without `U.esc()` (plain text) or `U.sanitize()` (rich text).
- Dates are strings `'YYYY-MM-DD'` in local time. Use `U.addDays`, `U.diffDays`, `U.today()` — not raw `Date` arithmetic.
- Don't use `alert()`, `confirm()` or `prompt()`; use `ED.ui.confirm()` / `ED.ui.prompt()` (they also work inside embedded pages).
- Keep new colours in `tokens.css` so light and dark themes both work.

---

## 7. Testing a change

There is no automated test runner in the package; test by hand in the browser:

1. Add, tick, edit, forward and delete a task; add a repeating task and check it on another day.
2. Open each of the twelve tabs; switch to Dark theme (top bar) and back.
3. Drag a timed task on the Daily timeline to another hour, resize it, drop it on *All day events*, and drag it back. Without Google linked, an *Add to Google Calendar* offer appears.
4. Study Year → Plan → Import your Excel file; tick a session on Study Week & Day, type a time spent, and see *Hours studied each day* and *Progress through the plan* change. Plan settings → add a slot; Plan → Add to the schedule.
5. Finance: add a record and a transfer, tick a bill as paid, set a budget; check Saved = Received − Spent. Finance Plan: add a goal with a loan, open *Year by year*. Passwords: create the log, add a login, lock, unlock.
6. Narrow the window to phone width.
7. **Settings → Backup & Sync → Export**, then **Import** the file, to be sure data still round-trips.
8. F12 → Console shows no red errors.

---

## 8. Security and privacy notes

- No data leaves the browser unless the user turns on the file link or GitHub sync; weather requests send only the city's coordinates to Open-Meteo.
- The GitHub token and passphrase are kept only in that browser's localStorage and are never included in backups or the gist.
- Rich text is sanitised (tags and CSS properties are allow-listed) on load, paste and save.
- The PowerShell server only serves files inside the E-Diary folder (path traversal is blocked) and listens on localhost unless you allow network access.
- **Password log:** each entry is encrypted separately with AES-256-GCM; the key comes from the master password through PBKDF2-SHA-256 with 310,000 rounds and a random salt. Only ciphertext is saved, exported, synced or stored in the Claude copy. The key lives in memory while the log is unlocked and is dropped on Lock, after the idle time (default 5 minutes), when the tab is hidden that long, and when the diary is closed. A forgotten master password cannot be recovered. *Export logins* writes plain text on purpose (for moving to a password manager) and warns first.
- **Google Calendar:** sign-in happens in Google's own window (Google Identity Services); the diary only receives a one-hour access token with the `calendar.events` and `calendar.calendarlist.readonly` scopes, kept in sessionStorage. Only items the user chose (dated tasks, events, timed study sessions) are sent, directly from the browser to Google. The OAuth Client ID is public by design and is only usable from the web addresses listed in its *Authorized JavaScript origins*. Inside Claude, calls go through the user's own Google Calendar connector with the user's consent; the page never sees a token, and the artifact declares only the four calendar tools it uses.
- Finance accounts keep only the last four digits of an account or card number; full numbers belong in the encrypted password log.

---

## 9. Glossary

- **PWA (Progressive Web App):** a website that can be installed and run offline, thanks to `manifest.webmanifest` + `sw.js`.
- **Service worker:** a background script (`sw.js`) that caches the app files.
- **IndexedDB / localStorage:** storage built into every browser.
- **Occurrence:** one day of a (possibly repeating) task — `{ t: task, k: date, st: status }` in `model.js`.
- **Carry-forward:** unfinished non-repeating tasks from the last 30 days (configurable) are shown on today's page.
- **Three-way merge:** combining two edited copies using the last common copy as reference.


### Jobs folder (v1.8.2, computer copy)
`ED.jobs.dir` keeps a File System Access directory handle (IndexedDB key `jobs-dir`). `ED.jobs.dirInit()` runs at start-up (app.js, after gcal) and reads the newest `e-diary-jobs-feed*.json` (by its `fetchedAt`, else file date) through `JB.merge`; the Jobs page re-reads at most every 10 minutes. `JB.dirWriteSites()` writes `e-diary-my-websites.json` ({ sites:[{name,url,what}], updatedAt }) on link and on every website add/remove. The weekly scheduled task writes the feed into the Drive folder "E-Diary Jobs" (one dated file per run, keeps the two newest) and also into the artifact db doc `jobs/feed`. Not encrypted by the diary lock: it holds only public job notices and URLs.

### Several study plans (v1.9)
`data.study = { plan, sessions, shelf }` — `plan`/`sessions` are the plan shown (every study function still reads only these), `shelf` = [{ id (plan id), plan, sessions, savedAt, updatedAt }] holds the others. `ST.stash()` moves the shown plan to the shelf, `ST.switchTo(id)` swaps, `ST.myPlans()` is the list dialog, `ST.dropShelved(id)` deletes a saved one. Import (`choices: add | new`) and `ST.newPlan` (`keep | replace`) can keep the current plan; delete promotes the newest shelved plan. Sync merges `shelf` item by item (`nested('study', ['sessions','shelf'])`); store migration adds `shelf: []`.
`ST.setWeeks(n, copy)` changes the length at the end: fewer weeks drop those weeks' sessions; more weeks append week objects (and, with `copy`, clones of the last week's sessions marked `own`). It updates `plan.end`, `hoursPerWeek` and the "N weeks / hours" parts of the subtitle. Dialog: `ST.editWeeks()` (Plan menu → Number of weeks).

### v1.10
- **Drive file saving** (sync.js): `settings.fileAuto` (default on) gates the debounced write after each save; `settings.fileAsk` (default on) adds a `beforeunload` prompt when `file.unsaved()` (lastWrite < meta.updatedAt or busy) and starts a write; Ctrl/Cmd+S calls `file.write()`. Switches `#sf-auto` / `#sf-ask` in Settings → Backup & Sync when a file is linked.
- **Bucket list** (js/bucket.js, view `bucket`, Planner group): `data.bucket.list[{ id, title, cat, status dream|planned|doing|done, target 'YYYY'|date, cost, why, steps[{id,text,done,taskId}], notes, doneOn }]`; steps → `M.addTask`; `mount()` ticks steps whose task is closed. Sync: `nested('bucket', ['list'])`.
- **Website categories** (vault.js): `data.siteCats[{ id, name, subs[], updatedAt }]`, built from the old fixed list on first use (`WCATS()`); sites gain `sub`. Manager dialog `site-cats`; new names typed in the site form are learned (`learnCat`). Sync: mergeList on `siteCats`.
- **Medicines** (health.js): `med.every` (1 = daily, 2 = alternate days, n = once in n days from `start`), used in `active()` and in `daysLeft`.
- **Password log** (vault.js): `vault.fails` counts wrong master passwords (synced with the vault); at 3 `V.wipe()` sets `data.vault = null`, drops undo checkpoints holding a vault and clears `vault` from `snap:*` snapshots. `vault.wipeAfter = 0` turns it off (⋯ menu). sync.js now keeps a vault deleted on one side deleted (`vl === null`).

### v1.11
- **One PC at a time** (sync.js): the file payload carries `owner: { id, name, at }` (device from localStorage `e-diary-device`). `file.acquire(force)` reads the file; a fresh owner (< 6 min) on another device → `goReadOnly()` (file data applied, `roSnap` kept, any non-silent commit reverted, red `#ed-ro-bar`, `checkFree()` every minute). Otherwise the file is master: applied as is, unless `store.loadedStamp` > `e-diary-file-stamp` (unsaved edits from the last session on this PC) → `reconcile()` merge. Holder heartbeats every 2 min; `stillMine()` before each write notices a take-over; `release()` on pagehide, unlink, or Settings → Release.
- **Weekly / Yearly** (js/horizons.js; views `weekly`, `yearly`): undated tasks with `lvl: 'year'|'week'` (+ `planY` / `planW`); month tasks are ordinary master tasks with `planM`. `HZ.schedule(t, lvl, key)` adds the copy (`fromPlan`) and sets `t.schedTo = { lvl, key, id }`; `HZ.eff()` follows copies down for status; `HZ.unschedule()` removes copies; `HZ.tidy()` frees items whose copy was deleted. `M.idx()` puts year/week items and scheduled undated tasks in `plan` (not `master`); `M.goalTasks` skips scheduled items; the Eisenhower matrix skips them.
- **Wardrobe** (js/wardrobe.js, Notes & Life mode `wardrobe`): `data.wardrobe = { items, wish, plan, budget }`; sync `nested('wardrobe', ['items','wish'], { plan: 1 })`.
