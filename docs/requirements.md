# Requirements

> Status legend: **Planned** = specified, not implemented · **In progress** · **Done** = implemented and tested.
> Current state: FR-01 Authentication, FR-02 User management, FR-03 User profiles, FR-04 Developer skills, FR-05 Project management, FR-06 Team management, FR-07 Sprint management, FR-08 Task management, the FR-09 Kanban board, FR-10 Comments, FR-11 Activity history, FR-12 Notifications, FR-13 Dashboard and FR-14 Search implemented in the backend (API); their user interfaces come with the frontend.

## 1. Project context

Smart Project Manager is a university mini-project for the course *AI for Software Engineering*. It is a complete web application (frontend, backend, database, AI service, REST APIs, tests, documentation, deployment-ready architecture) for managing software development projects, enhanced with Artificial Intelligence.

## 2. Problem statement

Software teams have to juggle projects, sprints, tasks, priorities, deadlines and developer workload. Doing this by hand creates recurring problems:

- breaking a feature description into concrete development tasks takes time and is inconsistent;
- tasks are assigned without objectively comparing required skills with developer skills and current workload;
- sprint delays are noticed too late, because no indicator flags at-risk sprints early.

## 3. Objectives

1. Centralize project, team, sprint and task management in one web platform.
2. Visualize task progression (Kanban board) and project health (dashboard).
3. Use AI to:
   - generate structured tasks from a project/feature description (AI-01);
   - recommend the most suitable developer for a task (AI-02);
   - predict the delay risk of a sprint (AI-03).
4. Deliver a secure, tested, documented and containerizable application.

## 4. Actors and roles

| Role              | Responsibilities |
|-------------------|------------------|
| `ADMIN`           | Manage users; activate/deactivate accounts; view platform information; manage roles when required. |
| `PROJECT_MANAGER` | Create/update projects; manage project members; create sprints; create/update tasks; assign developers; manage deadlines; access project dashboards; use AI features. |
| `DEVELOPER`       | Access assigned projects; view assigned tasks; update authorized task statuses; add comments; view relevant recommendations; manage own profile and skills. |

### 4.1 Account creation policy

| Role | How an account gets it |
|------|------------------------|
| `DEVELOPER` | Public registration (default role) |
| `PROJECT_MANAGER` | Public registration with `role: "PROJECT_MANAGER"` |
| `ADMIN` | Never through public registration. First admin: `npm run create-admin` (command line). Others: promoted by an existing admin |
| Any role change | By an `ADMIN`, through `PATCH /api/v1/users/:id/role` (not on their own account) |

## 5. Functional requirements

| ID    | Module                          | Summary | Status |
|-------|---------------------------------|---------|--------|
| FR-01 | Authentication                  | Register/login with JWT, protected routes, role-based authorization. | Done (API + UI: sign in, sign up, protected pages, session expiry) |
| FR-02 | User management                 | Admin manages users, roles, account activation. | Done (API + UI `/admin/users`: search, role/status filters, pagination, activate/deactivate, change role; admin bootstrap command). Platform figures belong to the admin dashboard (FR-13) |
| FR-03 | User profiles                   | Users view/update their profile and change their password. | Done (API + UI `/profile`: personal information, password change) |
| FR-04 | Developer skills                | Developers manage their skills (name, level, years of experience; used by AI-02). | Done (API + UI `/profile`: add, edit, remove skills; AI-02 itself is planned) |
| FR-05 | Project management              | CRUD on projects, status lifecycle, members. | Done (API + UI: project list, creation/edition form, project page with status changes, archiving and deletion) |
| FR-06 | Team management                 | Manage project members/teams. | Done (API + UI: team on the project page, developer directory searchable by name and skill, add/remove members) |
| FR-07 | Sprint management               | CRUD on sprints within a project, status lifecycle. | In progress (backend done, UI planned) |
| FR-08 | Task management                 | CRUD on tasks, assignment, workflow transitions. | In progress (backend done, UI planned) |
| FR-09 | Kanban board                    | Visualize tasks by workflow column; BLOCKED tasks identifiable. | In progress (board API done, UI planned) |
| FR-10 | Comments                        | Users comment on tasks. | In progress (backend done, UI planned) |
| FR-11 | Activity history                | Log task/sprint/project events. | In progress (backend done, UI planned) |
| FR-12 | Notifications                   | Notify users of relevant events. | In progress (backend done, UI planned) |
| FR-13 | Dashboard                       | Project indicators and charts. | In progress (API done incl. workload & platform indicators; charts UI planned; AI risk indicators with AI-03) |
| FR-14 | Search and filters              | Search/filter projects and tasks. | In progress (API done: list filters + global search; UI: project search and status filter, developer search by skill done; task filters and global search planned) |
| FR-15 | AI features                     | AI-01, AI-02, AI-03 (see [ai.md](ai.md)). | Planned |

### 5.1 Project

Fields: name, description, start date, deadline, status, technologies, project manager, members.

Statuses: `PLANNING`, `ACTIVE`, `PAUSED`, `COMPLETED`, `ARCHIVED`.

### 5.2 Sprint

Fields: name, objective, project, start date, end date, status, tasks.

Statuses: `PLANNED`, `ACTIVE`, `COMPLETED`, `CANCELLED`.

### 5.3 Task

Fields: title, description, type, priority, complexity, status, deadline, technologies / required skills, assignee, sprint, project, creator.

| Enumeration | Values |
|-------------|--------|
| Type        | `FEATURE`, `BUG`, `IMPROVEMENT`, `TESTING`, `DOCUMENTATION`, `DEVOPS`, `SECURITY` |
| Priority    | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| Workflow    | `TODO` → `IN_PROGRESS` → `CODE_REVIEW` → `TESTING` → `DONE` |
| Extra state | `BLOCKED` |

### 5.4 Kanban board

Columns: `TODO`, `IN_PROGRESS`, `CODE_REVIEW`, `TESTING`, `DONE`. BLOCKED tasks must be identifiable. Drag-and-drop only when explicitly requested.

### 5.5 Activity history

Events to record: task created, task updated, task assigned, status changed, sprint created, developer added to project.

### 5.6 Dashboard indicators

Total projects, active projects, active sprints, total tasks, completed tasks, overdue tasks, blocked tasks, sprint progress, tasks by status, tasks by priority, developer workload, AI risk indicators. Charts may use Chart.js.

## 6. Non-functional requirements

| ID     | Category        | Requirement |
|--------|-----------------|-------------|
| NFR-01 | Maintainability | Layered, modular code (routes / controllers / services / models; Angular core / shared / features). |
| NFR-02 | Security        | See section 7. |
| NFR-03 | Usability       | Clear UI with loading states, error states and validation messages. |
| NFR-04 | Responsiveness  | Usable on desktop and mobile screen sizes. |
| NFR-05 | Modularity      | Frontend, backend and AI service are independent, separately deployable services. |
| NFR-06 | Testability     | Unit and API tests for important features in every service. |
| NFR-07 | Performance     | Indexed MongoDB queries where justified; AI calls with timeouts. |
| NFR-08 | Error handling  | Centralized error handling and meaningful HTTP status codes. |

## 7. Security requirements

- No hardcoded passwords, MongoDB credentials, JWT secrets or API keys; configuration comes from environment variables.
- `.env` files are never committed; server secrets are never exposed to Angular.
- Passwords are hashed (bcrypt).
- Protected endpoints validate the JWT; role-based authorization where required.
- Inputs are validated before reaching MongoDB.
- AI-generated output is validated before persistence; AI service failures are handled gracefully.

## 8. Technical constraints

| Layer      | Fixed technology |
|------------|------------------|
| Frontend   | Angular + TypeScript |
| Backend    | Node.js + Express.js + **JavaScript** (no TypeScript, no NestJS) |
| Database   | MongoDB + Mongoose |
| AI service | Python + FastAPI, separate from the Express backend |
| Transport  | REST API |
