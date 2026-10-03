# Functional Demonstration

> Current state: the application opens in a browser (`http://localhost:4200`): sign up, sign in, sign out, the home page (live status of frontend, backend and MongoDB), **My profile** (personal information, skills, password) and, for administrators, **Users** (account administration) work, as well as **Projects** (list, creation, project page, status, team built from the developer directory). **Sprint, task and Kanban screens do not exist yet.** Steps 1–6 and 10 are implemented in the REST API and were verified end-to-end through HTTP calls; AI steps 7–9 are not implemented.
> Rule: the demo only uses functionality that actually exists. A step is marked *Available* only after it has been implemented and verified.

## 1. Target scenario

| # | Step | Status |
|---|------|--------|
| 1 | Login | Implemented (UI `/login` + API), verified by automated tests and HTTP checks through the dev proxy |
| 2 | Create a project | Implemented (UI **Projects → New project** + API), verified by automated tests and HTTP checks through the dev proxy |
| 3 | Add developers | Implemented (UI: project page → **Add developers**, search by name or skill + API), verified by automated tests and HTTP checks through the dev proxy |
| 4 | Create a sprint | API ready (`POST /api/v1/projects/:id/sprints`, `PATCH /api/v1/sprints/:id/status`); UI planned |
| 5 | Create/manage tasks | API ready (`/api/v1/projects/:id/tasks`, `/api/v1/tasks/:id`); UI planned |
| 6 | Use the Kanban board | API ready (`GET /api/v1/projects/:id/board`, `PATCH /api/v1/tasks/:id/status`); UI planned |
| 7 | Generate tasks using AI (AI-01) | Not available |
| 8 | Get a developer recommendation (AI-02) | Not available |
| 9 | Predict sprint delay risk (AI-03) | Not available |
| 10 | View dashboard analytics | API ready (`GET /api/v1/dashboard`, `GET /api/v1/projects/:id/dashboard`); charts UI planned |

## 2. Demo data

Available now:

- Administrator: `npm run create-admin` (see [deployment.md](deployment.md#32-create-the-first-administrator)).
- Project manager and developers: public registration (`/register` page or `POST /api/v1/auth/register`).
- Developers enter their skills on **My profile** (`/profile`); the developer directory filters on them (API ready, UI in TASK 15).
- The administrator can change roles and deactivate accounts on **Users** (`/admin/users`).

A full demo seed (projects, sprints, tasks) will be defined once those models exist.

## 3. Detailed demo steps

To be written when the features exist.
