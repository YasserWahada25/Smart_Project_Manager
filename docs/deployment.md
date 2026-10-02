# Deployment

> Current state: **the backend runs locally** (requires MongoDB). Nothing is containerized yet.
> Dockerfiles and `docker-compose.yml` are added in a dedicated task.

## 1. Services and default ports

| Service | Default port | Status |
|---------|--------------|--------|
| Angular frontend | 4200 (dev server) | Runs locally (`npm start`) |
| Express.js backend | 3000 | Runs locally |
| FastAPI AI service | 8000 | Not created |
| MongoDB | 27017 | External (local install or Docker) |

## 2. Environment variables

Each service has its own template, copied to a git-ignored `.env` in the same folder. `.env` files must never be committed.

### 2.1 Backend — [`backend/.env.example`](../backend/.env.example)

Loaded by `backend/src/config/env.js` (dotenv). Variables already set in the process environment take precedence over `.env`.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | `development` / `production` / `test` |
| `PORT` | No | `3000` | HTTP port (integer 1–65535, validated at startup) |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string; startup fails if missing |
| `CORS_ORIGIN` | No | `http://localhost:4200` | Allowed frontend origin(s), comma-separated |
| `JWT_SECRET` | **Yes** | — | Secret used to sign JWTs; at least 32 characters (startup fails otherwise). Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | No | `1d` | Token lifetime: seconds or a duration (`1h`, `7d`…), validated at startup |
| `BCRYPT_SALT_ROUNDS` | No | `12` | bcrypt cost factor, integer 4–15 |

Changing `JWT_SECRET` invalidates every token already issued (all users must log in again).

Read only by `npm run create-admin`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_EMAIL` | Yes (for the command) | — | Email of the initial administrator |
| `ADMIN_PASSWORD` | Yes (for the command) | — | Password (same policy as registration). Remove it from `.env` once the account exists |
| `ADMIN_FIRST_NAME` | No | `Platform` | |
| `ADMIN_LAST_NAME` | No | `Administrator` | |

### 2.2 Planned variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `AI_SERVICE_URL` | Backend | Base URL of the AI service — AI integration task |
| `AI_SERVICE_PORT` | AI service | HTTP port of the FastAPI service — AI service task |

The root [`.env.example`](../.env.example) gathers the variables for the future Docker Compose setup.

Secrets are never placed in Angular environment files (they are shipped to the browser).

## 3. Local development

### 3.1 Backend

Prerequisites: Node.js 20.19+ (required by Mongoose 9) and a reachable MongoDB instance.

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set JWT_SECRET (see table above)
npm run dev
```

Expected log:

```
[...] INFO  MongoDB connected (database: smart_project_manager)
[...] INFO  Backend listening on port 3000 (development)
```

Verify: `curl http://localhost:3000/api/v1/health` → HTTP 200, `"status":"ok"`.

### 3.2 Create the first administrator

```bash
cd backend
# in .env: set ADMIN_EMAIL and ADMIN_PASSWORD
npm run create-admin
```

| Situation | Output | Exit code |
|-----------|--------|-----------|
| Account created | `Admin account created: <email>` | 0 |
| An ADMIN with this email already exists | `Admin account already exists: <email> (active: true) — nothing changed` | 0 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` missing | `ADMIN_EMAIL and ADMIN_PASSWORD must be set` | 1 |
| Password breaks the policy | e.g. `Password must be at least 8 characters` | 1 |
| Email used by a non-admin account | `A non-admin user with the email <email> already exists` (the account is **not** promoted) | 1 |

The command is idempotent: it can safely be re-run (e.g. at every container start in the Docker task).

Startup failures (the process logs `Failed to start backend: <reason>` and exits with code 1):

| Situation | Reason logged | When |
|-----------|---------------|------|
| `MONGODB_URI` missing | `Invalid configuration: MONGODB_URI is required` | Immediately |
| `PORT` not an integer in 1–65535 | `Invalid configuration: PORT must be an integer between 1 and 65535` | Immediately |
| `JWT_SECRET` missing / too short | `JWT_SECRET is required` / `JWT_SECRET must be at least 32 characters long` | Immediately |
| `JWT_EXPIRES_IN` invalid | `JWT_EXPIRES_IN must be a number of seconds or a duration such as "1h" or "1d"` | Immediately |
| `BCRYPT_SALT_ROUNDS` out of range | `BCRYPT_SALT_ROUNDS must be an integer between 4 and 15` | Immediately |
| MongoDB unreachable | e.g. `connect ECONNREFUSED 127.0.0.1:27017` | After ~10 s (server selection timeout) |

### 3.3 Frontend

Prerequisites: Node.js 20.19+ (developed with 24), the backend running on port 3000.

```bash
cd frontend
npm install
npm start          # ng serve → http://localhost:4200
```

`proxy.conf.json` forwards every `/api/*` request of the dev server to `http://localhost:3000`, so the frontend always calls the relative URL `/api/v1` (`environment.apiUrl`) and the browser never performs cross-origin requests. The backend `CORS_ORIGIN` setting is only needed if the frontend is served from another origin without proxy.

If the backend is stopped, the proxy answers 502 and the home page shows "The backend API is unreachable".

First use: open `http://localhost:4200`, then **Create an account** (developer or project manager) or sign in with the administrator created by `npm run create-admin`.

Production build: `npm run build` → static files in `frontend/dist/smart-project-manager/browser/` (to be served by a web server that also proxies `/api` to the backend — Docker task).

## 4. Docker / Docker Compose

To be documented when implemented.
