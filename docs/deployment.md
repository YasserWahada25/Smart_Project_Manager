# Deployment

> Current state: **the frontend, the backend and the AI service run locally** (the backend requires MongoDB). Nothing is containerized yet.
> Dockerfiles and `docker-compose.yml` are added in a dedicated task.

## 1. Services and default ports

| Service | Default port | Status |
|---------|--------------|--------|
| Angular frontend | 4200 (dev server) | Runs locally (`npm start`) |
| Express.js backend | 3000 | Runs locally |
| FastAPI AI service | 8000 | Runs locally (`uvicorn`) |
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

AI service connection (TASK 21):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_SERVICE_URL` | No | `http://localhost:8000` | Base URL of the AI service |
| `AI_SERVICE_TOKEN` | For the AI features | — | Shared secret sent as `X-AI-Service-Token`; **same value** as in `ai-service/.env`, at least 32 characters. Without it, `GET /ai/status` reports `NOT_CONFIGURED` and AI calls return 503 |
| `AI_TIMEOUT_MS` | No | `90000` | Timeout of an AI call, integer 1 000–300 000 (validated at startup) |

### 2.2 AI service — [`ai-service/.env.example`](../ai-service/.env.example)

Loaded by `ai-service/app/config.py` (pydantic-settings) from `ai-service/.env`; the service refuses to start on an invalid value.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_SERVICE_TOKEN` | **Yes** | — | Same value as in `backend/.env`, at least 32 characters. Generate: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `OPENAI_API_KEY` | No | empty | OpenAI key. **Empty = local analyzer only** (no data sent to OpenAI). Set by the supervisor only, never committed |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Any chat model of the account that supports structured outputs |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | OpenAI-compatible endpoint |
| `LLM_TIMEOUT_SECONDS` | No | `60` | Timeout of the OpenAI call (> 0, ≤ 300); keep it below the backend `AI_TIMEOUT_MS` |
| `LLM_MAX_DOCUMENT_CHARS` | No | `30000` | Longer documents are cut before being sent to OpenAI (1 000–200 000) |
| `MAX_UPLOAD_BYTES` | No | `5242880` | Largest specification file (5 MB) |
| `MAX_DOCUMENT_CHARS` | No | `100000` | Text extracted from a file is cut beyond this length |
| `LOG_LEVEL` | No | `INFO` | Python logging level |

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

### 3.3 AI service (FastAPI)

Prerequisites: Python 3.11+ (developed with 3.14.8 and checked with 3.12.5).

```bash
cd ai-service
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt   # Windows (Linux/macOS: .venv/bin/python)
cp .env.example .env              # set AI_SERVICE_TOKEN (same value in backend/.env); OPENAI_API_KEY optional
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
```

`requirements-dev.txt` includes `requirements.txt` plus pytest and flake8 (runtime only: `pip install -r requirements.txt`).

Verify: `curl http://localhost:8000/api/v1/health` → `{"status":"ok","service":"smart-project-manager-ai","llm":{"provider":"openai","configured":false,"model":null}}` (`configured: true` when a key is set). Then, signed in to the application, the home page shows "AI service · Python + FastAPI · local analyzer (no LLM key)" or "· OpenAI <model>". Swagger UI: `http://localhost:8000/docs`.

| Command (from `ai-service/`) | Purpose |
|---|---|
| `.venv/Scripts/python.exe -m pytest -q` | Tests (if the system temp folder is not writable, add `--basetemp <folder>`) |
| `.venv/Scripts/python.exe -m flake8 app tests` | Lint (flake8 is used because `ruff`'s binary was blocked by Windows application control on the development machine) |
| `.venv/Scripts/python.exe -m app.ml.task_type_model` | Re-train the task type classifier and print its cross-validation metrics (also done automatically when `app/ml/models/task_type.json` is missing or outdated) |
| `.venv/Scripts/python.exe -m app.ml.sprint_risk_model` | Re-train the sprint delay risk model (AI-03) and print its test metrics (also automatic when `app/ml/models/sprint_risk.json` is missing or outdated) |
| `.venv/Scripts/python.exe -m app.ml.sprint_risk_data` | Regenerate the synthetic sprint dataset `app/ml/data/sprint_risk.csv` (deterministic, seed 2026) |

The model file is generated and git-ignored; no Internet access is needed when `OPENAI_API_KEY` is empty.

### 3.4 Frontend

Prerequisites: **Node.js 22.22.3+ or 24.15+** (Angular CLI 22 refuses older versions: "The Angular CLI requires a minimum Node.js version of v22.22.3 or v24.15.0"; developed with 24), the backend running on port 3000.

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
