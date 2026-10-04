# Handoff — resume the work (next: TASK 26)

> Updated on 3 October 2026 (end of TASK 25, all AI features done) by the second agent (Claude Code). Read this file first, then the project context (README, `docs/bilan.md`, `docs/prompts.md` Part A). The original context prompt of the supervisor (fixed stack, rules, report format) still applies; it is summarized in `docs/prompts.md` § A.2.

## 1. Rules that must not be broken

- **Fixed stack**: Angular (TypeScript) · Node.js + Express in **JavaScript** (no TypeScript, no NestJS) · MongoDB + Mongoose · separate **Python + FastAPI** AI service, called **only by the backend** (never by the browser).
- **Secrets**: never hardcode, print or commit them. `backend/.env` and `ai-service/.env` are provided by the supervisor (git-ignored) and share `AI_SERVICE_TOKEN`: never display their content (checking variable **names** is fine). `OPENAI_API_KEY` is set by the supervisor in `ai-service/.env` only (currently empty → local analyzer).
- **Shared local MongoDB** (`mongodb://localhost:27017`): use only the `smart_project_manager` database. **Never touch** `RH_Mrc_Survey`, `wasalli`, `wasalli-db`, `wasalli_db`. Manual checks use throwaway `@smoke.test` accounts, deleted afterwards.
- **Commits**: the supervisor commits by themselves, sometimes while the agent works (last commit `3c420cb` "fix angular UI"); the agent commits only when explicitly asked. **Not committed yet**: the docs of TASK 23–25, `docs/livrables/TASK-23..25.md` and a typing fix of `frontend/src/app/features/ai-assistant/assistant-page/assistant-page.ts` (the committed version does not compile).
- Validate inputs before MongoDB and AI output before persistence. Never claim a test passed without running it. Documentation must describe the real code.
- **Method**: one task at a time → implement, test, end-to-end check, update `docs/`, run tests/build/lint, check for secrets, give the fixed English report (TASK STATUS … NEXT RECOMMENDED TASK), then **stop**.
- **After every task**: update `docs/bilan.md` (French), add `docs/livrables/TASK-XX.md` (French: prompts at the origin quoted verbatim, delivered feature, new files, modified files, evidence, limits — same sections as `TASK-22.md`) and its line in `docs/livrables/README.md`, keep `docs/prompts.md` Part A (one row per supervisor prompt, quoted verbatim, Tunis time) up to date, and give a short French summary.

## 2. Where we are

| Task | State |
|---|---|
| TASK 01–19 | Done (backend, Angular UI of every non-AI feature) |
| TASK 20–21 | Done — FastAPI service, backend AI gateway (`aiClient.service.js`), `GET /api/v1/ai/status` |
| TASK 22 | Done — AI-01 "Plan with AI" (OpenAI or local analyzer + Naive Bayes), `docs/livrables/TASK-22.md` |
| TASK 23 | Done — AI-02 developer recommendation (transparent scoring), `GET /tasks/:id/ai/recommendations`, task page dialog |
| TASK 24 | Done — AI-03 sprint delay risk (logistic regression on 2 000 simulated sprints), `GET /sprints/:id/ai/risk`, `app-sprint-risk` on active sprints |
| TASK 25 | Done — AI-04 manager assistant (OpenAI tools; writes are proposals confirmed by the manager), `POST /projects/:id/ai/assistant/chat` + `/actions`, "Assistant" tab |
| **TASK 26** | **Next** — Docker & Docker Compose |
| TASK 27–29 | 27 demo seed data and scenario, 28 security hardening (login rate limiting…) + GitHub Actions CI, 29 final documentation and technical report |

Counts: backend 357 tests, frontend 349, AI service 146. Initial frontend bundle 348.6 kB (budget 500 kB). No OpenAI key on the machine: AI-04 answers 503 `LLM_NOT_CONFIGURED`; AI-01 uses the local analyzer.

## 3. TASK 26 — Docker & Docker Compose (suggested scope)

- Prerequisite: **Docker Desktop started** (ask the supervisor; it was not running before).
- `backend/Dockerfile` (Node 22.22+/24 alpine, `npm ci --omit=dev`, non-root user, `node src/server.js`), `ai-service/Dockerfile` (python 3.12-slim, `pip install -r requirements.txt`, non-root, `uvicorn app.main:app --host 0.0.0.0 --port 8000`; the ML models are retrained at the first request — or train at build time), `frontend/Dockerfile` (multi-stage: `npm ci && npm run build` → nginx serving `dist/smart-project-manager/browser` with SPA fallback and a proxy of `/api` to the backend).
- `docker-compose.yml` at the root: `mongo` (volume, healthcheck), `ai-service`, `backend` (`MONGODB_URI=mongodb://mongo:27017/smart_project_manager`, `AI_SERVICE_URL=http://ai-service:8000`, `depends_on` healthy), `frontend` (port 8080 or 80); secrets from `.env` files (never baked into images), `.dockerignore` files; the AI service is **not** published on the host.
- Ports on the supervisor's machine: 3000 (their backend), 4200 (their `ng serve`), 27017 (their local MongoDB with other databases — never touch `RH_Mrc_Survey`, `wasalli*`): use other host ports or none for the compose services, or stop nothing of theirs.
- Verify: `docker compose up --build`, health of each service, the end-to-end scenario through nginx, `create-admin` in the container; document in `docs/deployment.md` § 4; graceful shutdown on SIGTERM (not verified yet on Windows).

## 4. Useful commands (Windows, Git Bash)

| Goal | Command |
|---|---|
| AI service | `cd ai-service && .venv/Scripts/python.exe -m uvicorn app.main:app --port 8000` |
| AI tests / lint | `.venv/Scripts/python.exe -m pytest -q --basetemp <scratch folder>` · `.venv/Scripts/python.exe -m flake8 app tests` |
| Retrain + metrics | `.venv/Scripts/python.exe -m app.ml.task_type_model` · `.venv/Scripts/python.exe -m app.ml.sprint_risk_model` (regenerate the AI-03 dataset: `-m app.ml.sprint_risk_data`) |
| Backend | `cd backend && npm test` · `npm run lint` · `npm audit --omit=dev` (the supervisor runs their own backend on 3000: for end-to-end checks of new code start another instance, e.g. `PORT=3001 node src/server.js`) |
| Frontend | `cd frontend && npm run test:ci` · `npm run lint` · `npm run format:check` · `npm run build` |
| Secret scan | search the tracked files for `sk-`, tokens, passwords; `git check-ignore -v backend/.env ai-service/.env` |

## 5. Pitfalls already met

- **Node version**: Angular CLI 22 needs Node ≥ 22.22.3 or ≥ 24.15; the supervisor upgraded to 22.22.3 during TASK 23.
- `npm ci` with npm 10 rewrites `frontend/package-lock.json` (removes `libc` fields): restore it with `git checkout -- frontend/package-lock.json` (the project uses npm 11).
- pytest may not write to the system temp folder from the sandbox: pass `--basetemp <scratch folder>`.
- `ruff` and scipy DLLs were blocked by Windows application control on the first machine → flake8 and the pure-Python classifier.
- Regexes edited through shell heredocs lost their backslashes; heredocs with quotes in them can break: edit regex lines with the editor tool, write long doc edits as a script file.
- The IDE reports "Could not resolve relative import" in `ai-service/app`: false positive.
- `ng serve` on 4200 may already be running (the supervisor's own): do not kill it.
- Frontend tests: `RouterTestingHarness` once per test; Material harnesses with `MATERIAL_ANIMATIONS { animationsDisabled: true }`; global 15 s timeout in `src/app/testing/test-setup.ts`; normalise whitespace before matching rendered text.
- Component style budget: 4 kB warning per component stylesheet.
- AI-04 without a key: test the loop with the simulated OpenAI approach of TASK 25 (a local HTTP server answering `/v1/chat/completions`, a second AI service started with `OPENAI_API_KEY=sk-mock-local OPENAI_BASE_URL=http://localhost:8090/v1`, a backend with `AI_SERVICE_URL` pointing to it) — environment variables override `ai-service/.env`.
- Started sprints cannot be deleted through the API: clean end-to-end data with mongosh, **only in `smart_project_manager`** and only for the `@smoke.test` accounts' projects.
