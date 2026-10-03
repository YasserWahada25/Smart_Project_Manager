# Functional Demonstration

> Current state: the application opens in a browser (`http://localhost:4200`): sign up, sign in, sign out, the home page (live status of frontend, backend and MongoDB), **My profile** (personal information, skills, password) and, for administrators, **Users** (account administration) work, as well as **Projects** (list, creation, project page, status, team built from the developer directory). Sprints, tasks, the Kanban board, comments, history, notifications, dashboards and search work too. **Steps 1–7 and 10 can be shown in the browser**; AI steps 8–9 are not implemented yet.
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
| 7 | Generate tasks using AI (AI-01) | Implemented (UI: project → **Sprints** → **Plan with AI**: paste the specification or attach a file, review, apply + API + AI service), verified by automated tests and an end-to-end HTTP scenario (local analyzer; OpenAI when a key is set) |
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

Complete scenario and seed data: TASK 27. Step available now:

### Step 7 — Plan the project with AI (AI-01)

Prerequisites: the AI service is running (`uvicorn`, see [deployment.md](deployment.md#33-ai-service-fastapi)) and `AI_SERVICE_TOKEN` is the same in `backend/.env` and `ai-service/.env`; the home page shows the "AI service" line as operational.

1. Sign in as the project manager, open a project that is not archived, tab **Sprints** → **Plan with AI**.
2. The page shows the analyzer: "local" (no OpenAI key: the specification stays on the servers) or "OpenAI <model>" (the specification is sent to OpenAI).
3. Paste a specification with headings and lists, for example:

   ```text
   # Authentication
   - As a customer, I want to sign up with my email so that I can order (Must)
   - As a customer, I want to reset my password (Should)
   # Catalog
   - Browse products by category with pagination (Must, 5 pts)
   - Admin can import products from a CSV file (Could)
   # Payment
   - Pay by card with Stripe (Must)
   - Fix the rounding bug of the cart total
   ```

   and/or attach the cahier des charges (`.docx`, `.pdf`, `.md`, `.txt`, 5 MB max). Optionally set the first sprint date, the sprint length and the capacity (story points per sprint).
4. **Generate the plan**: the sprints appear with their dates, objective (epics), points vs capacity, then the backlog; warnings explain what to check (deadline exceeded, oversized task…).
5. Review: rename a sprint, open a task to change its type, priority, points or skills, move a task to another sprint or to the backlog, delete one.
6. **Apply the plan**: toast "Plan applied: N tasks and M sprints created", the Sprints tab lists the new PLANNED sprints; the Tasks tab and the Board show the TODO tasks; the Activity tab shows "created N tasks in M sprints with the AI planner".

