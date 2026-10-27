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

Build a question about **one player** and **one stat**:

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
       • StatComputer | GameComputer | RankComputer (query/query_utilities.py)
       • Fuzzy player name match vs S3 allNames.txt (FuzzyWuzzy)
       • SQL against MySQL: version2 ⨝ games (+ players for profiles)
  → JSON response
  → UI: StatCard / Table / ResultCard, formatStat, optional computeFPTS fallback
```

| Frontend | Backend |
|----------|---------|
| `App.tsx` — routes, form → result navigation | `query/routeHandler.py` — HTTP dispatch, percentile for stats |
| `pages/*Form.tsx` — query builders, FilterBuilder | `query/query_utilities.py` — SQL generation, FPTS expression |
| `pages/ResultsPage.tsx` — fetch + render | RDS `yba`: `version2`, `games`, `players` |
| `content/PlayerInfo.tsx` — profile | `players` row from Wikipedia scrape |
| `constants.ts`, `utilities.tsx` — labels & API encoding | Env: `SECRETS_MANAGER_CONTRASENA` |

**Local dev** runs the frontend (`npm run dev`). By default it calls the **deployed** API. To query **local routeHandler** against RDS, set `VITE_API_BASE_URL=http://127.0.0.1:8765/` in `.env.development.local` (see [Local API](#local-api) below). That file is not read by a production build.

**Season note:** UI season labels are the **ending year** of a season (e.g. `2017` = 2016–17). The API is called with `season = UI value − 1`.

**Filters:** The UI composes constraints in `FilterBuilder`; the frontend sends them to the API as a comma-separated `filter` query parameter, which `query_utilities` turns into SQL `AND` / `HAVING` clauses.

---

## Codeflow (data pipeline)

Separate from the site API; runs on a schedule (daily ETL Lambda):

```
dataDump.lambda_handler
  → API-Sports NBA v2 (v2.nba.api-sports.io)          [API_SPORTS_KEY]
  → SeasonIngestor (ingest/utilities.py): games + /players/statistics?game=
  → NDJSON on S3 (nba-players.bucket)
  → MySQL_Writer → INSERT … ON DUPLICATE KEY UPDATE → games, version2
  → sync_all_names → allNames.txt (S3 + frontend bundle)
  → ingest/playerScraper.namesToSQL() → Wikipedia, API-Sports fallback → players
```

The scheduled run loads the newest API season into S3 and MySQL. Older seasons already stored are left in place. A Lambda event may pass `seasons` (API start years) to load those years instead.

Optional **`imageDump.py`** Lambda scrapes RealGM headshots into S3 (`allPlayerImages/`), served via CloudFront for `PlayerAvatar`.

`yba-deploy` does **not** update `dataDump` or `imageDump`—only **`routeHandler`**, **`askHandler`**, and the static frontend.

---

## Repository layout

| Path | Role |
|------|------|
| `yba-frontend/` | React 18, TypeScript, Vite, react-router |
| `yba-backend/query/` | Stats API: handler, SQL, natural-language ask |
| `yba-backend/ingest/` | Season load, API-Sports client, player profiles |
| `yba-backend/common/` | Repo `.env` loader and MySQL connection |
| `yba-backend/data/allNames.txt` | Local copy of the player-name list |
| `yba-backend/routeHandler.py` | Lambda shim; handler stays `routeHandler.lambda_handler` |
| `yba-backend/dataDump.py` | Lambda shim; handler stays `dataDump.lambda_handler` |
| `scripts/local_api_server.py` | Local routeHandler for dev |
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

### Local API

To query RDS from the app while developing:

```bash
# Terminal 1 — query Lambda locally (needs AWS creds for S3 allNames.txt + MySQL password)
export SECRETS_MANAGER_CONTRASENA=…
python scripts/local_api_server.py

# Terminal 2 — frontend → local API
cd yba-frontend
echo 'VITE_API_BASE_URL=http://127.0.0.1:8765/' > .env.development.local
npm run dev
```

Smoke test: **Stats** and **Games** for the **current season** (e.g. UI season **2027** = API `season=2026` if that is the active year). Expect non-empty JSON from `http://127.0.0.1:8765/stats?…` and `…/games?…`.

---

## Deploy (production site + query API)

Requires AWS CLI credentials with access to Lambdas `routeHandler` and `askHandler`, S3 bucket `yangba.net`, and CloudFront distribution `E30O7MBF2BTRPG`.

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
2. Zip and upload `routeHandler.py` plus `query/routeHandler.py` and `query/query_utilities.py` to Lambda **`routeHandler`** (`us-west-1`). The handler setting stays `routeHandler.lambda_handler`.
3. Zip and upload `ask.py`, `query/nl_stats.py`, `query/nl_pages.py`, `common/load_env.py`, and `data/allNames.txt` to Lambda **`askHandler`**. The handler setting stays `ask.lambda_handler`. Code upload does not change `NL_API_KEY` or the VPC setting.
4. `npm run build` and `aws s3 sync` to **`s3://yangba.net`**, then invalidate CloudFront **`/*`**.

**Lambda environment (query API):** `SECRETS_MANAGER_CONTRASENA` — MySQL password.

**Lambda environment (natural language):** `NL_API_KEY` on `askHandler`.

**Lambda environment (ETL only):** `SECRETS_MANAGER_CONTRASENA`, `API_SPORTS_KEY`.

---

## Stack

React · Vite · API Gateway · Lambda · MySQL (RDS) · S3 · CloudFront · Route 53 · API-Sports NBA · Wikipedia (Beautiful Soup)
