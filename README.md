# YangBA

NBA stats explorer: query **Stats** (one number for a player), **Games** (matching box scores), or **Rank** (leaderboards). Player profiles include bio, teams, and awards. Live site: [yangba.net](https://www.yangba.net).

**FPTS** (fantasy points) uses [ESPN’s default points-league scoring](https://fantasy.espn.com/basketball/settings) and is computed from the box score at query time—usable like any other stat in all three tools.

## Local development

Frontend only (data comes from the deployed API):

```bash
cd yba-frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

From the repo root (requires AWS CLI and configured credentials):

```bash
yba-deploy "your commit message"
```

This commits if needed, pushes, updates the `routeHandler` Lambda (`yba-backend/routeHandler.py`, `query_utilities.py`), builds the frontend, syncs to S3, and invalidates CloudFront.

## Stack

React + Vite · API Gateway + Lambda · MySQL (RDS) · S3 · CloudFront · Daily ETL Lambda (`dataDump.py`) via RapidAPI NBA + Wikipedia scraping for profiles.

**Backend env:** `SECRETS_MANAGER_CONTRASENA` (MySQL), `RAPIDAPI_KEY` (ETL only).
