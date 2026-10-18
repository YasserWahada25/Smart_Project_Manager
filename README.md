<p align="center">
  <img src="frontend/public/logo.png" alt="Smart Manager logo" width="140">
</p>

<h1 align="center">Smart Manager</h1>

<p align="center">
  <strong>Intelligent software project management platform</strong><br>
  Mini project — module <em>AI for Software Engineering</em>
</p>

Smart Manager is a web platform that helps agile software teams manage their projects, teams, sprints, tasks, deadlines and workload. **Five AI features** assist the team: they generate the sprints and tasks from the specification, recommend the right developer for a task, predict the delay risk of a sprint, answer the manager's questions and propose changes, and write the retrospective of each completed sprint.

<<<<<<< HEAD
> **Project status:** the Express.js REST API and the Angular frontend cover every non-AI feature (authentication, users, profiles & skills, projects & teams, sprints, tasks & Kanban, comments, activity history, notifications, dashboards, search). The **FastAPI AI service** provides the four AI features: **AI-01 "Plan with AI"** (specification → sprints and tasks reviewed by the manager; OpenAI or a local analyzer with a Naive Bayes classifier), **AI-02** developer recommendation (transparent scoring), **AI-03** sprint delay risk (logistic regression) and **AI-04** manager assistant (OpenAI with tools; changes applied only after confirmation). Next: delivery (Docker, demo data, security and CI, final report).
> See [Development progress](#development-progress) for what is actually implemented.
=======
**Team:** Ayoub Amiri · Med Rayen Jbili · Balkis Saidi · Nihel Hassad · Yasser Wahada

> **Status:** every functional requirement and the five AI features are implemented and tested (944 automated tests). Remaining: Docker, demo data, CI. See [Roadmap](#roadmap).
>>>>>>> 1703821937e40442e522b5f7a255b6c3c63d056b

---

## Features

| Area | What users can do |
|------|-------------------|
| Accounts | Sign up as a developer or project manager, sign in (JWT), role-based access; administrators manage accounts and roles |
| Profile & skills | Edit their information and password, manage their skills (name, level, years of experience) |
| Projects & teams | Create, edit, archive projects with a status lifecycle; build the team from a developer directory searchable by skill |
| Sprints | Plan, start, complete or cancel sprints (one active sprint per project), progress in story points |
| Tasks & Kanban | Create and assign tasks, move them through the workflow (TODO → IN_PROGRESS → CODE_REVIEW → TESTING → DONE, or BLOCKED), drag and drop on the Kanban board |
| Collaboration | Comments on tasks, activity history of projects and tasks, notifications with an unread counter |
| Dashboards & search | Global and project dashboards (Chart.js), team workload, global search and a Ctrl+K command palette |
| Interface | Angular Material 3 in the logo colours, light / dark / system theme, task side panel, keyboard accessible |

## AI features

| ID | Feature | Where | Approach |
|----|---------|-------|----------|
| **AI-01** | Planning from the specification | "Plan with AI" tab of a project | The LLM turns a pasted or uploaded specification (`.txt`, `.md`, `.pdf`, `.docx`) into epics, tasks and sprints; a local analyzer with a **Naive Bayes** classifier takes over without a key. The manager reviews everything before creation |
| **AI-02** | Developer recommendation | "Recommend a developer" on a task | Transparent **score** (skills 60 %, workload 25 %, experience 15 %) with an explanation per developer |
| **AI-03** | Sprint delay risk | Active sprints, dashboards, home page | **Logistic regression** on 7 sprint measures (ROC AUC 0.934 on simulated data): level, probability and causes |
| **AI-04** | Manager assistant | "Assistant" tab and floating "Ask AI" button | LLM with **9 tools**: reads the project data, and every change it prepares is applied only after the manager confirms; the conversation is saved |
| **AI-05** | Sprint retrospective | Opens when a sprint is completed; "Retrospective" button | Figures computed by code, text written by the LLM in the language of the tasks (rules without a key); actions become tasks in one click |

The LLM is **Google Gemini** (`gemini-3.5-flash-lite`) through the OpenAI-compatible API, so the provider can be changed by configuration (OpenAI, Groq, Ollama…). AI-01 and AI-05 keep working without a key. Details: [docs/ai.md](docs/ai.md), prompts: [docs/prompts.md](docs/prompts.md).

## Team and responsibilities

| Student | Functional requirements | AI feature |
|---------|-------------------------|------------|
| Ayoub Amiri | Authentication, user management, profiles, developer skills | AI-02 Developer recommendation |
| Yasser Wahada | Projects, teams | AI-01 Planning from the specification |
| Nihel Hassad | Sprints, dashboards | AI-03 Sprint delay risk |
| Balkis Saidi | Tasks, Kanban board, comments | AI-04 Manager assistant |
| Med Rayen Jbili | Activity history, notifications, search | AI-05 Sprint retrospective |

## Technology stack

| Layer | Technology |
|-------|------------|
| Frontend | Angular 22 (TypeScript, standalone components, signals), Angular Material 3, CDK, Chart.js |
| Backend | Node.js + Express 5 (JavaScript), REST API, express-validator, JWT, bcrypt, helmet |
| Database | MongoDB 7+ with Mongoose 9 |
| AI service | Python 3.12 + FastAPI, Pydantic 2, pure-Python ML models, OpenAI-compatible LLM client |
| Tests & quality | Vitest, Jest + Supertest + in-memory MongoDB, pytest; ESLint, Prettier, flake8 |
| DevOps | Git, GitHub (Docker and Docker Compose planned) |

## Architecture

```
            Browser
               │  HTTP
               ▼
     Angular frontend (port 4200)
               │  REST /api/v1 + JWT
               ▼
     Express backend (port 3000) ───────────► MongoDB (port 27017)
               │  HTTP + X-AI-Service-Token
               ▼
     FastAPI AI service (port 8000) ────────► LLM: Google Gemini (HTTPS)
       prompts · ML models · rules
```

- The Angular frontend talks **only** to the Express backend.
- The backend is the only component that reads and writes MongoDB and calls the AI service; it validates every input, including the AI answers.
- The AI service never touches the database; it holds the prompts, the ML models and the LLM key.

Details: [docs/architecture.md](docs/architecture.md) and chapter 4 of the technical report (logical and physical architecture).

## Repository structure

```
.
<<<<<<< HEAD
├── frontend/          Angular application          (all screens, incl. "Plan with AI")
├── backend/           Express.js REST API           (all features + AI gateway)
├── ai-service/        FastAPI AI service            (health, AI-01 planning, AI-02 recommendation, AI-03 risk model, AI-04 assistant)
├── docs/              Project documentation
├── docker-compose.yml Docker orchestration          (not created yet)
├── .env.example       Environment variable template
=======
├── frontend/      Angular application (all screens and the AI screens)
├── backend/       Express.js REST API (62 routes, AI gateway)
├── ai-service/    FastAPI AI service (AI-01 to AI-05, ML models)
├── docs/          Documentation, deliverables and Word reports
>>>>>>> 1703821937e40442e522b5f7a255b6c3c63d056b
├── .gitignore
└── README.md
```

<<<<<<< HEAD
Folders are created by the task that needs them.

## Prerequisites

| Tool             | Version used / required                     |
|------------------|---------------------------------------------|
| Node.js          | 22.22.3+ or 24.15+ for the frontend (backend: 20.19+); developed with 24.16.0 |
| npm              | 10+ (developed with 11.13.0)                 |
| Angular CLI      | 22.x (needs Node.js 22.22.3+ or 24.15+)      |
| Python           | 3.11+ (developed with 3.14.8, checked with 3.12.5) |
| MongoDB          | 7+ (local install or Docker)                 |
| Docker / Compose | Docker 29+ (required from the Docker task)   |

=======
>>>>>>> 1703821937e40442e522b5f7a255b6c3c63d056b
## Getting started

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 22.22.3+ or 24.15+ (Angular 22 requirement) |
| npm | 10+ |
| Python | 3.11+ (checked with 3.12) |
| MongoDB | 7+ (local install or Docker), running on port 27017 |

Each service has its own `.env` file, created from `.env.example` and **never committed**.

### 1. AI service (FastAPI, port 8000)

```bash
cd ai-service
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt   # Linux/macOS: .venv/bin/python
cp .env.example .env    # AI_SERVICE_TOKEN; for the LLM: OPENAI_BASE_URL, OPENAI_MODEL, OPENAI_API_KEY
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
```

Generate the shared token with `python -c "import secrets; print(secrets.token_hex(32))"` and put it in **both** `ai-service/.env` and `backend/.env`. For Google Gemini: `OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/` and `OPENAI_MODEL=gemini-3.5-flash-lite` (other providers in `ai-service/.env.example`). Check: `GET http://localhost:8000/api/v1/health`.

### 2. Backend (Express, port 3000)

```bash
cd backend
npm ci
cp .env.example .env    # JWT_SECRET, AI_SERVICE_TOKEN (same value), MONGODB_URI if needed
npm run create-admin    # optional: first administrator from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev
```

Generate a `JWT_SECRET` with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Check: `GET http://localhost:3000/api/v1/health`.

### 3. Frontend (Angular, port 4200)

```bash
cd frontend
npm ci
npm start               # http://localhost:4200 (forwards /api to the backend)
```

Open http://localhost:4200, create an account (developer or project manager) or sign in with the administrator.

### Useful scripts

<<<<<<< HEAD
### AI service (FastAPI)

Called only by the backend. Requires Python 3.11+.

```bash
cd ai-service
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt   # Linux/macOS: .venv/bin/python
cp .env.example .env    # set AI_SERVICE_TOKEN (same value in backend/.env); OPENAI_API_KEY is optional
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
```

Generate the shared token with `python -c "import secrets; print(secrets.token_hex(32))"` and put it in **both** `ai-service/.env` and `backend/.env` (`AI_SERVICE_TOKEN`). Without `OPENAI_API_KEY`, the local analyzer is used and no data leaves your machine. The LLM can be OpenAI or any OpenAI-compatible provider (Google Gemini with a free key, Groq, Ollama…): set `OPENAI_BASE_URL` and `OPENAI_MODEL` accordingly (examples in `ai-service/.env.example`).

Check it is running: `GET http://localhost:8000/api/v1/health` → `200 {"status":"ok", ...}`; the home page of the application then shows the AI service as operational. Project managers find **Plan with AI** on the Sprints tab of their projects.

| Command (from `ai-service/`) | Purpose |
|-------------------------|---------|
| `.venv/Scripts/python.exe -m pytest -q` | Tests (pytest, OpenAI mocked) |
| `.venv/Scripts/python.exe -m flake8 app tests` | Lint |
| `.venv/Scripts/python.exe -m app.ml.task_type_model` | Re-train the task type classifier and print its metrics |

Details: [docs/deployment.md](docs/deployment.md#33-ai-service-fastapi), [docs/ai.md](docs/ai.md).
=======
| Where | Command | Purpose |
|-------|---------|---------|
| backend | `npm run dev` / `npm start` | API with auto-restart / without |
| backend | `npm test`, `npm run lint` | Jest tests (in-memory MongoDB), ESLint |
| frontend | `npm start`, `npm run build` | Dev server, production build |
| frontend | `npm run test:ci`, `npm run lint`, `npm run format` | Vitest, ESLint (incl. accessibility rules), Prettier |
| ai-service | `.venv/Scripts/python.exe -m pytest` | Tests (LLM mocked) |
| ai-service | `.venv/Scripts/python.exe -m flake8 app tests` | Lint |
| ai-service | `.venv/Scripts/python.exe -m app.ml.task_type_model` / `app.ml.sprint_risk_model` | Re-train the ML models and print their metrics |
>>>>>>> 1703821937e40442e522b5f7a255b6c3c63d056b

More: [docs/deployment.md](docs/deployment.md).

## Tests

| Component | Tests |
|-----------|-------|
| Frontend (Vitest) | 386 |
| Backend (Jest) | 377 |
| AI service (pytest) | 181 |
| **Total** | **944**, all passing |

The backend tests use an in-memory MongoDB and a mocked AI service; the AI service tests mock the LLM. End-to-end runs against the real database and Gemini are recorded in [docs/testing.md](docs/testing.md).

## Deliverables

<<<<<<< HEAD
| Task    | Scope                                                        | Status |
|---------|--------------------------------------------------------------|--------|
| TASK 06 | Project & team API (project CRUD, statuses, members, developer directory) | Done |
| TASK 07 | Sprint API (sprint CRUD per project, status lifecycle, one active sprint) | Done |
| TASK 08 | Task & Kanban API (task CRUD, assignment, workflow transitions, filters, board, my tasks) | Done |
| TASK 09 | Comments & activity history API | Done |
| TASK 10 | Notifications API | Done |
| TASK 11 | Dashboard & global search API | Done |

### Phase 3 — Angular frontend

| Task    | Scope                                                        | Status |
|---------|--------------------------------------------------------------|--------|
| TASK 12 | Angular setup (project, routing, layout, Angular Material, environments, HTTP & error interceptors) | Done |
| TASK 13 | Authentication UI (login, register, guards, session handling) | Done |
| TASK 14 | Profile, skills & user administration UI | Done |
| TASK 15 | Projects & team UI | Done |
| TASK 16 | Sprints & tasks UI | Done |
| TASK 17 | Kanban board UI | Done |
| TASK 18 | Comments, activity & notifications UI | Done |
| TASK 19 | Dashboard UI (Chart.js) & search UI | Done |

### Phase 4 — AI service (Python / FastAPI) — requires Python 3.11+

| Task    | Scope                                                        | Status |
|---------|--------------------------------------------------------------|--------|
| TASK 20 | FastAPI AI service setup (structure, health, service token, Pydantic, pytest) | Done |
| TASK 21 | Backend ↔ AI gateway (HTTP client, timeouts, error handling, AI status) | Done |
| TASK 22 | AI-01 Sprint & task planning from the specification (OpenAI + local analyzer fallback, complexity estimation, review then apply, UI) | Done |
| TASK 23 | AI-02 Developer recommendation (scoring, endpoint, backend route, UI) | Done |
| TASK 24 | AI-03 Sprint delay risk prediction (dataset, ML model, metrics, endpoint, backend route, UI) | Done |
| TASK 25 | AI-04 Manager assistant chat (OpenAI tool calling on the project data, changes applied only after the manager confirms, sprint summary) | Done |

### Phase 5 — Delivery

| Task    | Scope                                                        | Status |
|---------|--------------------------------------------------------------|--------|
| TASK 26 | Docker & Docker Compose (all services + MongoDB) | Planned |
| TASK 27 | Demo seed data & demonstration scenario | Planned |
| TASK 28 | Security hardening (login rate limiting…) & CI with GitHub Actions | Planned |
| TASK 29 | Final documentation & technical report | Planned |

## Documentation

| Document                                         | Content                                          |
|--------------------------------------------------|--------------------------------------------------|
| [docs/requirements.md](docs/requirements.md)     | Context, objectives, actors, functional and non-functional requirements |
| [docs/architecture.md](docs/architecture.md)     | Functional and technical architecture            |
| [docs/database.md](docs/database.md)             | MongoDB design (collections, schemas, indexes)   |
| [docs/api.md](docs/api.md)                       | REST API reference                               |
| [docs/ai.md](docs/ai.md)                         | AI features, ML models                           |
| [docs/prompts.md](docs/prompts.md)               | Part A: development prompts between the supervisor and the AI agents (in French); Part B: LLM prompts of the application (AI-01) |
| [docs/testing.md](docs/testing.md)               | Test strategy and results                        |
| [docs/deployment.md](docs/deployment.md)         | Environment, Docker, deployment                  |
| [docs/demo.md](docs/demo.md)                     | Functional demonstration scenario                |
| [docs/bilan.md](docs/bilan.md)                   | Progress report, updated after each task, and log of the supervisor ↔ AI agent exchanges (in French) |
| [docs/handoff.md](docs/handoff.md)               | Resume point for the next agent: rules, current state, next task, commands, pitfalls |
| [docs/livrables/](docs/livrables/README.md)      | One deliverable per task (in French): files added / modified and the supervisor prompts that led to the feature |
=======
| Deliverable | Where |
|-------------|-------|
| Technical report (architecture, frameworks, API, AI models, prompts, contribution of each student) | [docs/Smart_Manager_Rapport_Technique.docx](docs/Smart_Manager_Rapport_Technique.docx) |
| Prompts and AI models | [docs/Smart_Manager_Prompts_et_Modeles_IA.docx](docs/Smart_Manager_Prompts_et_Modeles_IA.docx) |
| Demonstration scenario | [docs/demo.md](docs/demo.md) |
| One deliverable per task (files and prompts behind each feature, in French) | [docs/livrables/](docs/livrables/README.md) |

## Documentation

| Document | Content |
|----------|---------|
| [docs/requirements.md](docs/requirements.md) | Context, actors, functional and non-functional requirements |
| [docs/architecture.md](docs/architecture.md) | Functional and technical architecture |
| [docs/database.md](docs/database.md) | MongoDB design (9 collections, schemas, indexes) |
| [docs/api.md](docs/api.md) | REST API reference and internal AI service API |
| [docs/ai.md](docs/ai.md) | The five AI features, data, models, metrics |
| [docs/prompts.md](docs/prompts.md) | Part A: development prompts (in French); Part B: LLM prompts of AI-01, AI-04 and AI-05 |
| [docs/testing.md](docs/testing.md) | Test strategy and results |
| [docs/deployment.md](docs/deployment.md) | Environment variables and local deployment |
| [docs/demo.md](docs/demo.md) | Step-by-step demonstration |
| [docs/bilan.md](docs/bilan.md) | Progress report (in French) |
>>>>>>> 1703821937e40442e522b5f7a255b6c3c63d056b

## Roadmap

| Phase | Content | Status |
|-------|---------|--------|
| 1–2. Backend | Express API: authentication, users, profiles, projects, sprints, tasks, Kanban, comments, history, notifications, dashboards, search (TASK 01–11) | Done |
| 3. Frontend | Angular screens for every feature (TASK 12–19), then UX improvements (UX-1 to UX-7) | Done |
| 4. AI | FastAPI service and gateway (TASK 20–21), AI-01 to AI-04 (TASK 22–25), AI-05 | Done |
| 5. Delivery | Technical report and AI deliverable | Done |
| 5. Delivery | Docker & Docker Compose (TASK 26), demo data (TASK 27), security hardening & CI (TASK 28) | Planned |

## Conventions

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/), e.g. `feat(ai): add sprint retrospective`.
- **Branch:** `main`.
- **Secrets:** never committed; configuration comes from environment variables (`.env`, git-ignored).
- **Documentation:** reflects the real implementation; planned items are marked as planned.
