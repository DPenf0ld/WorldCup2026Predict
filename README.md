# Kickoff — World Cup 2026 Predictor

A full-stack prediction game for the 2026 FIFA World Cup. Users join a private league via referral code, predict match scores before the deadline, and compete on a live leaderboard.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind CSS, React Query, Axios |
| Backend | Node.js, Express, Mongoose |
| Database | MongoDB |
| Auth | JWT (access token in memory + refresh token in httpOnly cookie) |

---

## Project structure

```
/
├── client/          # React + Vite app
├── server/          # Express API
└── package.json     # Monorepo root
```

---

## Local setup

### Prerequisites

- Node.js 20+
- MongoDB running locally (or a MongoDB Atlas URI)

### 1. Clone and install

```bash
git clone <repo-url>
cd kickoff-worldcup-2026
npm run install:all
```

### 2. Configure environment

```bash
# Server
cp server/.env.example server/.env
# Edit server/.env — fill in MONGO_URI, JWT secrets, ADMIN_SECRET

# Client
cp client/.env.example client/.env
# VITE_API_URL defaults to /api (proxied by Vite dev server — no change needed locally)
```

### 3. Seed the database

This creates all 104 World Cup fixtures (72 group stage + 32 knockout),
a demo league called **Kickoff Public League**, and a starter referral code `KICKOFF2026`.

```bash
npm run seed
```

### 4. Run in development

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000

---

## Scoring system

| Condition | Points |
|-----------|--------|
| Exact score (e.g. predicted 2-1, result 2-1) | +1 |
| Correct total goals (e.g. predicted 2-1, result 3-0 → both total 3) | +1 |
| Correct outcome (home win / draw / away win) | +1 |
| **Maximum per match** | **3** |

Points are counted only after an admin enters the result.

---

## Prediction deadlines

| Stage | Deadline |
|-------|----------|
| Group Stage | 48 hours before each individual match |
| All knockout rounds | 72 hours before the stage opens |

Deadlines are configurable in `server/src/config/constants.js`.

---

## Admin API

All admin routes require the `x-admin-secret` header matching `ADMIN_SECRET` in `.env`.

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/admin/matches/:id/result` | Enter `{ homeScore, awayScore }`, triggers scoring |
| `POST` | `/api/admin/referral-codes` | Create a code: `{ code, leagueId, maxUses }` |
| `GET` | `/api/admin/leagues` | List all leagues with member counts |
| `POST` | `/api/admin/sync-results` | Stub for football-data.org auto-sync (see inline comments) |

Example:

```bash
curl -X POST http://localhost:5000/api/admin/matches/<matchId>/result \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: your_admin_secret" \
  -d '{"homeScore": 2, "awayScore": 1}'
```

---

## Auto-sync results (football-data.org)

Uncomment the fetch logic inside `server/src/routes/admin.js` in the `POST /api/admin/sync-results` handler. You will need:

- A free API key from [football-data.org](https://www.football-data.org/)
- `API_FOOTBALL_KEY=your_key` in `server/.env`

---

## Deployment

### Backend → Render

1. Create a new **Web Service** on Render pointing to the `/server` directory.
2. Build command: `npm install`
3. Start command: `npm start`
4. Add all environment variables from `server/.env.example` in the Render dashboard.
5. Use a MongoDB Atlas URI for `MONGO_URI`.

### Frontend → Netlify

1. Create a new site on Netlify, root directory: `client`.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add `VITE_API_URL=https://your-render-service.onrender.com/api` as an environment variable.
5. Add a `client/public/_redirects` file with:
   ```
   /*  /index.html  200
   ```
   (handles React Router client-side navigation)

### After deploy: seed production DB

```bash
MONGO_URI=<prod-atlas-uri> npm run seed --workspace=server
```

---

## Railway deployment — spending cap (manual step)

Railway does not enforce a spending limit by default. Before going live, set a hard monthly cap in the Railway dashboard:

**Project → Settings → Spending Limit**

This cannot be configured in code and must be done manually. Without it, a traffic spike or runaway cron loop could result in an unexpected bill.

---

## Group stage fixture data

Groups are seeded from the December 2024 FIFA draw. Verify against [FIFA's official site](https://www.fifa.com/fifaplus/en/tournaments/mens/worldcup/canadamexicousa2026) before launch. Knockout placeholders will be updated by the admin as teams advance.
