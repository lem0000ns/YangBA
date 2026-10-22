# YangBA

[NBA stats explorer](https://www.yangba.net) for season-level queries (2015–16 through the current season): one number for a player, matching box scores, or league leaderboards. Player profiles add bio, career teams, and awards.

**FPTS** (fantasy points) follows [ESPN’s default points-league scoring](https://fantasy.espn.com/basketball/settings):  
`2×FGM − FGA + 3PM + 2×AST + REB + 4×(STL+BLK) − 2×TOV + PTS − missed FT`.  
It is computed in SQL at query time (not stored in MySQL), so you can filter and rank on `fpts` like any other stat.

---

## User experience

### Home (`/`)

Landing page introduces three tools (**Stats**, **Games**, **Rankings**), a live-style **FPTS** specimen card, and links to **Examples**. Press **`/`** anywhere to open player search (nav bar).

### Stats (`/stats` → `/stats/results/...`)

Build a question about **one player** (optional) and **one stat**:

- Pick stat (points, 3PM, FG%, FPTS, games played, etc.) and **metric**: total, per game, best game, or worst game.
- Optionally narrow by **seasons** and **filters** (e.g. `points>40`).

**Results** show the numeric answer, a short natural-language summary, and (when a player is named) a **percentile** vs all players in the same scope. Player names link to profiles.

### Games (`/games` → `/games/results/...`)

Return up to **N box scores** that match criteria:

- Optional **player**, **seasons**, and **filters** (e.g. `3pm>10`, `stage=3` for playoffs).
- Table includes date, team, stage, counting stats, and **FPTS** per game.

### Rank (`/rank` → `/rank/results/...`)

**Leaderboard** of players by a stat and metric:

- **How many players**, **stat**, **metric**, **most or least**.
- Optional **team**, **seasons**, **playoff stage**, and **filters** (rank filters apply to per-game averages unless the stat is games played).

Results are a ranked list; each row links to a player profile.

### Player profile (`/players/:name`)

Loaded from the **`/players`** API: position, measurements, schools, draft, career span, teams timeline, awards, and intro blurb. Shortcuts jump to common Stats/Games queries for that player.

### Shareable URLs

Form submits navigate to **path-encoded** result URLs (e.g. `/stats/results/stephen%20curry/2017/na/na/points/avg/na/na/na`). Bookmark or share the URL to reproduce the same query.

### Examples (`/examples`)

Curated links that deep-link into result pages for common query patterns.

---

## Codeflow (query path)

What happens when someone runs a query on the live site:

```
Browser (React + Vite)
  → ResultsPage reads URL params
  → utilities.computeURL() builds query string (season, stat, agg, filter, …)
  → GET https://…/dev/{stats|games|rank}?…
       API Gateway (us-west-1)
  → Lambda routeHandler.lambda_handler
       • Parses resource: stats | games | rank | players
       • StatComputer | GameComputer | RankComputer (query_utilities.py)
       • Fuzzy player name match vs S3 allNames.txt (FuzzyWuzzy)
       • SQL against MySQL: version2 ⨝ games (+ players for profiles)
  → JSON response
  → UI: StatCard / Table / ResultCard, formatStat, optional computeFPTS fallback
```

| Frontend | Backend |
|----------|---------|
| `App.tsx` — routes, form → result navigation | `routeHandler.py` — HTTP dispatch, percentile for stats |
| `pages/*Form.tsx` — query builders | `query_utilities.py` — SQL generation, FPTS expression |
| `pages/ResultsPage.tsx` — fetch + render | RDS `yba`: `version2`, `games`, `players` |
| `content/PlayerInfo.tsx` — profile | `players` row from Wikipedia scrape |
| `constants.ts`, `utilities.tsx` — labels & URL encoding | Env: `SECRETS_MANAGER_CONTRASENA` |

**Local dev** runs only the frontend (`npm run dev`); it still calls the **deployed** API unless you change `baseURL` in `ResultsPage.tsx` / `PlayerInfo.tsx`.

**Season note:** UI season labels are the **ending year** of a season (e.g. `2017` = 2016–17). The API is called with `season = UI value − 1`.

**Filters:** Encoded in the URL as tokens like `points>30`, joined with `-` in the path and `,` in the API (`filter=points>30,ast>10`).

---

## Codeflow (data pipeline)

Separate from the site API; runs on a schedule (daily ETL Lambda):

```
dataDump.lambda_handler
  → RapidAPI NBA (/seasons, /games, /players, …)     [RAPIDAPI_KEY]
  → NameDumper / GameDumper / PlayerDumper (utilities.py)
  → NDJSON on S3 (nba-players.bucket)
  → MySQL_Writer → INSERT … ON DUPLICATE KEY UPDATE → games, version2
  → playerScraper.namesToSQL() → Wikipedia → players table
```

Optional **`imageDump.py`** Lambda scrapes RealGM headshots into S3 (`allPlayerImages/`), served via CloudFront for `PlayerAvatar`.

`yba-deploy` does **not** update `dataDump` or `imageDump`—only **`routeHandler`** and the static frontend.

---

## Repository layout

| Path | Role |
|------|------|
| `yba-frontend/` | React 18, TypeScript, Vite, react-router |
| `yba-backend/routeHandler.py` | Query API Lambda handler |
| `yba-backend/query_utilities.py` | SQL builders + name matching |
| `yba-backend/dataDump.py` | Scheduled ETL entry |
| `yba-backend/utilities.py` | S3 dump + MySQL load helpers |
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

**Lambda environment (ETL only):** `SECRETS_MANAGER_CONTRASENA`, `RAPIDAPI_KEY`.

---

## Stack

React · Vite · API Gateway · Lambda · MySQL (RDS) · S3 · CloudFront · Route 53 · RapidAPI NBA · Wikipedia (Beautiful Soup)
