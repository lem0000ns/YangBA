# YangBA

[NBA stats explorer](https://www.yangba.net) for season-level queries (2015–16 through the current season): one number for a player, matching box scores, or league leaderboards. Player profiles add bio, career teams, and awards.

**FPTS** (fantasy points) follows [ESPN’s default points-league scoring](https://fantasy.espn.com/basketball/settings):  
`2×FGM − FGA + 3PM + 2×AST + REB + 4×(STL+BLK) − 2×TOV + PTS − missed FT`.  
It is computed in SQL at query time (not stored in MySQL), so you can filter and rank on FPTS like any other stat.

---

## User experience

### Home

Landing page introduces three tools (**Stats**, **Games**, **Rankings**), a live-style **FPTS** specimen card, and links to **Examples**. Press **`/`** anywhere to open player search from the nav bar.

### Stats

Build a question about **one player** (optional) and **one stat**:

- Pick stat (points, 3PM, FG%, FPTS, games played, etc.) and **metric**: total, per game, best game, or worst game.
- Optionally narrow by **seasons** and **filters** using the filter builder (choose stat, comparison, and threshold).

**Results** show the numeric answer, a short natural-language summary, and (when a player is named) a **percentile** vs all players in the same scope. Player names link to profiles.

### Games

Return up to **N box scores** that match criteria:

- Optional **player**, **seasons**, and **filters** (same builder as Stats; can include game stage where supported).
- Table includes date, team, stage, counting stats, and **FPTS** per game.

### Rankings

**Leaderboard** of players by a stat and metric:

- **How many players**, **stat**, **metric**, **most or least**.
- Optional **team**, **seasons**, **playoff stage**, and **filters** (for rank, filters compare per-game averages unless the stat is games played).

Results are a ranked list; each row links to a player profile.

### Player profile

Bio from the players API: position, measurements, schools, draft, career span, teams timeline, awards, and intro blurb. Shortcuts jump to common Stats and Games queries for that player.

### Examples

Curated sample queries you can open with one click to see how each tool works.

---

## Codeflow (query path)

What happens when someone runs a query on the live site:

```
Browser (React + Vite)
  → ResultsPage reads route parameters from the address bar
  → utilities.computeURL() builds API query string (season, stat, agg, filter, …)
  → GET API Gateway → stats | games | rank
  → Lambda routeHandler.lambda_handler
       • StatComputer | GameComputer | RankComputer (query_utilities.py)
       • Fuzzy player name match vs S3 allNames.txt (FuzzyWuzzy)
       • SQL against MySQL: version2 ⨝ games (+ players for profiles)
  → JSON response
  → UI: StatCard / Table / ResultCard, formatStat, optional computeFPTS fallback
```

| Frontend | Backend |
|----------|---------|
| `App.tsx` — routes, form → result navigation | `routeHandler.py` — HTTP dispatch, percentile for stats |
| `pages/*Form.tsx` — query builders, FilterBuilder | `query_utilities.py` — SQL generation, FPTS expression |
| `pages/ResultsPage.tsx` — fetch + render | RDS `yba`: `version2`, `games`, `players` |
| `content/PlayerInfo.tsx` — profile | `players` row from Wikipedia scrape |
| `constants.ts`, `utilities.tsx` — labels & API encoding | Env: `SECRETS_MANAGER_CONTRASENA` |

**Local dev** runs the frontend (`npm run dev`). By default it calls the **deployed** API. To query **local routeHandler** against RDS after a backfill, set `VITE_API_BASE_URL=http://127.0.0.1:8765/` (see [Local API + backfill verify](#local-api--backfill-verify) below).

**Season note:** UI season labels are the **ending year** of a season (e.g. `2017` = 2016–17). The API is called with `season = UI value − 1`.

**Filters:** The UI composes constraints in `FilterBuilder`; the frontend sends them to the API as a comma-separated `filter` query parameter, which `query_utilities` turns into SQL `AND` / `HAVING` clauses.

---

## Codeflow (data pipeline)

Separate from the site API; runs on a schedule (daily ETL Lambda):

```
dataDump.lambda_handler
  → API-Sports NBA v2 (v2.nba.api-sports.io)          [API_SPORTS_KEY]
  → SeasonIngestor (utilities.py): games + /players/statistics?game=
  → NDJSON on S3 (nba-players.bucket)
  → MySQL_Writer → INSERT … ON DUPLICATE KEY UPDATE → games, version2
  → sync_all_names → allNames.txt (S3 + frontend bundle)
  → playerScraper.namesToSQL() → Wikipedia, API-Sports fallback → players
```

Backfill loads API season start years **2023–2025** (2023-24 through 2025-26), **excluding the current API season**. Before load, migrations run `drop_opi.sql` and `prepare_backfill.sql` (truncate `games` / `version2`).

```bash
cd yba-backend
export API_SPORTS_KEY=… SECRETS_MANAGER_CONTRASENA=…
python dataDump.py              # full backfill + MySQL (parallel: one thread per season)
python dataDump.py --force      # ignore S3 checkpoint, re-fetch all seasons
python dataDump.py --sequential # single-threaded seasons (slower, easier on API rate limits)
python dataDump.py --verify     # check S3 vs RDS vs API game coverage only
```

After a normal backfill, `verify_backfill` runs automatically and fails the job if any game or finished box score is missing from RDS.

Optional **`imageDump.py`** Lambda scrapes RealGM headshots into S3 (`allPlayerImages/`), served via CloudFront for `PlayerAvatar`.

`yba-deploy` does **not** update `dataDump` or `imageDump`—only **`routeHandler`** and the static frontend.

---

## Repository layout

| Path | Role |
|------|------|
| `yba-frontend/` | React 18, TypeScript, Vite, react-router |
| `yba-backend/routeHandler.py` | Query API Lambda handler |
| `yba-backend/query_utilities.py` | SQL builders + name matching |
| `yba-backend/dataDump.py` | Scheduled ETL / backfill entry |
| `yba-backend/api_sports_client.py` | API-Sports HTTP client |
| `yba-backend/utilities.py` | Season ingest + MySQL load + allNames sync |
| `scripts/local_api_server.py` | Local routeHandler for dev |
| `yba-backend/playerScraper.py` | Wikipedia → `players` |
| `yba-backend/imageDumper/` | Headshot scraper Lambda |
| `scripts/yba-deploy.sh` | Git push + API Lambda + S3 + CloudFront |

---

## Local development

```bash
cd yba-frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Local API + backfill verify

After RDS has current-season data:

```bash
# Terminal 1 — query Lambda locally (needs AWS creds for S3 allNames.txt + MySQL password)
export SECRETS_MANAGER_CONTRASENA=…
python scripts/local_api_server.py

# Terminal 2 — frontend → local API
cd yba-frontend
echo 'VITE_API_BASE_URL=http://127.0.0.1:8765/' > .env.local
npm run dev
```

Smoke test: **Stats** and **Games** for the **current season** (e.g. UI season **2027** = API `season=2026` if that is the active year). Expect non-empty JSON from `http://127.0.0.1:8765/stats?…` and `…/games?…`.

---

## Deploy (production site + query API)

Requires AWS CLI credentials with access to Lambda `routeHandler`, S3 bucket `yangba.net`, and CloudFront distribution `E30O7MBF2BTRPG`.

From repo root:

```bash
./scripts/yba-deploy.sh "your commit message"
```

Or, after `source ~/.zshrc`:

```bash
yba-deploy "your commit message"
```

The script will:

1. Commit all dirty files (if any) with your message and push `origin/<current-branch>`.
2. Zip and upload `routeHandler.py` + `query_utilities.py` to Lambda **`routeHandler`** (`us-west-1`).
3. `npm run build` and `aws s3 sync` to **`s3://yangba.net`**, then invalidate CloudFront **`/*`**.

**Lambda environment (query API):** `SECRETS_MANAGER_CONTRASENA` — MySQL password.

**Lambda environment (ETL only):** `SECRETS_MANAGER_CONTRASENA`, `API_SPORTS_KEY`.

---

## Stack

React · Vite · API Gateway · Lambda · MySQL (RDS) · S3 · CloudFront · Route 53 · API-Sports NBA · Wikipedia (Beautiful Soup)
