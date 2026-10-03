# Functional Demonstration

> Current state: the application opens in a browser (`http://localhost:4200`): sign up, sign in, sign out, the home page (live status of frontend, backend and MongoDB), **My profile** (personal information, skills, password) and, for administrators, **Users** (account administration) work, as well as **Projects** (list, creation, project page, status, team built from the developer directory). Sprints, tasks, the Kanban board, comments, history, notifications, dashboards and search work too. **Steps 1–6 and 10 can be shown in the browser**; AI steps 7–9 are not implemented.
> Rule: the demo only uses functionality that actually exists. A step is marked *Available* only after it has been implemented and verified.

## 1. Target scenario

| # | Step | Status |
|---|------|--------|
| 1 | Login | Implemented (UI `/login` + API), verified by automated tests and HTTP checks through the dev proxy |
| 2 | Create a project | Implemented (UI **Projects → New project** + API), verified by automated tests and HTTP checks through the dev proxy |
| 3 | Add developers | Implemented (UI: project page → **Add developers**, search by name or skill + API), verified by automated tests and HTTP checks through the dev proxy |
| 4 | Create a sprint | Implemented (UI: project → **Sprints** → New sprint, Start + API), verified by automated tests and HTTP checks through the dev proxy |
| 5 | Create/manage tasks | Implemented (UI: **Tasks** tab, task form, task page: assignment, moves, comments + API), verified as above |
| 6 | Use the Kanban board | Implemented (UI: **Board** tab, "Move to" menu on each card + API), verified as above |
| 7 | Generate tasks using AI (AI-01) | Not available |
| 8 | Get a developer recommendation (AI-02) | Not available |
| 9 | Predict sprint delay risk (AI-03) | Not available |
| 10 | View dashboard analytics | Implemented (UI: **Dashboard** page and project **Dashboard** tab, Chart.js charts + API), verified as above |

## 2. Demo data

Available now:

- Administrator: `npm run create-admin` (see [deployment.md](deployment.md#32-create-the-first-administrator)).
- Project manager and developers: public registration (`/register` page or `POST /api/v1/auth/register`).
- Developers enter their skills on **My profile** (`/profile`); the developer directory filters on them (API ready, UI in TASK 15).
- The administrator can change roles and deactivate accounts on **Users** (`/admin/users`).

A full demo seed (projects, sprints, tasks) will be defined once those models exist.

## 3. Detailed demo steps

To be written when the features exist.
