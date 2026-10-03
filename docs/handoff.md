# Handoff — resume the work (TASK 22 in progress)

> Written on 3 October 2026 (≈ 12:30 Tunis) by the previous agent (Claude Code), stopped by its usage limit.
> Read this file first, then the project context (README, `docs/bilan.md`, `docs/prompts.md` Part A). The original context prompt of the supervisor (fixed stack, rules, report format) still applies; it is summarized in `docs/prompts.md` § A.2.

## 1. Rules that must not be broken

- **Fixed stack**: Angular (TypeScript) · Node.js + Express in **JavaScript** (no TypeScript, no NestJS) · MongoDB + Mongoose · separate **Python + FastAPI** AI service, called **only by the backend** (never by the browser).
- **Secrets**: never hardcode, print or commit them. `backend/.env` and `ai-service/.env` exist (git-ignored) and share a generated `AI_SERVICE_TOKEN`: do not display their content. `OPENAI_API_KEY` is set by the supervisor in `ai-service/.env` only.
- **Shared local MongoDB** (`mongodb://localhost:27017`): use only the `smart_project_manager` database. **Never touch** `RH_Mrc_Survey`, `wasalli`, `wasalli-db`, `wasalli_db`. Manual checks use throwaway `@smoke.test` accounts, deleted afterwards.
- **Commits**: the supervisor commits by themselves (last commit `b84d344` "add task 21 first ia function"); the agent commits only when explicitly asked ("oui continuer" is not a commit consent). Everything listed in § 2.1–2.2 is **not committed yet**. The older sections of `docs/bilan.md` still say "aucun commit": correct them at the next bilan update.
- Validate inputs before MongoDB and AI output before persistence. Never claim a test passed without running it. Documentation must describe the real code.
- **Method**: one task at a time → implement, test, update `docs/`, run tests/build/lint, check for secrets, give the fixed English report (TASK STATUS … NEXT RECOMMENDED TASK), then **stop**.
- **After every task**: update `docs/bilan.md` (French) and give a short French summary (prompts, done, remaining). Keep `docs/prompts.md` Part A (one row per supervisor prompt, quoted verbatim, Tunis time) up to date.

## 2. Where we are

| Task | State |
|---|---|
| TASK 01–19 | Done (backend, Angular UI of every non-AI feature) |
| TASK 20 | Done — FastAPI service: settings, `X-AI-Service-Token`, error format identical to the backend, `GET /api/v1/health` |
| TASK 21 | Done — backend `aiClient.service.js` (timeouts, 503/504/502/400 mapping), `GET /api/v1/ai/status`, AI line on the Angular home page |
| **TASK 22** | **In progress** — AI-01 "Plan with AI": the manager pastes the specification and/or uploads a file; the AI proposes sprints + tasks; the manager reviews, edits, then applies |
| TASK 23–29 | Planned: 23 AI-02 developer recommendation, 24 AI-03 sprint delay risk, 25 AI-04 manager assistant chat (plan in `docs/bilan.md` § 7), 26 Docker, 27 demo data, 28 security + CI, 29 final report |

Supervisor choices for TASK 22 (prompt #22): **hybrid** (OpenAI + local fallback), **OpenAI**, **pasted text + files** (.txt/.md/.pdf/.docx), **review then validation** (nothing is created before the manager applies).

### 2.1 Done in TASK 22 — AI service (`ai-service/`, Python 3.14.8, venv `.venv`)

| File | Role |
|---|---|
| `app/ml/data/task_types.csv` | 155 hand-written FR/EN sentences labelled with the 7 task types (synthetic dataset) |
| `app/ml/lexicon.py`, `app/ml/text_classifier.py` | Pure-Python multinomial Naive Bayes (scikit-learn/scipy are blocked by Windows application control): words without stop words + one lexicon cue per type; unseen features ignored |
| `app/ml/task_type_model.py` | Train / save `app/ml/models/task_type.json` (git-ignored, retrained automatically when missing or outdated; `MODEL_VERSION = 3`, bump it when features change). **Metrics: stratified 5-fold CV accuracy 0.916, macro F1 0.921** (optimistic: synthetic data, lexicon written while looking at it; words-only baseline ≈ 0.48) |
| `app/services/text_extraction.py` | txt/md (UTF-8 or cp1252), pdf (pypdf), docx (python-docx: headings → `#`, lists → `-`, tables → `a \| b`); 415 / 422 errors |
| `app/services/requirement_parser.py` | Local analyzer step 1: headings → epics, list items, user stories FR/EN, tables (header mapping), requirement sentences, MoSCoW / points / days, context and out-of-scope sections skipped, acceptance criteria, dedupe, max 100, sentence fallback, 422 if nothing |
| `app/services/task_enricher.py` | Type (ML; BUG only if a correction is explicit), priority (explicit or keywords), complexity (Fibonacci, base per type + heavy topics), skills (team/project names + stack mapping + dictionary, max 5) |
| `app/services/sprint_planner.py` | Deterministic packing by priority then document order, capacity per sprint, max 20 sprints, "Won't have" → backlog, deadline warning |
| `app/prompts/project_plan.py`, `app/services/llm_client.py`, `app/schemas/llm.py` | OpenAI Chat Completions, structured outputs (strict JSON schema), temperature 0.2 (retried without it if the model refuses), errors → `LlmError` → local fallback with a warning |
| `app/services/planning_service.py`, `app/routes/planning.py` | `POST /api/v1/ai/documents/extract` (multipart `file`) and `POST /api/v1/ai/projects/plan` (JSON), both token-protected |
| `tests/` | **102 pytest tests pass**; `flake8 app tests` clean |

### 2.2 Done in TASK 22 — backend (`backend/`)

- Dependency **multer 2.4.0** (`npm audit --omit=dev`: 0 vulnerabilities).
- `src/middleware/upload.js` (memory storage, 5 MB, `.txt .md .pdf .docx`, 413/415, UTF-8 file names), `src/validators/aiPlan.validator.js` (`PLAN_LIMITS`), `src/services/aiPlan.service.js` (`generatePlan`: extract + plan, strict validation of the AI answer → 502, sprint numbering continues the existing sprints, default start date; `applyPlan`: all-or-nothing creation of PLANNED sprints + TODO tasks, one `AI_PLAN_APPLIED` activity), `src/controllers/aiPlan.controller.js`.
- Routes in `src/routes/project.routes.js`:
  - `POST /api/v1/projects/:id/ai/plan` — manager of a non-archived project; multipart or JSON; fields `text`, `file`, `startDate`, `sprintLengthDays` (5–30, default 14), `capacityPerSprint` (3–200, default 20). Returns `{ plan: { method, model, warnings, sprints[{name, objective, startDate, endDate, tasks[]}], backlog[], stats, options, source } }`; task = `{ title, description, type, priority, complexity, requiredSkills, epic }`. Nothing stored.
  - `POST /api/v1/projects/:id/ai/plan/apply` — body `{ method?, sprints[{ name, objective, startDate, endDate, tasks[] }], backlog[] }` → 201 `{ sprints, tasksCreated, backlogTasks }`. Max 20 sprints / 100 tasks. The `epic` is not stored on tasks (it only groups the review and fills the sprint objective).
- `src/models/activity.model.js`: new type `AI_PLAN_APPLIED` (details `{ sprints, tasks, method }`).
- `tests/aiPlan.test.js` (19 tests). **Backend: 325 tests pass, lint OK.**
- Root `.gitignore`: `ai-service/app/ml/models/` added.

## 3. What remains for TASK 22 (in this order)

1. **Frontend** (Angular 22, standalone, zoneless, signals, OnPush, Material 3, Vitest; follow the existing patterns):
   - `core/models/activity.ts`: add `AI_PLAN_APPLIED` to `ActivityType`, `ACTIVITY_TYPE_LABELS` ("AI plan applied") and `describeActivity` (e.g. `created 12 tasks in 3 sprints with the AI planner`); `ActivityDetails` gets `sprints?`, `tasks?`, `method?`; icon `auto_awesome` in `features/activity/activity-list/activity-list.ts`. Update the related specs.
   - `core/models/ai-plan.ts` (interfaces of the plan) and an `AiPlanService` (`generate` → `FormData` POST to `/api/v1/projects/:id/ai/plan`; `apply` → JSON POST to `.../ai/plan/apply`).
   - New child route of the project shell (`src/app/app.routes.ts`, next to `sprints`), e.g. `ai-plan`, reachable only when the project context says `canEdit` (see `features/projects/project-context.ts`); a **"Plan with AI"** button in `features/sprints/sprint-list/sprint-list.ts` when `canEdit`.
   - Page, step 1: textarea + file input (accept `.txt,.md,.pdf,.docx`, 5 MB) + start date, sprint length, capacity; shows the analyzer from `HealthService.checkAi()` ("OpenAI <model>" or "local analyzer") and states that **the document is sent to OpenAI when the LLM is enabled**; spinner (up to 90 s, `AI_TIMEOUT_MS`).
   - Step 2 (review): warnings, stats, one card per sprint (editable name, dates, objective), tasks editable (title, description, type, priority, complexity, skills with the existing `TagInput`), move a task to another sprint or to the backlog, delete; "Apply" → toast → navigate to the Sprints tab; "Back" keeps the input.
   - Vitest specs (service, page: validation, generate, edit, apply payload). Then `npm run test:ci`, `npm run lint`, `npm run format:check`, `npm run build` (initial bundle must stay < 500 kB: lazy-load the page).
2. **End-to-end check**: start the AI service (`cd ai-service && .venv/Scripts/python.exe -m uvicorn app.main:app --port 8000`), the backend (`cd backend && npm start`, port 3000 — the previous agent's background process was stopped), then with a `@smoke.test` manager: create a project, call plan (text and a .docx/.pdf file), apply, check sprints/tasks/activity, delete the test data. Without `OPENAI_API_KEY` only the local analyzer runs (the OpenAI path is covered by mocked tests only — say so).
3. **Docs** (must match the code):
   - `docs/ai.md`: AI-01 section (hybrid approach, local analyzer, dataset, features, metrics with the caveat, model file, planner rules, validation, errors, limits).
   - `docs/prompts.md` Part B: system prompt, user prompt (`<<<DOCUMENT … DOCUMENT>>>`), JSON schema, validation, errors, security (prompt injection, data sent to OpenAI, key only in `.env`). Part A: update the intro (now beyond TASK 19), add new prompts (#24 is the handoff request).
   - `docs/api.md` (2 backend routes + 2 AI service routes + `AI_PLAN_APPLIED`), `docs/architecture.md` (ai-service structure), `docs/deployment.md` (venv, `pip install -r requirements.txt -r requirements-dev.txt`, env vars, uvicorn, flake8 instead of ruff), `docs/testing.md` (counts and commands), `docs/requirements.md` (FR-15: AI-01 done), `docs/demo.md` (step 7), `docs/database.md` (activity type).
   - `README.md`: TASK 22 → Done, replace "AI service instructions will be added when it is implemented." with the real instructions.
4. **`docs/bilan.md`** full update (French) + final English report for TASK 20–22 in the fixed format + short French summary. Then **stop** (do not start TASK 23).

## 4. Useful commands (Windows, Git Bash)

| Goal | Command |
|---|---|
| AI tests / lint | `cd ai-service && .venv/Scripts/python.exe -m pytest -q` · `.venv/Scripts/python.exe -m flake8 app tests` |
| Retrain + metrics | `cd ai-service && .venv/Scripts/python.exe -m app.ml.task_type_model` |
| Backend | `cd backend && npm test` · `npm run lint` · `npm audit --omit=dev` |
| Frontend | `cd frontend && npm run test:ci` · `npm run lint` · `npm run format:check` · `npm run build` |
| Secret scan | search the tracked files for `sk-`, tokens, passwords; `git check-ignore -v backend/.env ai-service/.env` |

## 5. Pitfalls already met

- `ruff` and scipy DLLs are blocked by Windows application control → flake8 and the pure-Python classifier.
- Regexes edited through shell heredocs lost their backslashes: edit regex lines with the editor tool.
- The IDE reports "Could not resolve relative import" in `ai-service/app`: false positive (IDE root), the code runs and the tests pass.
- `ng serve` on 4200 may already be running (the supervisor's own): do not kill it.
- Frontend tests: use `RouterTestingHarness` once per test; Material harnesses with `MATERIAL_ANIMATIONS { animationsDisabled: true }`; the global 15 s timeout is in `src/app/testing/test-setup.ts`.
