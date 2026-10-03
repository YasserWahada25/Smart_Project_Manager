# Handoff — resume the work (next: TASK 23)

> Updated on 3 October 2026 (end of TASK 22) by the second agent (Claude Code). Read this file first, then the project context (README, `docs/bilan.md`, `docs/prompts.md` Part A). The original context prompt of the supervisor (fixed stack, rules, report format) still applies; it is summarized in `docs/prompts.md` § A.2.

## 1. Rules that must not be broken

- **Fixed stack**: Angular (TypeScript) · Node.js + Express in **JavaScript** (no TypeScript, no NestJS) · MongoDB + Mongoose · separate **Python + FastAPI** AI service, called **only by the backend** (never by the browser).
- **Secrets**: never hardcode, print or commit them. `backend/.env` and `ai-service/.env` are provided by the supervisor (git-ignored) and share `AI_SERVICE_TOKEN`: never display their content (checking variable **names** is fine). `OPENAI_API_KEY` is set by the supervisor in `ai-service/.env` only (currently empty → local analyzer).
- **Shared local MongoDB** (`mongodb://localhost:27017`): use only the `smart_project_manager` database. **Never touch** `RH_Mrc_Survey`, `wasalli`, `wasalli-db`, `wasalli_db`. Manual checks use throwaway `@smoke.test` accounts, deleted afterwards.
- **Commits**: the supervisor commits by themselves (last commit `a8470b0` "limit conversation"); the agent commits only when explicitly asked. **The end of TASK 22 is not committed** (list in `docs/livrables/TASK-22.md`).
- Validate inputs before MongoDB and AI output before persistence. Never claim a test passed without running it. Documentation must describe the real code.
- **Method**: one task at a time → implement, test, end-to-end check, update `docs/`, run tests/build/lint, check for secrets, give the fixed English report (TASK STATUS … NEXT RECOMMENDED TASK), then **stop**.
- **After every task**: update `docs/bilan.md` (French), add `docs/livrables/TASK-XX.md` (French: prompts at the origin quoted verbatim, delivered feature, new files, modified files, evidence, limits — same sections as `TASK-22.md`) and its line in `docs/livrables/README.md`, keep `docs/prompts.md` Part A (one row per supervisor prompt, quoted verbatim, Tunis time) up to date, and give a short French summary.

## 2. Where we are

| Task | State |
|---|---|
| TASK 01–19 | Done (backend, Angular UI of every non-AI feature) |
| TASK 20 | Done — FastAPI service: settings, `X-AI-Service-Token`, error format identical to the backend, `GET /api/v1/health` |
| TASK 21 | Done — backend `aiClient.service.js` (timeouts, 503/504/400/502 mapping), `GET /api/v1/ai/status`, AI line on the home page |
| TASK 22 | **Done** — AI-01 "Plan with AI": AI service (OpenAI or local analyzer + Naive Bayes), backend (plan / apply), Angular page (`features/ai-plan/`), end-to-end 17/17. Details: `docs/ai.md` § 4.1, `docs/livrables/TASK-22.md` |
| **TASK 23** | **Next** — AI-02 developer recommendation |
| TASK 24–29 | 24 AI-03 sprint delay risk (ML model + metrics), 25 AI-04 manager assistant chat (plan in `docs/bilan.md` § 7), 26 Docker, 27 demo data, 28 security + CI, 29 final report |

Counts: backend 325 tests, frontend 329, AI service 103. Initial frontend bundle 344.7 kB (budget 500 kB).

## 3. TASK 23 — AI-02 developer recommendation (suggested scope, to confirm with the supervisor if a choice is not obvious)

- Input: a task (`requiredSkills`, `complexity`, `type`) and the active project members (skills with `level` 1–4 and optional `yearsOfExperience`, open tasks / story points = workload, completed tasks with the same skills = experience). The backend gathers the data (AI service stays stateless).
- Approach: transparent scoring (skill match weighted by level, workload penalty, experience bonus) in the AI service, documented with its formula in `docs/ai.md`; output: ranked developers with `score` (0–100), matching / missing skills, short explanation.
- Backend: `GET` or `POST /api/v1/tasks/:id/ai/recommendations` (project viewers or manager only — decide), validate the AI answer; assignment stays a manager action (existing `PATCH /tasks/:id/assignee`).
- Angular: "Recommend a developer" on the task page (manager), list with scores and an "Assign" button.
- Tests (pytest, Jest, Vitest), end-to-end check, docs, bilan, livrable `TASK-23.md`.

## 4. Useful commands (Windows, Git Bash)

| Goal | Command |
|---|---|
| AI service | `cd ai-service && .venv/Scripts/python.exe -m uvicorn app.main:app --port 8000` |
| AI tests / lint | `.venv/Scripts/python.exe -m pytest -q --basetemp <scratch folder>` · `.venv/Scripts/python.exe -m flake8 app tests` |
| Retrain + metrics | `.venv/Scripts/python.exe -m app.ml.task_type_model` |
| Backend | `cd backend && npm test` · `npm run lint` · `npm audit --omit=dev` (the supervisor may already run `npm start` on port 3000: reuse it, do not kill it) |
| Frontend | `cd frontend && npm run test:ci` · `npm run lint` · `npm run format:check` · `npm run build` |
| Secret scan | search the tracked files for `sk-`, tokens, passwords; `git check-ignore -v backend/.env ai-service/.env` |

## 5. Pitfalls already met

- **Node version**: Angular CLI 22 needs Node ≥ 22.22.3 or ≥ 24.15. The supervisor's machine had 22.21.1: the agent ran `ng` with a portable Node 24 (`npm i node@24` in a scratch folder, then `PATH=<…>/node-win-x64/bin:$PATH node node_modules/@angular/cli/bin/ng.js …`). The supervisor should install Node 24 LTS.
- `npm ci` with npm 10 rewrites `frontend/package-lock.json` (removes `libc` fields): restore it with `git checkout -- frontend/package-lock.json` (the project uses npm 11).
- pytest may not write to the system temp folder from the sandbox: pass `--basetemp <scratch folder>`.
- `ruff` and scipy DLLs were blocked by Windows application control on the first machine → flake8 and the pure-Python classifier.
- Regexes edited through shell heredocs lost their backslashes; heredocs with quotes in them can break: edit regex lines with the editor tool, write long doc edits as a script file.
- The IDE reports "Could not resolve relative import" in `ai-service/app`: false positive.
- `ng serve` on 4200 may already be running (the supervisor's own): do not kill it.
- Frontend tests: `RouterTestingHarness` once per test; Material harnesses with `MATERIAL_ANIMATIONS { animationsDisabled: true }`; global 15 s timeout in `src/app/testing/test-setup.ts`; normalise whitespace before matching rendered text.
- Component style budget: 4 kB warning per component stylesheet.
