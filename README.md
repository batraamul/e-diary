# E-Diary Planner

A leather-bound personal planner that runs on your own computer: prioritised daily tasks (A1, B2, C3…), a habit tracker, an events and meetings calendar with your Google events, interview preparation, health and medicines, life roles, goals and achievements, a mission statement with values, career notes and progress graphs, a study planner that reads your Excel study plan, financial planning and records, an encrypted password log, and a diary page for every day. It can also copy your dated plans into Google Calendar.

It works offline, needs no installation or account, and your entries stay on your computer. The same folder can also be put on a free website so you can use it from any device.

---

## 1. Open it on your computer

### Windows 10 / 11
1. Unzip the folder to a place you will keep, for example `Documents\E-Diary`.
2. Double-click **`Start E-Diary (Windows).bat`**. The diary opens in its own Microsoft Edge window, like an app.
3. For an icon on the Desktop and in the Start menu, double-click **`Create Desktop Shortcut (Windows).bat`** once. Right-click the Start-menu entry to pin it to the taskbar.

If Windows shows "Windows protected your PC", click **More info → Run anyway** (the scripts only open the diary).

### Mac
1. Unzip the folder and move it to `Documents`.
2. Double-click **`Create Mac App (Mac).command`** once. The first time, macOS may refuse because the file was downloaded: right-click it, choose **Open**, then **Open** again.
3. It creates **E-Diary.app** in your home Applications folder. Drag it to the Dock. It opens the diary in its own Chrome, Edge or Brave window (or Safari if none of those is installed).

You can also double-click **`Start E-Diary (Mac).command`** directly.

### Linux
Run **`./"Start E-Diary (Linux).sh"`** (or double-click it and choose *Run*). It opens in its own Chrome, Chromium, Edge or Brave window, otherwise in your default browser.

### Any computer, any browser
Double-click **`index.html`**, or the all-in-one **`E-Diary (single file).html`**. Chrome, Edge, Safari and Firefox all work.

> **Where is my diary saved?** Inside the browser that opens it, on this computer. Use the same launcher or browser each time. Export a backup now and then (see section 4).

---

## 2. Put it on a free website (use it from anywhere)

The diary is a static web app: no server code, no database. Any free static host works.

**GitHub Pages** (free, permanent address)
1. Create a free account at github.com and click **New repository** (for example `e-diary`, Public).
2. Click **Add file → Upload files**, drag in everything *inside* the diary folder (not the zip), and click **Commit changes**.
3. Open **Settings → Pages**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, and **Save**.
4. After a minute your diary is at `https://YOUR-NAME.github.io/e-diary/`.

**Netlify Drop** (fastest)
Go to <https://app.netlify.com/drop> and drag the diary folder onto the page. You get a link immediately; sign up to keep it.

**Cloudflare Pages, your office intranet, or any web server**
Upload the folder as plain files.

### Install it like an app from the website
- **Chrome / Edge (Windows, Mac):** open your diary's address and click the install icon in the address bar (or ⋮ → *Cast, save and share → Install page as app*). It then opens in its own window and works offline.
- **iPhone / iPad:** Safari → Share → **Add to Home Screen**.
- **Android:** Chrome → ⋮ → **Install app** (or *Add to Home screen*).

> **Sharing the link is safe.** The website only delivers the app. Every person's diary is kept in their own browser; nothing is uploaded to the website. Never upload your *backup file* to a public repository.

### Host it on your own computer (home or office network)
- **Windows:** double-click **`Host on this computer (Windows).bat`**. It serves the diary at `http://localhost:8080` and, if you allow it, at your PC's network address for other devices. Keep the window open while it is in use.
- **Mac:** double-click **`Host on this computer (Mac).command`** (uses the Mac's built-in Python or Ruby).
- **Linux:** run **`./"Host on this computer (Linux).sh"`** (uses Python 3), or copy the folder into any Nginx/Apache web root.

---

## 3. Using the diary

The side tabs hold related pages together; the pages of the open tab are the buttons in the top bar (each tab reopens the page you last used; keys 1–8 open the tabs):

| Side tab | Pages inside |
|---|---|
| **Planner** | Daily Tasks · Monthly Tasks · Events & Meetings · **Eisenhower Matrix** |
| **Purpose** | Roles · Goals · Mission |
| **Notes & Life** | Notes · Progress · Travel & Tour · Grocery · Weekly meals |
| **Study** | Year · Month · Week & Day · **Mind Maps** · **Govt Jobs** |
| **Finance** | Money · Financial Plan |
| **Interview & Exams** | Interviews · **Exam Preparation** |
| **Health**, **Passwords** | one page each |

| Page | What it does |
|---|---|
| **Eisenhower Matrix** (Planner) | Your open tasks sorted automatically into four boxes: **1 Do first** (urgent & important), **2 Schedule** (important, not urgent), **3 Delegate** (urgent, not important) and **4 Eliminate / later**. *Urgent* = due within 2 days or overdue; *important* = priority A or B, or linked to a goal (change both with **Rules**). Drag a task to another box, or use its ⋯ menu to move it, give it a date or delegate it; tick it done right there. The left page is the urgent column, the right page the not-urgent one, so the two rows line up across the diary. |
| **Exam Preparation** (Interview & Exams) | Each exam with its key dates (last date to apply, admit card, exam day, result — the exam day and the last date to apply can go into your calendar), a countdown and the topics-a-day pace you need. **Syllabus**: paste the topics one per line under a subject; click a topic's status to move it on (not started → learning → done → revised). **Revision**: done topics come back for revision after 1, 3, 7, 15, 30 and 60 days. **Mock tests**: scores over time against your target. |
| **Mind Maps** (Study) | Plan a project, a paper or a topic as a mind map: the central idea in the middle, main branches to both sides in their own colours. Templates for a project plan, a research paper and a study topic. Keys on the map: **Tab** sub-idea, **Enter** idea beside, **F2** rename, **Space** done, **Delete** remove, arrows to move, Ctrl+↑/↓ reorder; drag an idea onto another to move it. Give an idea a due date and notes, and **Make it a task** (or tasks for every open end point of a branch) — ticking the task ticks the idea. Branches show how many end points are done. |
| **Govt Jobs** (Study) | Government of India openings at **Pay Level 13A / 14** (direct recruitment, deputation, lateral entry) in defence, intelligence, AI & deep tech and scientific organisations, with the last date counted down, eligibility, and a link to the official notice. Mark each **Interested / Applied / Not for me**, add notes, put the last date in your calendar, or track it in Interview Prep. In the copy inside Claude a weekly check (Mondays) refreshes the list automatically; elsewhere add jobs yourself or import a list. Always confirm the details in the official notice. **My websites**: add any careers page to watch; inside Claude the Monday check searches them too. Web-search links for NTRO, IB, ARC/DG Security, NATGRID/NSCS/DIA circulars are built in. |

**Study in the Planner:** the day's study sessions appear on Daily Tasks (today's page also lists sessions from the last 30 days that were not ticked), as a "📘 2/3 study" line on each day of the Monthly calendar, and in the day lists of the week calendar (sessions with a time are in the time grid).

| Tab | What it does |
|---|---|
| **Daily Tasks** | Big date page. Add tasks with a priority code, grouped by role (*FROG: To be tamed first*, *Smaller Frog*, *Do / Delegate or Schedule*…). Tick the circle to complete; right-click (or ⋯) to forward, delegate, move or cancel. Mini calendar, all-day events, hourly timeline with a “now” line, quote of the day, weather, and a lined **Daily Notes** page (with pictures). |
| **Monthly Tasks** | **Master Tasks** — things to do “some day” with no date — plus two month calendars and a calendar panel (1, 3, 5, 7 days or a month). Drag a task onto a day to schedule it. A **Habits** line shows how the month's habits are going, and the month calendar shows a dot per habit each day. Switch the left page to **Habit tracker** for the full month. |
| **Roles** | Your life roles with this week's progress and the next pending task. The ✋ button shows only that role in the calendar. Drag cards to reorder. |
| **Goals** | Goals with a due date, a value, and progress from their linked tasks. Tick the circle when a goal is achieved; it moves to **Achievements** with the date and total days. |
| **Mission** | Your personal mission statement (rich text and photos; Hindi/Devanagari works) and your **Values**, each with the progress of its goals. |
| **Notes & Life** (was Career Graph) | Notebooks of notes (career plans, milestones, ideas) and a **Progress** view: tasks done per week, completion rate, study hours, and a progress analysis by role, priority, weekday, category and goal (4, 12 or 26 weeks). |
| **Study Year** | Your study plan at a glance: share of the plan covered, hours actually studied, this week, pace against the plan, study streak. Graphs: **progress through the plan** (covered vs what the plan says, day by day, "so far" or the whole plan), **hours studied each day** (last four weeks and the week ahead), hours per plan week, a heat-map of every day, progress by subject and where your time went in the last 30 days. Also the weekly pattern, study slots, phases, the **track matrix** (subjects × weeks), **books & lectures** (add your own), **topics** per subject, and notes. |
| **Study Month** | A month calendar of study sessions (tick them right there), hours studied each day of the month, this month's hours by subject, and the plan weeks that fall in the month. |
| **Study Week & Day** | The week day by day (a small graph), its topics per subject, all seven days with their sessions, and the chosen day in detail: slot, subject, topic, book or lecture, **time spent**, a notes box, **Done** ticks, *Log study time*, *Mark the day done*. |
| **Finance** | Records of money received, spent and **transferred** between your own accounts (with a first guess at the category), a monthly budget per category, monthly bills you tick as paid, savings pots, accounts with balances, and policies/investments with renewal and maturity dates. Money put into savings and investments counts as **saved**, not spent. Graphs: received, spent and put aside for 12 months, the financial year so far, where the money went against the budget, share of income saved. |
| **Finance Plan** | A goal-based financial plan for the years ahead: your income, living costs, savings and age today, and goals in today's money — a house (with a loan), children's education, sightseeing, a computer, a car, a wedding, anything else — each with its own price rise. The plan adds pay rises, inflation, **income tax** (India new or old regime for FY 2026-27, or a flat rate such as 12%) and tax on investment growth, and shows a **year-by-year schedule** (earnings, tax, in-hand money, living costs, goals and EMIs, what is saved, savings at year end and in today's money), what each goal will cost when it is due, how much to invest each month, and guidance on managing the money. **Portfolio & risk** turns it into a wealth plan like a wealth manager's report: investment approaches (conservative, balanced, aggressive or your own mix of six asset classes), the underlying allocation, short-term cash-flow buckets and emergency corpus, compounding at the expected growth and ±2% with today's value, portfolio growth with your cash flows, what a SIP and a step-up add, and risk — the chance of 7% returns and of no loss, a bad year in 20, and a simulation of 1,000 possible markets giving the chance your money lasts and the likely, bad and good outcomes. |
| **Interview Prep** | Interviews coming up (post, organisation, date and time, venue or link, stage, a countdown; each can go into your calendar with a reminder), a **question bank** by category with your answer notes and how ready you are (new → needs work → ready), a **Practise** mode (one question at a time, the weakest first, a two-minute answer clock, *Show my notes*, *Got it* / *Needs work*), **Readiness** charts and a daily pace to the next interview, documents to carry, and mock interviews with scores. *Add common questions* gives twenty to start with. |
| **Health** | Health, medicine and treatment: today's medicines to tick **Taken** or **Skipped** (with a stock count that warns when to refill, and optional reminders at dose times), your medicines (dose, times, days, before/after food, what for), treatments and conditions with the next follow-up, **doctor's appointments** (can go into your calendar), **readings** — blood pressure, pulse, blood sugar, weight, temperature, SpO₂ — with charts, **reports** (lab tests, scans, with a link to the file) and a **medical card** to copy or show in an emergency. Kept in the diary like other entries (not in the encrypted password log); it is a record, not medical advice. |
| **Events & Meetings** | A separate event calendar with your **Google Calendar events** (read from Google — never changed from here) and the diary's own events: the next two weeks as an agenda, a month calendar, and for any event a **plan** — agenda, attendees, notes, decisions and **action items**, which can become diary tasks. Choose which Google calendars to show with the ⚙ button. |
| **Passwords** | A password log locked with your master password (encrypted on your device), with a generator, strength check, reused/old-password warnings and earlier passwords; plus a list of **important websites** grouped by type. |

**The task editor** (click a task) has: status (Normal, In Progress, Completed, Forwarded, Delegated, Cancelled), priority letter and number, due date and time, duration, start date, alarm, category (colours the title), repeating rule (daily, weekdays, weekly on chosen days, monthly, yearly, with an end date), role, goal, meeting (linked event), parent task and sub-list, and tabs for **Notes**, **Subtasks**, **Checklist** and **Sharing** (copy, e-mail, WhatsApp, calendar file `.ics`).

**Quick add:** type `A1 Call the bank @5:30pm` in *Add Task* to set the priority and time in one go.

**Drag to plan the day** (Daily page timeline and the week calendar):
- Drag a task from the list onto an hour to give it that time; drag it up or down to move it in 15-minute steps.
- Drag the **bottom edge** of a task or event to make it longer or shorter.
- Drop a task or event on **All day events** to make it all-day; drag it from there back onto an hour to give it a time again. (The task editor also has an *All Day* switch.)
- On a touch screen, press and hold an item for a moment, then drag.

**Study planner from your Excel file:** open *Study Year* → **Plan → Import plan from Excel or CSV** and choose your workbook (for example *Scientist-F_Study_Plan.xlsx*). The diary reads the Daily Plan sheet (one row per session: Week, Date, Slot, Track, Min, Topic, Source / task, Done), and also the Read Me notes and weekly pattern, the Weekly Overview (phases, week notes), the Track Matrix (topics per week) and the Books and Lectures sheets.
- **Tick a session** when you finish it, and type the **time spent** if it differs from the plan. The graphs count study on the day you did it: a session ticked ahead of its day counts on its planned day, one ticked a day late counts on its planned day, and one caught up later counts on the day you tick it. The Year, Month and Week & Day pages use the same weeks and the same figures, and moving to another month on the Month page moves Week & Day with it.
- **Slots:** **Plan → Plan settings** lists your study slots — add as many as you like, give each a name, a start time (so sessions show on the Daily timeline and in Google Calendar) and a usual length. **Plan → Add to the schedule** puts a slot or subject into many days at once (for example *Night revision* on weekdays until the end of the plan).
- **Books, lectures and topics:** add your own on *Study Year → Books & lectures* and *Topics*. The session editor offers them as drop-down lists (and *A new topic…* for anything else).
- **Papers, patents, news and more:** the same *Books & lectures* page also keeps **Papers (writing)**, **Papers (reading)**, **Patents (writing)**, **Patents (reading)**, **News** and **Employment News**, each with its own status list (for example *Drafting → Submitted → Under review → Accepted*, or *To check → Applied*), a date (target date, read-by date, last date to apply — overdue ones turn red), authors or source, journal or patent office, a link and notes. **Add a category** makes your own (things you read or things you write). They are offered in the session editor too.
- **Plan → Export progress** gives the Daily Plan sheet back as a .csv with Done, *Studied on* and *Time spent*. Importing a newer copy of the same workbook keeps your ticks, slot times, books, topics and the sessions you added in the diary.

**Finance:** add each amount you receive or spend (*Add record*; *Transfer* for money moved between your own accounts, such as a cash withdrawal), or import a bank statement (.csv or .xlsx — Debit/Credit columns, a Dr/Cr column or amounts marked Dr/Cr all work) from the ⋯ menu. Set a monthly budget on the *Budget* page; savings and investments have their own section. Tick *Bills* as paid each month. Keep only the last four digits of any account or card number here.

**Finance Plan:** click **Fill from my records** (or type your numbers under *Your numbers*), then add goals with the buttons (House, Child's education, Sightseeing, Computer…). Each goal takes its cost in today's money, the year you need it, its yearly price rise, anything already set aside, whether it repeats (a trip every 2 years, a new computer every 5), and an optional loan. The right-hand page shows the projection, the **Year by year** schedule (exportable to Excel) and **How to manage**. These are estimates from fixed rates — not financial advice.

**Wealth plan (Finance Plan → Portfolio & risk):** pick an approach with **Use this** (and **Compare** a second one), or **Change the weights** to make your own mix. *Return and risk assumptions* holds each asset class's expected growth and yearly swings — start from *Past 20 years* (index growth 2005–2025, as printed in typical Indian wealth reports) or *Cautious*, and change any figure. Tick *Use this approach's growth* to make the goal plan grow your savings at the portfolio's rate. The **Wealth report** tab on the right shows the chance the plan works, compounding (with your savings and goals, or a lump sum alone), the range of outcomes, the year-by-year table with money parked for goals due soon, the SIP effect and the risk table. Illustrations only; there is no past-performance backtest.

**Events & Meetings and Google:** inside Claude the page reads your Google Calendar through the same connector (it asks once to allow *list events*); in the downloaded copy it uses your Google sign-in (Client ID in Settings → Google Calendar) — click **Show my Google events**. Events are read for the month shown and the next three weeks, refreshed every few minutes while the page is open, and kept in this browser so the calendar appears at once next time. If Google refuses (for example *Insufficient scope*), the page says how to fix it and keeps showing what it read last. Events the diary itself sent to Google are shown once, as diary events.

**Habit tracker:** add a habit (Daily Tasks → ☰ → *Add a habit to track*, or Monthly Tasks → *Habit tracker* → **Add a habit**) with a symbol and the days it applies to (every day, or chosen weekdays). Each day it appears under **Habits** on the Daily Tasks page: mark it **fully achieved**, **partly achieved** or leave it **not yet done** (click the same choice again to clear it). The Monthly Tasks page shows the summary — kept this month (partly counts half), fully / partly / not yet counts and the best run — a dot per habit on each calendar day, and in *Habit tracker* the month grid (click a square: fully → partly → not yet), each habit's share and streak (🔥 days in a row), and a day-by-day chart. *Stop tracking* keeps a habit's history but stops asking from tomorrow.

**Passwords:** the first time, choose a master password (there is no way to recover it — write it down somewhere safe). The log locks itself after 5 idle minutes (change it in the ⋯ menu), when you click **Lock**, or when you close the diary with the book button at the top.

**The book:** the diary opens from its closed cover and pages turn when you move between days and sections. Turn the cover off in Settings → General; animations are skipped automatically if your computer is set to reduce motion.

**Planning the Franklin–Covey way**
- **A** = vital, **B** = important, **C** = nice to do, **D** = delegate or someday. Number tasks in the order you will do them.
- The *frog* is the hardest, most important task of the day. Do it first.
- Unfinished tasks roll forward to today (you can set how far back in Settings).
- Drag one task onto another to put it before or after; the numbers update.

**Keyboard:** `N` new task (new record on Finance, new login on Passwords) · `E` new event · `T` today · `←` `→` previous / next day, week or month · `1`–`9`, `0` the first ten tabs · `/` or `Ctrl K` search · `Space` tick the focused task · `Ctrl Enter` save an editor · `Esc` close · `?` help.

**First steps**
1. The diary opens with example entries so you can see how it works. Click **Clear examples** in the banner when you are ready.
2. Adjust your roles (Roles tab) and categories (Settings → Categories).
3. Settings → **Weather & Quotes**: pick your city (New Delhi is the default) and add your own quotes.
4. Settings → **Backup & Sync → Add India holidays** adds the central-government gazetted holidays for 2026 and 2027.

---

## 4. Keep your diary safe, and use it on more than one computer

Open **Backup & Sync** from the cloud icon at the top.

- **Export backup (.json)** saves everything (tasks, notes, goals, pictures, settings) to one file. **Import** restores it or moves the diary to another browser or computer. **Export tasks (.csv)** opens in Excel.
- **Automatic daily snapshots:** the diary keeps a copy of itself for each of the last 7 days you used it.
- **Keep the diary in Google Drive** (or OneDrive, Dropbox — Chrome or Edge on a computer; works with the single-file copy too):
  1. Install **Google Drive for desktop** (drive.google.com/download) and sign in; a *Google Drive* folder appears on your computer.
  2. **Backup & Sync → Save diary to a file…** and save `e-diary.json` in **Google Drive → My Drive**.
  3. Every change is written to the file within seconds and once more when you close the diary; Google Drive uploads it. When the diary opens it reads the file first (click **Open it** on the bar at the top — the browser asks once per visit, or never if you choose *Allow on every visit*). **Load the latest now** and **Save to it now** do it by hand.
  4. On another computer: install Google Drive for desktop, open the diary and choose **Open a diary file…** → the same file. Changes from both computers are merged item by item.
- **See my data** (Backup & Sync) shows everything the diary has stored, section by section, in readable form, and where it is kept.
- **Cloud sync with GitHub (optional, free):** syncs through a secret gist in your GitHub account and also works on phones. Create a *fine-grained* personal access token with only the **Gists: read and write** permission. Choose a passphrase: the diary is encrypted (AES-256) on your device before upload. Enter the same Gist ID and passphrase on each device.

> Each browser keeps its own copy of the diary. Clearing a browser's data erases that copy, so keep a backup or turn on one of the sync options.

### Lock the diary with a password

**Settings → Password lock** encrypts the whole diary with your password: this browser's copy, the daily snapshots, the Google Drive file, exported backups, GitHub sync and the copy in your Claude account. From then on the diary asks for the password every time it opens; the book button at the top locks it at once, and it locks itself after the minutes you choose (15 by default).

- **How it works:** AES-256-GCM encryption; the key is made from your password with PBKDF2-SHA256 (600,000 rounds) and is kept only in memory while the diary is open. The password is never stored anywhere.
- **How safe:** no lock is truly "unhackable" — the strength is your password. A sentence of five or more unusual words (e.g. *tamarind kite ledger monsoon brass*) is beyond guessing with today's computers; a name, date or short word is not. The lock does not protect the diary while it is open on your screen, or against a virus or keylogger on your computer.
- **There is no reset.** Forget the password and nobody can open the diary. Write it down somewhere safe, or keep an unlocked backup in a safe place. The lock screen's *Forgot the password?* can only start a new, empty diary.
- The password log keeps its own master password as before.

### See and understand the code

- **The single file** (`E-Diary (single file).html`) holds the whole app: open it in a text editor such as VS Code or Notepad++ (right-click → Open with). Each part starts with a comment like `/* js/finance.js */`, so you can jump between them. In Chrome or Edge, right-click the page → *View page source*, or press **F12 → Sources**.
- **The folder version** (in the zip) has the same code split into readable files: `js/` (one file per part, e.g. `js/health.js`), `css/` (the look), `index.html`. Start with `DEVELOPER-GUIDE.md`, which explains how it is organised, where data is stored and how to change it.
- **Your data:** Backup & Sync → **See my data**, or *Export backup* and open the `.json` file in any text editor. Developers can also look in the browser: **F12 → Application → IndexedDB → e-diary → kv → db** (when the diary is locked, this shows only scrambled text).

### Google Calendar (copies your plans to your phone)

**Settings → Google Calendar** links your Google account. After that, every task that has a time or is marked all-day, your diary events, and (if you choose) study sessions with a start time are copied into your Google calendar, and kept up to date as you drag, tick, edit or delete them in the diary — a drag reaches Google within a few seconds and the diary says *Sent to Google Calendar*. Changes made in Google are not copied back. Example entries are never copied (drag one and it becomes yours).

**Inside Claude** the diary uses your **Google Calendar connector**. As soon as you drop a task on a time or on **All day events**, it is added to Google Calendar — no click needed, even before you link everything (turn this off in Settings → Google Calendar). *Link Google Calendar* copies all your timed and all-day items and keeps them in step.

> **If nothing reaches Google:** Google must give the connector permission to add events. In claude.ai open **Settings → Connectors → Google Calendar**, **Disconnect**, then **Connect** again and, on Google's permission screen, **tick every calendar box** (Google leaves them unticked). The diary shows a red note at the top while Google refuses (for example *Insufficient scope*), keeps what you dragged waiting, and sends it when you click **Try again** or reopen the diary. **Settings → Google Calendar → Check connection** tests it.

**The downloaded copy** uses Google sign-in in the browser, which needs:
1. **The diary opened from a web address** — start it with *Host on this computer* (`http://localhost:8080`) or use your GitHub Pages / Netlify site. A double-clicked file cannot use Google sign-in.
2. **Your own free "Client ID" from Google** (about 5 minutes, once). The steps are shown in Settings → Google Calendar and in `DEVELOPER-GUIDE.md` (section 2 D). In short: Google Cloud Console → enable **Google Calendar API** → **Google Auth Platform**: Branding (Get started, External), Audience → add yourself as a test user, Clients → **Web application** with your diary's address under *Authorized JavaScript origins* → copy the Client ID into the diary.

Google gives browser apps a one-hour pass; your next drag renews it (or click **Reconnect** on the bar that appears). Once a Client ID is saved, dragging a task to a time or to *All day* signs you in if needed and adds it straight away. **No Client ID?** After you drag, the diary offers **Add to Google Calendar**, which opens Google Calendar with the item filled in — one click on Save. Every task also has **Sharing → Google Calendar** and **.ics** file buttons.

---

## 5. Files

| File or folder | Purpose |
|---|---|
| `index.html`, `css/`, `js/`, `icons/` | The app. |
| `manifest.webmanifest`, `sw.js` | Make it installable and let it work offline when served from a website. |
| `E-Diary (single file).html` | The same app in one file — easy to e-mail or upload anywhere. |
| `Start E-Diary …`, `Create …`, `Host on this computer …` | Launchers for Windows (`.bat`), Mac (`.command`) and Linux (`.sh`). |
| `DEVELOPER-GUIDE.md` | How the code works, where data is stored, and how to deploy and edit it. |
| `tools/windows/*.ps1` | Scripts the Windows launchers use. |
| `tools/build.mjs` | Rebuilds the single-file copy after you edit the app: `node tools/build.mjs` |

If you change the app and host it on a website, also change `VERSION` at the top of `sw.js` so installed copies download the new files.

---

## 6. Troubleshooting

- **A banner says storage is blocked / nothing is saved.** You are probably in a private or incognito window, or the browser blocks site data. Use a normal window.
- **The weather does not show.** It needs an internet connection. Check the city in Settings → Weather & Quotes.
- **Reminders do not pop up.** Reminders ring while the diary is open (a tab or its app window). Allow notifications in Settings → Reminders.
- **The Mac `.command` file will not open.** Right-click it → Open → Open. This is only needed the first time.
- **My diary looks empty in another browser.** Each browser has its own copy. Export from the first one and import into the other, or use the diary file or cloud sync.
- **Excel import says it found no sheet.** The sheet needs a first row with column names including *Date* and *Track* (or *Subject*). Old `.xls` files: save as `.xlsx` first.
- **Dragged tasks do not appear in Google Calendar (inside Claude), or the note says "Insufficient scope".** The connector is linked without calendar permission. Reconnect it and tick the calendar boxes, as described under *Google Calendar* above; waiting items are then sent.
- **The diary asks for a password I don't remember.** It cannot be opened without it (that is the point of the lock). If you have an unlocked backup, choose *Forgot the password?* → start a new diary, then import the backup.
- **Google says "Access blocked" or "origin mismatch".** Add the exact address you use (for example `http://localhost:8080`) under *Authorized JavaScript origins* of your Client ID, and add your Gmail address as a test user.
- **I forgot the master password of the password log.** It cannot be recovered and the entries cannot be opened. On the locked page click *Forgot the master password?* to delete the log and start a new one (everything else in the diary stays).

Weather data by [Open-Meteo.com](https://open-meteo.com) (CC BY 4.0). Holiday lists: Department of Personnel & Training, Government of India. Quotes are credited to their authors.


### Govt Jobs on your computer — automatic weekly updates (v1.8.2)
1. Install **Google Drive for desktop** and sign in (a *Google Drive* folder appears on your computer).
2. Every Monday (~7:00 IST) a Claude scheduled task researches Level 13A/14 openings and saves `e-diary-jobs-feed-YYYY-MM-DD.json` into the **E-Diary Jobs** folder in My Drive (it creates the folder on its first run; you can also create it yourself and drop the starter file in).
3. In the diary (Chrome or Edge): **Study → Govt Jobs → Link the E-Diary Jobs folder…**, pick *Google Drive → My Drive → E-Diary Jobs*, choose **Allow on every visit**.
4. From then on the diary reads the newest list whenever it opens; new openings are marked **new**. Websites you add under **My websites** are saved to `e-diary-my-websites.json` in that folder, and the Monday task searches them too.

### Several study plans and changing the length (v1.9)
- **Several plans:** keep as many study plans as you like; one is shown at a time (on the study pages, in Daily Tasks and in the calendar). **Plan ▾ → Switch to “…”** or **Plan ▾ → My plans…** to change which one is shown — each keeps its own sessions and ticks.
- **Importing or making a plan** when you already have one asks: **Add as another plan** (the current one is kept) or **Replace** it (an update of the same plan keeps your ticks, as before).
- **Deleting** the plan shown brings back the most recent saved one.
- **Plan ▾ → Number of weeks: add or remove…** — use − / + or type the number. Added weeks go after the current end and can repeat the last week’s sessions (switch on by default). Removing weeks takes them off the end with their sessions; you are asked first if any of them are ticked. The plan’s end date and summary line follow.

### v1.10 additions
- **Saving to Google Drive:** Settings → Backup & Sync → *Keep the diary in Google Drive*. Once the diary file is linked: **Save automatically** (on = every change within seconds; off = only when you click **Save to it now** or press **Ctrl+S**) and **Ask before closing if changes are not saved** (the browser asks “Leave site? Changes you made may not be saved”; choose *Cancel* to stay and the diary saves at once). Ctrl+S saves to the linked file anywhere in the diary.
- **Planner → Bucket List:** places, skills and milestones by category, with status (Someday, Planned, In progress, Done), a target year or date, rough cost, why it matters and steps. Any step can become a planner task; ticking the task ticks the step. Ideas to start with, progress by category and an “Achieved” list on the right.
- **Important websites → Categories:** your own categories and subcategories — add, rename, reorder, remove. Typing a new category or subcategory when adding a website also adds it. Websites are grouped by category, then subcategory.
- **Medicines → How often:** every day, alternate days, or once in 3, 4, 5, 6, 7 … 90 days, counted from the “From” date (works together with chosen weekdays). Stock days-left follows.
- **Password log:** three wrong master passwords in a row erase the password log (from the diary and the snapshots in this browser; undo cannot bring it back). The lock screen shows how many tries are left; the count survives closing the diary and is reset by the right password. Turn it off or on from the password log’s ⋯ menu.

### v1.11 additions
- **One PC at a time (Google Drive diary file):** the diary file records which PC has it open (Settings → Backup & Sync → *This PC’s name*). Another PC that opens the same file gets it **read-only**: it shows the file’s data, keeps none of its own changes and writes nothing, with a red bar saying where the diary is open. When the first PC closes the diary (or 6 minutes after it goes quiet — switched off, crashed, offline), the next PC takes over automatically (it checks every minute), or choose **Take over**. **Release for other PCs** in Settings hands it over without closing. When a PC opens the file it takes the file’s data as it is, so old data on that PC no longer overwrites newer data.
- **Planner → Weekly and Yearly:** Planner now has Daily · Weekly · Monthly · Yearly (plus Events, Eisenhower, Bucket List). Yearly: tasks for the year → *Schedule to a month* (it goes to Monthly Tasks, noted with the month). Weekly: tasks for the week, or bring them in from Monthly Tasks (*This week*) → *Schedule to a day* (it goes to Daily Tasks). Every item that was scheduled stays where it was, greyed out, with “Scheduled for …” and how its copy is doing; ticking the copy done shows done all the way up. *Unschedule* brings it back and removes the copies. Monthly Tasks lists what was scheduled on to a week under “Scheduled to a week”. Everything that was there before works as it did.
- **Notes & Life → Wardrobe:** *My clothes* (shirts, trousers, shoes… with colour, occasion, size, cost, condition, “wore today”), *Outfit plan* (a week of top / bottom / footwear / layer, with *Suggest the week*), *To buy* (what, expected cost, must-have or nice-to-have, by when, where; a budget; suggestions from your basic set and worn-out items; *Bought* asks the price paid and adds it to My clothes).

### v1.12
- **Desktop app and Google sign-in:** the E-Diary desktop shortcut and “Start E-Diary (Windows)” now start a small hidden web server and open the diary at **http://localhost:47812** in its own window (an unusual port, so it does not clash with other programs; v1.12.1), so Google sign-in (Google Calendar) works. Run **Create Desktop Shortcut (Windows)** once to update the shortcut. In your Google Cloud Client ID, *Authorized JavaScript origins* must include `http://localhost:47812`. The first time, link your Google Drive diary file again in Settings → Backup & Sync (the browser keeps a separate copy per address).
- **Monthly → Weekly:** a Monthly task’s ⋯ menu has **Schedule to a week…**; scheduled tasks stay in Monthly Tasks, greyed out, under “Scheduled to a week” with “Scheduled for week of …” and the status of the copy.

### On a Mac (first time)
macOS blocks scripts downloaded from the internet (“Apple could not verify…”). Do this once:
1. Click **Done** on the warning.
2. Open **System Settings → Privacy & Security**, scroll down to the message about “Start E-Diary (Mac).command” and click **Open Anyway**, then enter your password and click **Open**.
   *Or*, in Terminal: `xattr -dr com.apple.quarantine ` followed by dragging the E-Diary folder into the Terminal window, then Enter — this clears the block for every file in the folder.
3. Double-click **Start E-Diary (Mac).command** again. Run **Create Mac App (Mac).command** once to get an E-Diary app in Applications / the Dock.
Without these, you can always double-click **E-Diary (single file).html** — it opens in your browser (Google sign-in needs the web address, though).

### v1.14 — purchases in Bills, Google Drive sync, looks and themes, phone version

**Groceries and clothes in Finance → Bills**
- Every grocery list with items shows in **Finance → Bills → Planned purchases** with its total, and in **Overview → Coming up** when it has a date. The Wardrobe "To buy" list shows there too, one line per item.
- Each grocery list also puts one task on its shopping date in the daily tasks, named like **Groceries — 17 Oct 2026** (with a cart). Clicking it opens the grocery list.
- **Ticking the task done** marks the groceries as bought and the bill as paid, and adds the spending to Money (Groceries). Ticking the last item on the list does the same.
- **Deleting the task** takes the list out of the planner and out of Bills. The list itself stays, with **Add it back** on the Grocery page. Deleting the list removes both.
- Moving the task to another day moves the shopping date, and changing the date on the list moves the task. Price changes update the bill.
- **Ticking a wardrobe item in Bills** asks what it cost, marks it bought, adds it to My clothes and records the spending under Shopping & clothes.
- Two switches below the list: show purchases in Bills, and add them to Money records.

**Saving across devices — Google Drive sync (recommended)** — Settings → Backup & Sync
- The diary talks to Google Drive directly. You don't need Google Drive for desktop or to choose a file, and nothing is read-only.
- Each device keeps its own full copy, e.g. "E-Diary — Office PC.json", in the folder **E-Diary sync**, and writes only that copy. Two devices can never write over each other.
- Each device reads the others' copies and merges them in, item by item. Additions, edits and deletions from every device all come through, in whatever order the devices sync.
- **Setting it up:** it uses your Google Calendar Client ID. Turn on the **Google Drive API** once in Google Cloud Console, then click **Turn on Google Drive sync** on each device. A device that already has its own entries is asked whether to merge them or use the copy in Drive.
- **Sign-in:** Google's sign-in lasts one hour. The diary renews it by itself if pop-ups are allowed for its address; otherwise your next click renews it.
- **Unsaved changes:** a notice and the cloud icon show when changes are waiting to go to Drive, and the browser asks before you close in that case.
- **Two diary windows on the same PC** (e.g. the shortcut clicked twice) now merge their changes instead of one overwriting the other.

**Looks and themes** — the palette button in the top bar, or Settings → Appearance
- 21 ready-made looks:
  - Classic leather, Executive black, Navy officer, Oxblood, Forest green, Royal purple, Denim, Sky blue, Deep teal, Dusty rose, Walnut wood, Kraft paper, Carbon, Ivory;
  - Indian Army (camouflage), Indian Air Force (sky and clouds), Indian Navy (sea waves), Intelligence (map contours), Cyber Security (circuit board), Hacking (0/1 code) and Aviation (aircraft). These use colours and patterns only — no emblems or insignia.
- Or choose each part yourself:
  - cover colour (or any colour);
  - texture: leather, pebbled, suede, linen, canvas, denim, wood, kraft, carbon, smooth, camouflage, sky, waves, contours, circuit, code, aircraft;
  - pages: plain, white, cream, ruled, dotted, squared, vintage;
  - accent colour, rings (silver, gold, rose gold, black), lettering (gold or silver) and text (modern or book type).
- Light or dark works with every look. The look is saved with the diary, so it is the same on every synced device.

**The mobile version (Android)**
- On a phone the diary has a bottom bar (Today · Planner · Notes & Life · Money · More), a round **+** button to add a task, and swipe left/right on the daily page for the next or previous day.
- Bigger touch targets; **More** holds every section and tool.
- Settings → Install & Help → Layout switches between phone and computer layouts by hand.
- **Installing:** it installs from Chrome (⋮ → Install app) when opened from a web address (https), not from a file.
- **Shortcuts:** long-press the app icon for Today, New task, Groceries and Bills.
- **Sharing:** Android's **Share** menu can send text from any app to E-Diary as a new task.
- **Hosting:** see "E-Diary Mobile" below, and the Raspberry Pi set-up in `tools/pi/`.

### E-Diary Mobile — getting it onto an Android phone
The phone version needs the diary at an **https web address**. Choose one:
1. **Raspberry Pi at home (any internet connection, changing IP is fine):** copy the folder to the Pi and run `bash tools/pi/install.sh`.
   - It installs **Tailscale** and serves the diary at `https://ediary.<your-tailnet>.ts.net`.
   - Install the Tailscale app on the phone and PCs, and sign in with the same account.
   - In the Tailscale admin console → DNS, turn on MagicDNS and HTTPS Certificates.
2. **GitHub Pages (free, no Pi):** upload the folder's contents to a GitHub repository → Settings → Pages → Deploy from branch `main` /root. The address is `https://<you>.github.io/<repo>/`.

Then:
- add the address (without the final /) to your OAuth Client ID's **Authorized JavaScript origins**;
- open it in Chrome on the phone, ⋮ → **Install app**;
- turn on **Google Drive sync**.

### v1.13.4 — phone: "file could not be found"

- On Android the browser is only given a link to the one copy of `e-diary.json` you picked. When Google Drive brings in a newer copy (e.g. after you used the diary on your PC), that link stops working and the diary used to show "Could not read e-diary.json: A requested file or directory could not be found…".
- Now the diary explains this and offers **Choose the file again**. Pick `e-diary.json` in Google Drive; the latest diary loads and anything you changed on the phone meanwhile is merged in (no "Two diaries" question for the same file).

### v1.13.3 — Google sign-in address shown

- Settings → Google Calendar now shows the exact address the diary is open at (e.g. `http://localhost:47812`). That address must be in **Authorized JavaScript origins** of your Client ID in Google Cloud Console, or Google shows "Error 400: origin_mismatch".

### Launcher fix (Windows, with 1.13.2)

- The desktop shortcut now checks that the hidden diary server is showing **this** folder. A server left running from an older copy (for example, before the diary was unzipped to a new place) kept showing the old version; it is now stopped and restarted from the right folder, on the same address, so your entries stay.
- After unzipping somewhere new, run **Create Desktop Shortcut (Windows).bat** from the new folder once, so the shortcut points there.

### v1.13.2 — a second PC can never wipe the Drive copy

- **Before every automatic save** (and the 2-minute "still open here" signal) the diary looks at what the Drive file holds now. If it is a version this PC has not seen — saved by another PC, or a newer copy Google Drive delivered late — it is merged in item by item first, never written over.
- **A blank or new diary never replaces a file that has entries.** On a new PC the entries in the file are loaded instead.
- **"Save diary to a file…" first asks** whether a diary file already exists in Drive, and offers to open it. If you still pick the existing file there, the diary opens it instead of writing over it.
- **Changes made before the file was reconnected** (the "Open it" bar) are merged with the file, not dropped.
- The file now carries a readable time stamp (`stamp`), so the check is quick even when the diary has a password.
- If something was ever lost: Settings → Backup & Sync → Automatic daily snapshots (on the PC that had it), Undo right after a replace, or Google Drive's own version history (right-click the file in drive.google.com → File information → Manage versions).

### v1.13.1 — updates show at once

- The diary now always loads its newest files when opened from the desktop shortcut (it used to show the previously stored copy until a second reload). The stored copy is only used when the files can't be reached.
- Settings → General → About shows the version number, so you can check which one is running.

### v1.13 — Google Calendar: your choice, never twice
- **Only the items I choose** (Settings → Google Calendar): nothing is copied by itself; open a task, event or study session and click **Add to Google Calendar** (or a task’s ⋯ menu). Turning it on takes the automatic copies out of Google; the ones you chose stay.
- **Item by item, in any mode:** the task / event / study-session editors show **In Google Calendar ✓** or **Add to Google Calendar**; clicking takes an item out of Google (it stays in the diary) or puts it in. A task’s ⋯ menu has the same.
- **Never twice:** before adding, the diary looks in Google for the same item (its E-Diary tag) or the same title at the same time, and reuses it instead of adding another.
- **Remove duplicates from Google Calendar** (button in the same settings): removes extra copies made earlier — for example by the diary opened from different addresses or PCs before this version — keeping one of each.

### v1.15 — editing a study plan, wardrobe purchases in the planner

**Your app address:** https://batraamul.github.io/e-diary/ — install it from there on every device (Chrome/Edge → Install; Android → ⋮ → Install app; iPhone → Safari → Share → Add to Home Screen). New versions arrive by themselves: the app shows "A new version of the diary is ready" → **Reload**. No reinstall needed.

**Study → Plan ▾**
- **Change the start date…** moves the whole plan — every week and every session — by the same number of days. Ticked sessions keep their tick, minutes and notes. The window warns you if the new date falls on a different weekday (then each session moves to another weekday too). Also reachable from Plan settings (“Starts on … Change the start date…”). Undo works right after.
- **Change many sessions (move, change, delete)…** — choose *which* sessions (subject, slot, weekdays, from–to dates, with or without ticked ones; the window counts them as you choose) and *what to do*: move to another weekday in the same week, move by a number of days (negative = earlier), change the subject, change the slot (the session then uses the new slot's time), change the planned minutes, or delete them. Example: Physics, all slots, Tuesdays, from next Monday → Move to Thursday.
- **Removing a subject that has sessions:** Plan settings → the bin next to the subject now works for every subject. It asks first (and says how many sessions are already ticked); on **Save** the subject goes with its sessions and its own topics. Undo brings them back.

**Wardrobe “To buy” in the daily planner** (like groceries)
- Every item on the To-buy list is a task **Buy: <item>** on its **Buy by** day (an item without a date gets today). “Must have” items are priority A. The task shows a small person icon; clicking it opens Wardrobe → To buy.
- **Ticking the task** marks the item bought at its expected cost, adds it to My clothes and records the spending under Shopping & clothes; the message offers **Change price** for what you actually paid. Unticking undoes all of that (the clothes entry goes again unless you have worn it since).
- Marking the item bought on the Wardrobe list ticks the task. Moving the task to another day changes Buy by, and changing Buy by moves the task.
- **Deleting the task** takes the item out of the planner and Finance → Bills; it stays on the To-buy list with **Add back to planner**. Deleting the item removes its task.
- Items bought before 1.15 do not get tasks.
