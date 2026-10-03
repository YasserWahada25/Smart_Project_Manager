# Smart Project Manager

**Intelligent Software Project Management Platform**

University mini-project — *AI for Software Engineering*.

Smart Project Manager is a web platform that helps software teams manage projects, teams, sprints, tasks, priorities, deadlines and workload. An AI module assists the team with automatic task generation, developer recommendation and sprint delay-risk prediction.

> **Project status:** the Express.js REST API and the Angular frontend cover every non-AI feature (authentication, users, profiles & skills, projects & teams, sprints, tasks & Kanban, comments, activity history, notifications, dashboards, search). The **FastAPI AI service** runs the first AI feature, **AI-01 "Plan with AI"**: the manager pastes or uploads the specification, the AI (OpenAI, or a local analyzer with a Naive Bayes classifier) proposes the sprints and tasks, the manager reviews them and applies the plan. Next: AI-02 developer recommendation, AI-03 sprint delay risk, AI-04 manager assistant, then delivery (Docker, demo data, CI).
> See [Development progress](#development-progress) for what is actually implemented.

---

## Technology stack (fixed)

| Layer       | Technology                                   |
|-------------|----------------------------------------------|
| Frontend    | Angular (TypeScript)                         |
| Backend     | Node.js + Express.js (JavaScript), REST API  |
| Database    | MongoDB + Mongoose                           |
| Auth        | JWT                                          |
| AI service  | Python + FastAPI                             |
| DevOps      | Git, GitHub, Docker, Docker Compose          |

## Architecture

```
                 USER
                   |
                   v
           Angular Frontend
                   |
               REST API
                   |
                   v
          Express.js Backend (Node.js)
                   |
          +--------+--------+
          |                 |
          v                 v
       MongoDB         AI Service
       (Mongoose)      (Python / FastAPI)
                            |
                  +---------+---------+
                  v                   v
          Machine Learning          LLM
           (if required)       (if required)
```

- The Angular frontend talks **only** to the Express backend.
- The Express backend is the main API and the only component that reads/writes MongoDB.
- The Express backend calls the FastAPI AI service when an AI operation is needed.

Details: [docs/architecture.md](docs/architecture.md).

## Repository structure

```
.
├── frontend/          Angular application          (all screens, incl. "Plan with AI")
├── backend/           Express.js REST API           (all features + AI gateway)
├── ai-service/        FastAPI AI service            (health, AI-01 planning)
├── docs/              Project documentation
├── docker-compose.yml Docker orchestration          (not created yet)
├── .env.example       Environment variable template
├── .gitignore
└── README.md
```

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

## Getting started

```bash
git clone <repository-url>
cd smart-project-manager
```

### Backend (Express.js)

Requires a running MongoDB instance (local install or Docker).

```bash
cd backend
npm install
cp .env.example .env    # set JWT_SECRET, adjust MONGODB_URI if needed (never commit .env)
npm run dev             # or: npm start
```

Generate a `JWT_SECRET` with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

Check it is running: `GET http://localhost:3000/api/v1/health` → `200 {"status":"ok", ...}`.

| Script                  | Purpose |
|-------------------------|---------|
| `npm start`             | Start the API |
| `npm run dev`           | Start with auto-restart on file changes (`node --watch`) |
| `npm test`              | Run the Jest test suite (uses an in-memory MongoDB, no local DB needed; the first `npm install` downloads its binary, ~800 MB on Windows) |
| `npm run test:coverage` | Tests with coverage report |
| `npm run lint`          | ESLint |
| `npm run create-admin`  | Create the first `ADMIN` account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` (idempotent) |

### Frontend (Angular)

Requires the backend running on port 3000 (the dev server forwards `/api` to it).

```bash
cd frontend
npm install
npm start               # http://localhost:4200
```

Open http://localhost:4200: you are sent to the sign-in page. Create an account on **Create an account** (developer or project manager), or sign in with the administrator created by `npm run create-admin`. The home page then shows the status of the frontend, the backend API and MongoDB. Every user edits their information, skills and password on **My profile**; administrators manage the accounts on **Users**. Project managers create projects on **Projects** and build their team from the developer directory (search by name or skill); each project has tabs for its sprints, tasks, Kanban board, activity and dashboard. Developers find their work in **My tasks**; everyone has a **Dashboard**, **Notifications** (bell in the toolbar) and the global **search**.

| Script                  | Purpose |
|-------------------------|---------|
| `npm start`             | Dev server with live reload and `/api` proxy to the backend |
| `npm run build`         | Production build (`dist/smart-project-manager/`) |
| `npm test` / `npm run test:ci` | Unit tests (Vitest), watch mode / single run |
| `npm run lint`          | ESLint (angular-eslint, incl. template accessibility rules) |
| `npm run format`        | Prettier |

### AI service (FastAPI)

Called only by the backend. Requires Python 3.11+.

```bash
cd ai-service
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt   # Linux/macOS: .venv/bin/python
cp .env.example .env    # set AI_SERVICE_TOKEN (same value in backend/.env); OPENAI_API_KEY is optional
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
```

Generate the shared token with `python -c "import secrets; print(secrets.token_hex(32))"` and put it in **both** `ai-service/.env` and `backend/.env` (`AI_SERVICE_TOKEN`). Without `OPENAI_API_KEY`, the local analyzer is used and no data leaves your machine.

Check it is running: `GET http://localhost:8000/api/v1/health` → `200 {"status":"ok", ...}`; the home page of the application then shows the AI service as operational. Project managers find **Plan with AI** on the Sprints tab of their projects.

| Command (from `ai-service/`) | Purpose |
|-------------------------|---------|
| `.venv/Scripts/python.exe -m pytest -q` | Tests (pytest, OpenAI mocked) |
| `.venv/Scripts/python.exe -m flake8 app tests` | Lint |
| `.venv/Scripts/python.exe -m app.ml.task_type_model` | Re-train the task type classifier and print its metrics |

Details: [docs/deployment.md](docs/deployment.md#33-ai-service-fastapi), [docs/ai.md](docs/ai.md).

## Development progress

The project is developed **task by task**. Only tasks marked **Done** exist in the repository; the others are the plan.

### Phase 1 — Backend foundation

| Task    | Scope                                                        | Status |
|---------|--------------------------------------------------------------|--------|
| TASK 01 | Repository initialization (Git, root config, documentation skeleton) | Done   |
| TASK 02 | Backend setup (Express.js skeleton, MongoDB connection, health endpoint, error handling, tests) | Done   |
| TASK 03 | Authentication API (User model, register/login/me, JWT, authenticate & authorize middleware, validation) | Done   |
| TASK 04 | User management API (admin bootstrap CLI, list/search/filter users, activate/deactivate, change role) | Done   |
| TASK 05 | Profile & skills API (view/update own profile, change password with token invalidation, manage skills) | Done   |

### Phase 2 — Backend business features

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
| TASK 23 | AI-02 Developer recommendation (scoring, endpoint, backend route, UI) | Planned |
| TASK 24 | AI-03 Sprint delay risk prediction (dataset, ML model, metrics, endpoint, backend route, UI) | Planned |
| TASK 25 | AI-04 Manager assistant chat (OpenAI tool calling on the project data, changes applied only after the manager confirms, sprint summary) | Planned |

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

### Technical report mapping

The final technical report is built from these documents:

| Report chapter                                        | Source |
|-------------------------------------------------------|--------|
| 1–7. Introduction, context, problem, objectives, requirements, actors | `requirements.md` |
| 8–11. Functional, technical, Angular, Express architecture | `architecture.md` |
| 12. MongoDB database design                           | `database.md` |
| 13. FastAPI AI architecture, 15. AI models            | `architecture.md`, `ai.md` |
| 14. REST API documentation                            | `api.md` |
| 16. LLM prompts                                       | `prompts.md` (part B; part A documents how the project was developed with an AI agent) |
| 17. Security                                          | `requirements.md`, `architecture.md` |
| 18. Testing                                           | `testing.md` |
| 19. Docker and deployment                             | `deployment.md` |
| 20–21. Functional demonstration, results              | `demo.md` |
| 22–24. Limitations, future improvements, conclusion   | All documents (written at the end) |

## Conventions

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) — e.g. `feat(auth): implement JWT authentication`, `test(tasks): add task API tests`, `docs(api): document task endpoints`.
- **Branch:** `main`.
- **Secrets:** never committed. Configuration comes from environment variables (`.env`, git-ignored).
- **Documentation:** always reflects the real implementation; planned items are explicitly marked as planned.
