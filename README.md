# TypeRacer Pro

A production-grade typing speed test built on Next.js 14. Race the clock,
sprint through a fixed number of words, or paste your own passage to drill
— all with real-time WPM, per-character error tracking, and a global
leaderboard backed by Neon Postgres.

---

## Features

- **Multiple game modes**
  - **Timed tests** — 15s, 30s, 60s, 120s.
  - **Word-count tests** — 10, 25, 50, 100 words.
  - **Custom text** — paste or type your own passage (10–5000 chars).
- **Real-time feedback** — live WPM, raw WPM, and accuracy update as you type.
- **WPM-over-time chart** on the results screen, with an average reference line.
- **Trouble-characters breakdown** — the characters you most often mistype,
  with the incorrect character you typed in their place.
- **Personal-best tracking** — anonymous-id based, so your PB follows you
  even before you pick a name.
- **Global leaderboard** with per-mode filters.
- **Practice mode** — toggle off leaderboard saving for a warm-up run.
  Custom-text mode is always in practice mode.
- **Paste & drag-and-drop blocking** in the typing area to keep scores honest.
- **Server-side cross-validation** of submitted scores using the exact same
  WPM / accuracy formulas as the client.
- **Two-tier rate limiting** — per-IP request-rate limit and per-duration
  "no two 15s tests in under 12 seconds" limit.
- **Keyboard shortcuts** — `Tab` to restart a test, `Esc` to reset / return
  to the previous screen.

---

## Tech stack

| Layer       | Tool                                                           |
| ----------- | -------------------------------------------------------------- |
| Framework   | [Next.js 14](https://nextjs.org) (App Router, `'use client'`)  |
| Runtime     | Node.js 20                                                     |
| Language    | TypeScript 5                                                   |
| Styling     | [Tailwind CSS 3](https://tailwindcss.com) + custom neon palette |
| Database    | [Neon](https://neon.tech) (serverless Postgres) via `pg`        |
| Testing     | [Vitest 2](https://vitest.dev)                                 |
| Container   | `node:20-alpine`, Next.js `output: 'standalone'`, port 8080     |

---

## Project structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout + site-wide metadata
│   ├── page.tsx            # Home — game-mode selection
│   ├── game/               # /game — gameplay screen (+ per-page metadata)
│   ├── leaderboard/        # /leaderboard — global top scores
│   ├── stats/              # /stats — personal history & aggregates
│   └── api/
│       ├── scores/         # POST score submissions (validated, rate-limited)
│       └── leaderboard/    # GET paginated leaderboard rows
├── components/             # React components (TypingGame, ResultsScreen, …)
├── lib/
│   ├── typing-utils.ts     # Pure WPM / accuracy math (tested)
│   ├── rate-limit.ts       # Per-IP request-rate limiter (tested)
│   ├── duration-rate-limit.ts  # Per-duration submission limiter (tested)
│   ├── db.ts               # pg Pool + connection helpers
│   ├── migrate.mjs         # Run migrations (`npm run migrate`)
│   └── migrations.ts       # SQL migration definitions
├── data/passages.ts        # Built-in passages pool
└── types/game.ts           # Shared `GameResult` / `TroubleCharacter` types
```

---

## Local development

### Prerequisites

- **Node.js 20** (the Docker image and CI both target 20).
- **A Neon Postgres database** (or any Postgres 14+ instance) reachable via a
  connection string.

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure the database connection
cat > .env.local <<'EOF'
DATABASE_URL=postgres://<user>:<password>@<host>/<db>?sslmode=require
EOF

# 3. Run migrations (creates the scores / leaderboard tables)
npm run migrate

# 4. Start the dev server on http://localhost:3000
npm run dev
```

### Everyday commands

| Command            | What it does                                            |
| ------------------ | ------------------------------------------------------- |
| `npm run dev`      | Next.js dev server with hot reload.                     |
| `npm run build`    | Production build (`.next/standalone`).                  |
| `npm start`        | Run the production build locally.                       |
| `npm run lint`     | Run `next lint` (ESLint + Next's rules).                |
| `npm run migrate`  | Apply all pending SQL migrations against `DATABASE_URL`.|
| `npm test`         | Run the Vitest suite once.                              |
| `npm run test:watch` | Run Vitest in watch mode.                             |

### Environment variables

| Name           | Required | Purpose                                                                 |
| -------------- | -------- | ----------------------------------------------------------------------- |
| `DATABASE_URL` | Yes      | Postgres connection string used by `src/lib/db.ts` and `npm run migrate`. Uses admin credentials — never expose to the client. |
| `PORT`         | No       | Server port. Defaults to 8080 in the Docker image.                       |
| `HOSTNAME`     | No       | Bind address. Defaults to `0.0.0.0` in the Docker image.                 |
| `NODE_ENV`     | No       | Set to `production` by the Dockerfile; set locally by `npm start`.       |

All database access is gated behind server-side API routes in
`src/app/api/**`. The browser never sees `DATABASE_URL`.

---

## Game modes

### Timed tests — `/game?duration=<seconds>`

Pick a countdown duration from the home page. When time runs out, the
current passage is submitted and stats are locked in. Accepted values:
`15`, `30`, `60`, `120`. Any other value falls back to `60`.

### Word-count tests — `/game?mode=words&wordCount=<n>`

Sprint through a fixed number of randomly-sampled words. For counts ≤ 25
each word is unique (partial Fisher–Yates shuffle over the unique-word
pool); larger counts only prevent consecutive duplicates. Accepted values:
`10`, `25`, `50`, `100`. Default: `25`.

### Custom text — `/game?mode=custom`

Paste or type your own passage (minimum 10, maximum 5000 characters after
trimming). The typing game launches with that exact text. Custom-text
tests are **always** in practice mode and never save to the leaderboard.

- `Tab` — restart the test with the same custom text.
- `Esc` — return to the text-entry screen.

### Practice mode

Every mode except custom-text exposes a practice-mode toggle on the game
screen (only togglable before the timer starts). Practice-mode runs show a
"Practice Mode — score not saved" badge on the results screen.

---

## Testing

```bash
npm test
```

The Vitest suite covers the high-value shared modules:

- `src/lib/typing-utils.ts` — `calculateWpm`, `calculateRawWpm`,
  `calculateAccuracy` — including zero / negative / `NaN` / `Infinity`
  / sub-1s clamping / boundary cases.
- `src/lib/rate-limit.ts` — first / Nth request, blocking, per-IP
  isolation, window reset, `retryAfter` shrink behavior.
- `src/lib/duration-rate-limit.ts` — per-duration allow / block,
  `retryAfter` math for each timed mode, and `keyModifier` behavior used
  by word mode to prevent fractional-duration bucket-escape.

Tests use fake timers (`vi.useFakeTimers`) to exercise window expiry
deterministically and `vi.resetModules()` between tests to isolate the
in-memory rate-limit state.

---

## Deployment

The app ships as a single Docker image targeting Fly.io.

- **Dockerfile** at the repo root uses a multi-stage build on
  `node:20-alpine`, producing a lean runtime stage from Next.js's
  `output: 'standalone'` tracing output.
- **Port**: the container exposes and listens on `8080` (`PORT=8080`,
  `HOSTNAME=0.0.0.0`).
- **User**: runs as a non-root `nextjs` user (UID 1001).
- **CI** (`.github/workflows/ci.yml`) validates that the Dockerfile
  exists and that `docker build .` succeeds on every pull request.
- **Staging deploy** (`.github/workflows/deploy-staging.yml`) auto-pushes
  the `beta/iteration-*` branches to `registry.fly.io/$FLY_APP_NAME_STAGING`.
- **Production deploy** (`.github/workflows/deploy-production.yml`)
  pushes `main` to `registry.fly.io/$FLY_APP_NAME` and triggers the
  deploy webhook.

### Build & run the container locally

```bash
docker build -t typeracer-pro .
docker run --rm -p 8080:8080 \
  -e DATABASE_URL="postgres://..." \
  typeracer-pro
# -> http://localhost:8080
```

Migrations are NOT run automatically at container start — run
`npm run migrate` against the target database as part of your deploy
pipeline (or a one-off job) before rolling out new schema.

---

## Contributing

1. Create a branch off `beta/iteration-*` (or `main` for hotfixes).
2. Run `npm run lint` and `npm test` locally before committing.
3. Open a pull request. CI will validate the Docker build.
4. Keep changes focused — prefer small, reviewable PRs.

---

## License

Proprietary — internal project. See repository settings for details.
