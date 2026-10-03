# Architecture

> Current state: **Express.js backend complete for the non-AI features** (authentication, users, profiles & skills, projects & teams, sprints, tasks & Kanban, comments, activity history, notifications, dashboards, search). Angular frontend: screens for every non-AI feature (TASK 12–19). AI service not created yet.
> This document describes the target architecture; sections are updated with the actual implementation as tasks are completed.

## 1. Global architecture

```
                 USER
                   |
                   v
           Angular Frontend            (browser, port 4200 in dev)
                   |
               REST API (JSON over HTTP, JWT bearer token)
                   |
                   v
          Express.js Backend           (Node.js, port 3000)
                   |
          +--------+--------+
          |                 |
          v                 v
       MongoDB         AI Service      (Python / FastAPI, port 8000)
       (Mongoose)           |
                  +---------+---------+
                  v                   v
          Machine Learning          LLM
           (if required)       (if required)
```

## 2. Components and responsibilities

| Component          | Responsibility | Status |
|--------------------|----------------|--------|
| Angular frontend   | User interface, routing, forms, guards, HTTP calls to the backend. | Setup done (shell, routing, error handling, system status page) |
| Express.js backend | Main REST API: authentication, authorization, business rules, validation, persistence, orchestration of AI calls. | Complete for non-AI features |
| MongoDB            | Main application database. | 7 collections (users, projects, sprints, tasks, comments, activities, notifications) |
| FastAPI AI service | Stateless AI operations (generation, recommendation, prediction). Does not access MongoDB directly. | Not created |

## 3. Communication rules

1. The frontend communicates **only** with the Express backend.
2. The Express backend is the only component that reads/writes MongoDB.
3. When an AI feature is requested, the backend gathers the needed data from MongoDB, calls the AI service, **validates** the response, then persists/returns it.
4. The AI service is never exposed directly to the browser.

## 4. Architectural decisions

| Decision | Rationale |
|----------|-----------|
| Separate AI service (FastAPI) | The Python ecosystem (Pandas, Scikit-learn, LLM SDKs) is best suited for AI; isolation keeps the main API independent of AI failures and allows separate scaling. |
| Backend as AI gateway | Centralizes authentication, authorization and validation; secrets (e.g. LLM API keys) stay server-side. |
| MongoDB + Mongoose | Flexible document model for projects/tasks with embedded lists (technologies, skills); schema validation through Mongoose. |
| JWT authentication | Stateless authentication suited to a REST API consumed by a SPA. |

## 5. Target structures

Folders are created only when a task needs them.

### 5.1 Frontend (Angular)

Target:

```
frontend/src/app/
├── core/        singleton services, guards, interceptors
├── shared/      reusable components, pipes, models
├── features/    auth, users, projects, teams, sprints, tasks, kanban, dashboard, ai
└── layouts/
```

Implemented (TASK 12–19):

```
frontend/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── app.constants.ts            APP_NAME
│   │   │   ├── auth/                       auth.service, auth.interceptor, auth.guards, token-storage, jwt, auth.models
│   │   │   ├── http/api-error.interceptor.ts  HttpErrorResponse → ApiError + global toast
│   │   │   ├── http/action-error.ts        message of a failed user action (null when already reported globally)
│   │   │   ├── models/                     api-error, pagination, user, project, sprint, task, comment, activity
│   │   │   │                               (+ describeActivity), notification, dashboard, system-status
│   │   │   ├── routing/app-title.strategy.ts  "<page> · Smart Project Manager"
│   │   │   └── services/                   health, toast (snack bar loaded on demand), notification (unread count)
│   │   ├── shared/components/              loading-state, error-state, confirm-dialog (+ ConfirmService),
│   │   │                                   tag-input (chips), chart (Chart.js canvas)
│   │   ├── shared/forms/                   password validators (same policy as the backend), integer / tag list / "not before" date validators, form error helpers (backend field messages, incl. array paths)
│   │   ├── shared/data/                    PagedList (filters + pagination, latest query wins), LoadMoreList ("Load more" feeds)
│   │   ├── shared/dates.ts                 today / YYYY-MM-DD helpers
│   │   ├── testing/                        test data, fake AuthService, test setup (excluded from the build)
│   │   ├── layouts/main-layout/            toolbar (search, notifications bell, user menu) + side navigation filtered by role
│   │   ├── layouts/auth-layout/            centered layout of the public pages
│   │   ├── features/
│   │   │   ├── auth/login, auth/register   sign in / create an account (reactive forms)
│   │   │   ├── home/                       welcome + system status (frontend → API → MongoDB)
│   │   │   ├── profile/                    My profile: account, personal information, skills, password (ProfileService)
│   │   │   ├── users/                      user administration for ADMIN (UserAdminService, user-list)
│   │   │   ├── projects/                   project-list, project-form, project-shell (header + tabs, ProjectContext),
│   │   │   │                               project-overview, add-members-dialog (ProjectService, DeveloperService)
│   │   │   ├── sprints/                    sprint-list (tab), sprint-form-dialog (SprintService)
│   │   │   ├── tasks/                      task-list (tab), task-detail, task-form-dialog, block-reason-dialog,
│   │   │   │                               my-tasks, task badges (TaskService, TaskWorkflow)
│   │   │   ├── kanban/                     kanban-board (tab)
│   │   │   ├── comments/                   task-comments (CommentService)
│   │   │   ├── activity/                   activity-list, task-history, project-activity (tab) (ActivityService)
│   │   │   ├── notifications/              notification-list
│   │   │   ├── dashboard/                  dashboard-page, project-dashboard (tab), task-charts, workload-table,
│   │   │   │                               active-sprint-card (DashboardService, also used by the search)
│   │   │   ├── search/                     search-page
│   │   │   └── not-found/                  404 page
│   │   ├── app.config.ts                   providers (router + input binding, HttpClient + interceptors, title, icons)
│   │   ├── app.routes.ts                   lazy-loaded routes inside MainLayout; project tabs are child routes
│   │   └── app.ts                          root component (<router-outlet>; preloads the toast code after the first render)
│   ├── environments/                       environment.ts / environment.development.ts (apiUrl)
│   ├── styles.scss                         Material 3 theme (azure/blue), toast styles
│   └── index.html
├── proxy.conf.json                         dev server: /api → http://localhost:3000
├── angular.json, eslint.config.js, .prettierrc
└── package.json
```

#### Frontend technical choices

| Choice | Reason |
|--------|--------|
| Angular 22, **standalone components**, **zoneless** change detection, **signals** | Current Angular defaults: no NgModules, less boilerplate, fine-grained updates |
| `OnPush` + signals in components | Predictable rendering, works with zoneless |
| **Lazy-loaded routes** (`loadComponent`) inside a `MainLayout` shell | Each page is downloaded on first visit; the initial bundle only contains the shell |
| **Angular Material 3** (azure/blue theme, Material Symbols icons) | Consistent, accessible, responsive components; colors from `--mat-sys-*` variables |
| **Dev proxy** (`proxy.conf.json`) and `apiUrl = '/api/v1'` in every environment | The browser only talks to its own origin (no CORS in dev); the same URL works behind a reverse proxy in production |
| **Functional HTTP interceptor** `apiErrorInterceptor` | Every HTTP error becomes an `ApiError` mirroring the backend error format; network/5xx errors show a toast automatically, 4xx are handled by the page (validation messages). A request can opt out with the `SKIP_ERROR_TOAST` context token |
| Shared `LoadingState` / `ErrorState` components | Same loading and error presentation on every page (with "Try again") |
| Responsive layout (`BreakpointObserver`) | Side menu always visible on desktop, drawer + menu button on handsets |
| angular-eslint with template **accessibility** rules, Prettier | Code quality and accessibility checked by `npm run lint` |
| **Snack bar loaded on demand** (`ToastService`) | No toast is needed to display the first page: `MatSnackBar` and the CDK overlay are loaded by a dynamic `import()` and preloaded right after the first render (so a "cannot reach the server" toast still works if the network drops later). Initial bundle: 500.8 kB → 341.6 kB (125.8 → 94.4 kB transferred) |
| `PagedList` for list pages | One implementation of "filters → paginated request → items/total/loading/error" where only the latest query is displayed (`switchMap`); used by the users, projects and developer-directory lists |
| `LoadMoreList` for feeds | Comments, histories and notifications are read page by page with a "Load more" button; a reset ignores the responses to older requests |
| **Chart.js** (bar charts only, registered pieces only, loaded with the dashboards) | Counts per status / priority compare magnitudes: horizontal bars in one hue (`#2a78d6`, validated ≥ 3:1 contrast on the light surface with the data-viz palette checker), ≤ 24 px thick, 4 px rounded data end, recessive grid, hover tooltip, no legend for a single series; the values are also displayed as text next to each chart (accessible table view) |
| Native date inputs (`<input type="date">`) | Their value is already the `YYYY-MM-DD` format of the API (no date adapter to load); backend dates (midnight UTC) are displayed with the `UTC` time zone so the calendar day never shifts |

#### Frontend authentication

| Piece | Role |
|-------|------|
| `AuthService` | Session (token + user) in signals: `currentUser`, `isAuthenticated`, `hasRole()`; `login()`, `register()`, `logout()`. Restores the session synchronously from storage at startup (expired tokens are discarded), then re-validates it in the background with `GET /auth/me`. Schedules an automatic logout when the token expires |
| `TokenStorage` | `localStorage` keys `spm.auth.token` / `spm.auth.user`; works in memory only if storage is unavailable |
| `authInterceptor` | Adds `Authorization: Bearer <token>` to requests for `/api/v1` only (never to other origins). A 401 on an authenticated request (expired token, password changed, account deactivated) ends the session: toast + redirect to `/login?returnUrl=…` |
| `authGuard` | Application pages: requires a session, otherwise `/login?returnUrl=<page>` |
| `guestGuard` | `/login`, `/register`: signed-in users are sent home |
| `roleGuard(...roles)` | Restricts a page to roles (`/admin/users` → `ADMIN`): other users get a toast and are sent home. UX only: the backend enforces the same rules (403) |
| `safeReturnUrl()` | Only internal paths are accepted after login (no open redirect: `//host`, `https://`, `\\`, `:` refused) |

Routes: `/login` and `/register` are **top-level** routes rendered in `AuthLayout`; everything else is under `MainLayout` protected by `authGuard`. (An empty-path parent for the public pages would also match `/` and, with `guestGuard`, cause an infinite redirect loop for signed-in users — this was caught by the routing tests.)

**Token storage choice:** the backend issues a Bearer JWT (no cookie), so the token is kept in `localStorage` to survive page reloads. Risk: a successful XSS could read it. Mitigations: Angular escapes all template bindings (no `innerHTML` is used), the token expires (`JWT_EXPIRES_IN`), it is invalidated by a password change, and it is only sent to our own API. An httpOnly cookie would remove this risk but requires CSRF protection on the backend (possible future improvement).

#### Profile and user administration screens

| Route | Who | Content | API used |
|-------|-----|---------|----------|
| `/profile` ("My profile") | every signed-in user | Account (email, role, member since — read only); personal information (first/last name, job title, bio); skills (name, level, years of experience — the whole list is saved at once); password change | `GET`/`PATCH /profile`, `PUT /profile/skills`, `PATCH /profile/password` |
| `/admin/users` ("Users") | `ADMIN` (`roleGuard` + backend 403) | Table of accounts: search on name/email (debounced 300 ms), role and status filters, server-side pagination; per account: change role, deactivate (confirmation dialog), activate | `GET /users`, `PATCH /users/:id/role`, `PATCH /users/:id/status` |

- **Navigation by role:** each menu entry can list the roles allowed to see it (`NAV_ITEMS[].roles`); "Users" is only shown to administrators. The user menu also links to "My profile".
- **Session kept in sync:** `ProfileService` updates the user stored by `AuthService` after every successful call (the toolbar name changes immediately). After a password change the backend rejects every older token and returns a new one: `AuthService.replaceSession()` switches to it, so the current tab stays signed in while the other devices are signed out.
- **Validation:** the forms apply the backend rules (lengths, password policy, skill levels, unique skill names ignoring case, whole years 0–50) and also show the backend messages on the right field — array paths such as `skills[1].level` are mapped to the `FormArray` controls. A wrong current password is a 400 on its field (not a 401, so the session is not ended).
- **Self-protection:** an administrator cannot change their own role or status (backend rule): their row is marked "You" and has no action menu.
- **Feedback:** deactivating an account and changing a role ask for confirmation (`ConfirmService`, Cancel focused by default); the row is updated in place and a toast confirms the change; a refusal from the backend (403, 404…) is shown in a toast.

#### Projects and team screens

| Route | Who | Content | API used |
|-------|-----|---------|----------|
| `/projects` ("Projects") | every signed-in user — the backend returns all projects to an administrator, managed projects to a project manager, the projects a developer belongs to | Cards (name, manager, status, description, dates, technologies, team size), search on the name (debounced), status filter, pagination; "New project" for project managers; empty state explained per role | `GET /projects` |
| `/projects/new`, `/projects/:id/edit` | `PROJECT_MANAGER` (`roleGuard`); editing is refused in the page for another manager's project or an archived project | Name, description, start date (today by default), optional deadline (≥ start date), technologies as chips (Enter / comma, duplicates ignored, ≤ 30 × 50 characters); a cleared deadline is sent as `null` (removed) | `POST /projects`, `GET` / `PATCH /projects/:id` |
| `/projects/:id` | viewers of the project (404 "Project not found" otherwise, without retry) | Overview (description, dates, manager, technologies) and team (members with job title, email, skills, deactivated badge). For its manager: Edit, Change status (archiving asks for confirmation), Delete (confirmation; 409 when the project has sprints or tasks), Add developers, Remove a member (confirmation; 409 when they have unfinished tasks) | `GET` / `PATCH` / `DELETE /projects/:id`, `POST` / `DELETE /projects/:id/members` |
| "Add developers" dialog | project manager | Developer directory (active developers): search on name/email and exact skill (each field debounced), pagination, "Add" per developer, members marked "In the team"; the dialog stays open to add several developers and the project page is updated after each addition | `GET /developers`, `POST /projects/:id/members` |

- **Who can do what** mirrors the backend rules (only the manager who created the project modifies it; administrators and members see it read-only; an archived project only accepts a status change). The backend still enforces every rule (403 / 404 / 409), and its messages are shown in toasts (`actionErrorMessage`).
- The project page shell reloads when its `:id` route parameter changes (the router reuses the component between projects).

#### Project page: shell and tabs (TASK 16–19)

`/projects/:id` is a **shell** (`ProjectShell`: header with name, status and the manager's actions, read-only banner when archived, tab bar) whose tabs are **child routes**: `''` Overview, `sprints`, `tasks`, `tasks/:taskId` (task page), `board`, `activity`, `dashboard`. The shell provides a `ProjectContext` (current project, `isManager`, `isArchived`, `canEdit`, active members, `canChangeStatus(task)`) injected by every tab, so the project is loaded once and the permissions are computed in one place.

| Screen | Who / rules (mirroring the backend) | Content | API used |
|--------|-------------------------------------|---------|----------|
| Sprints tab | viewers; the manager creates, edits (open sprints), starts, completes, cancels (confirmations), deletes (PLANNED only) | Sprints in chronological order: dates, objective, progress in story points, task counts (done, blocked); links to the tasks and the board of the sprint | `GET /projects/:id/sprints`, `POST`, `PATCH /sprints/:id`, `PATCH /sprints/:id/status`, `DELETE /sprints/:id` |
| Sprint form (dialog) | manager | Name, objective, start date (today) and end date (two weeks by default, ≥ start) | `POST /projects/:id/sprints`, `PATCH /sprints/:id` |
| Tasks tab | viewers; the manager creates | Filters: title search (debounced), status, priority, type, assignee (or unassigned), sprint (or backlog), overdue; paginated table (status and priority badges, points, assignee, sprint, deadline / overdue); `?sprint=<id>` opens it filtered | `GET /projects/:id/tasks` |
| Task form (dialog) | manager | Title, description, type, priority, complexity (1, 2, 3, 5, 8, 13 points), sprint (open sprints or backlog), deadline, required skills (chips), assignee (creation only: active members) | `POST /projects/:id/tasks`, `PATCH /tasks/:id` |
| Task page | viewers; moves: manager and assignee; assignment, edition, deletion: manager | Details, blocked reason, "Move to" buttons limited to the allowed transitions (starting needs an assignee; blocking asks for an optional reason), assignee select, comments and history | `GET`, `PATCH`, `DELETE /tasks/:id`, `PATCH /tasks/:id/status`, `PATCH /tasks/:id/assignee` |
| Board tab (Kanban) | viewers; moves: manager and assignee | Six columns (To do → Done + Blocked) with counts; cards: title, priority, points, deadline / overdue, blocked reason, assignee; "Move to" menu per card; scope: active sprint by default, `?sprint=`, another sprint, the backlog or all tasks | `GET /projects/:id/board`, `PATCH /tasks/:id/status` |
| My tasks (`/my-tasks`, developers' menu) | the signed-in user | Assigned tasks, nearest deadline first, status filter, links to the task pages | `GET /tasks/assigned` |
| Comments (task page) | manager and members comment (not administrators); the author edits; the author or the manager deletes (moderation); nothing in an archived project | Oldest first with "Show more", edited marker, inline edition | `GET` / `POST /tasks/:id/comments`, `PATCH` / `DELETE /comments/:id` |
| History (task page) and Activity tab | viewers | Timeline "<actor> <what happened>" built by `describeActivity()` (16 event types, labels instead of codes); filter by event type on the project | `GET /tasks/:id/activities`, `GET /projects/:id/activities` |
| Notifications (`/notifications`) and toolbar bell | the signed-in user | Badge with the unread count, refreshed every 60 s (silently) and after each change; list with unread ones highlighted, "Unread only", open = mark as read + go to the task or project, "Mark all as read", delete | `GET /notifications`, `/notifications/unread-count`, `PATCH …/read`, `PATCH /notifications/read-all`, `DELETE /notifications/:id` |
| Dashboard (`/dashboard`) | everyone (the backend adapts the content to the role) | Key figures, tasks by status and by priority (charts + values), active sprints (progress, days left / late), team workload (managers, administrators), my tasks (developers), accounts by role (administrators) | `GET /dashboard` |
| Dashboard tab | viewers | Deadline (days left), team size, task figures and charts, sprints by status, active sprint, workload of every member | `GET /projects/:id/dashboard` |
| Search (`/search?q=`) and toolbar field | everyone | Projects (name, description) and tasks (title, description) of the projects the user can see; at least 2 characters; the query is kept in the URL | `GET /search` |

- **Status changes** (`TaskWorkflow`) are shared by the task page and the board: allowed targets from the transition table, assignee required to start, optional blocking reason, backend refusals shown in a toast.
- **Drag-and-drop** on the board was not requested (project rule: only when explicitly asked); tasks move with the "Move to" menu.

#### Frontend ↔ backend communication

```
Browser ──► http://localhost:4200 (ng serve)
              ├── /            Angular application (SPA, deep links served by index.html)
              └── /api/*  ──►  proxy ──► http://localhost:3000/api/*  (Express)
```

`HealthService.check()` calls `GET /api/v1/health`: 200 → backend and database up; 503 (sent by the backend when MongoDB is down) → backend up, database down; anything else (e.g. 502 from the proxy when the backend is stopped) → backend unreachable.

### 5.2 Backend (Express.js)

Target:

```
backend/src/
├── config/        environment & database configuration
├── controllers/   HTTP request/response handling
├── middleware/    authentication, authorization, error handling
├── models/        Mongoose schemas
├── routes/        REST route definitions
├── services/      business logic
├── validators/    request validation (express-validator)
├── utils/
└── app.js
```

Implemented (TASK 02–11):

```
backend/
├── src/
│   ├── config/
│   │   ├── env.js               loads backend/.env (dotenv), parses & validates configuration
│   │   └── database.js          connect / disconnect / connection status (Mongoose)
│   ├── controllers/
│   │   ├── health.controller.js
│   │   ├── auth.controller.js   register, login, me
│   │   ├── user.controller.js   admin: list, get, update status, update role
│   │   ├── profile.controller.js own profile, password, skills
│   │   ├── project.controller.js projects & members
│   │   ├── sprint.controller.js sprints
│   │   ├── task.controller.js   tasks, board, my tasks
│   │   ├── comment.controller.js task comments
│   │   ├── activity.controller.js project / task history
│   │   ├── notification.controller.js own notifications
│   │   └── dashboard.controller.js dashboards & global search
│   ├── middleware/
│   │   ├── authenticate.js      verifies the Bearer JWT, loads req.user from MongoDB
│   │   ├── authorize.js         authorize(...roles) → 403 if role not allowed
│   │   ├── validate.js          runs express-validator rules → 400 with field details
│   │   ├── notFound.js          unknown route → 404 ApiError
│   │   └── errorHandler.js      centralized error → JSON response mapping
│   ├── models/
│   │   ├── plugins/toJSON.plugin.js common JSON shape (id, no _id/__v, hidden fields)
│   │   ├── user.model.js        User schema (+ embedded skills), ROLES, SKILL_LEVELS, password hashing
│   │   ├── project.model.js     Project schema, PROJECT_STATUSES
│   │   ├── sprint.model.js      Sprint schema, lifecycle transitions
│   │   ├── task.model.js        Task schema, workflow transitions, story points
│   │   ├── comment.model.js     Comment schema
│   │   ├── activity.model.js    Activity schema, ACTIVITY_TYPES
│   │   └── notification.model.js Notification schema (TTL 90 days)
│   ├── routes/
│   │   ├── index.js             API router mounted on /api/v1
│   │   ├── health.routes.js
│   │   ├── auth.routes.js       /auth/register, /auth/login, /auth/me
│   │   ├── user.routes.js       /users (ADMIN only)
│   │   ├── profile.routes.js    /profile (any authenticated user, own data only)
│   │   ├── developer.routes.js  /developers (PM, ADMIN)
│   │   ├── project.routes.js    /projects (+ /:id/members, /:id/sprints, /:id/tasks, /:id/board)
│   │   ├── sprint.routes.js     /sprints/:id
│   │   ├── task.routes.js       /tasks/assigned, /tasks/:id (+ /comments, /activities)
│   │   ├── comment.routes.js    /comments/:id
│   │   ├── notification.routes.js /notifications
│   │   └── dashboard.routes.js  /dashboard, /search (+ /projects/:id/dashboard in project.routes)
│   ├── scripts/
│   │   └── createAdmin.js       CLI: npm run create-admin
│   ├── services/
│   │   ├── health.service.js    builds the health report
│   │   ├── auth.service.js      registration & login logic
│   │   ├── token.service.js     JWT sign / verify (HS256)
│   │   ├── user.service.js      user listing/administration, admin bootstrap
│   │   ├── profile.service.js   profile update, password change, skills replacement
│   │   ├── projectAccess.service.js project visibility / manager / archived rules
│   │   ├── project.service.js   project CRUD & members
│   │   ├── sprint.service.js    sprint CRUD, lifecycle & statistics
│   │   ├── task.service.js      task CRUD, workflow, assignment, board, my tasks, task history
│   │   ├── comment.service.js   comments & moderation
│   │   ├── activity.service.js  record() + listeners, history queries
│   │   ├── notification.service.js activity → notifications, inbox operations
│   │   ├── dashboard.service.js indicators (aggregations), workload, platform figures
│   │   └── search.service.js    global search in visible projects
│   ├── validators/
│   │   ├── auth.validator.js    register & login rules
│   │   ├── user.validator.js    list filters, status & role update rules
│   │   ├── profile.validator.js profile, password change & skills rules
│   │   ├── project.validator.js project & member rules
│   │   ├── sprint.validator.js  sprint rules
│   │   ├── task.validator.js    task, filter, status & assignment rules
│   │   ├── comment.validator.js comment & activity rules
│   │   ├── notification.validator.js notification rules
│   │   ├── dashboard.validator.js project dashboard & search rules
│   │   ├── common.validator.js  reusable rules (ids, pagination, text, dates, string lists)
│   │   └── password.policy.js   password rules shared by registration and admin bootstrap
│   ├── utils/
│   │   ├── ApiError.js          operational HTTP error (status, code, message, details)
│   │   ├── logger.js            console logger, silent in tests
│   │   ├── pagination.js        shared pagination limits & response metadata
│   │   ├── regex.js             escaped regex builders for search
│   │   └── ids.js               sameId() comparison helper
│   ├── app.js                   createApp(): builds the Express app (no listen)
│   └── server.js                entry point: config check → DB connect → listen → graceful shutdown
├── tests/                       Jest + Supertest (in-memory MongoDB)
├── eslint.config.js
├── .env.example
└── package.json
```

#### Layering

`route → controller → service → (model)`: routes only map URLs to controllers; controllers handle HTTP (status code, JSON); services hold logic and are reusable; models (Mongoose) will hold persistence.

#### Request pipeline (`app.js`)

1. `helmet()` — security headers (removes `X-Powered-By`, adds `X-Content-Type-Options`, `X-Frame-Options`, CSP, …)
2. `cors({ origin: CORS_ORIGIN })` — only the configured frontend origin(s) are allowed
3. `express.json({ limit: '1mb' })` — JSON body parsing with size limit
4. API routes under `/api/v1`
5. `notFound` — any unmatched route becomes a 404 `ApiError`
6. `errorHandler` — converts every error into the standard JSON error format (see [api.md](api.md))

Express 5 forwards errors thrown in async handlers to the error handler automatically.

#### Startup sequence (`server.js`)

1. Load and validate configuration (`config/env.js` → `validateConfig()`); fail fast if `MONGODB_URI` is missing or `PORT` is invalid.
2. Connect to MongoDB (server selection timeout 10 s); on failure, log and exit with code 1.
3. Start the HTTP server.
4. On `SIGINT`/`SIGTERM`: stop accepting connections, close the MongoDB connection, exit (forced exit after 10 s).

`app.js` and `server.js` are separated so tests can import the app without opening a port or a real database connection.

#### Authentication and authorization flow

```
POST /auth/login ──► validate(loginRules) ──► auth.service.login
                                                 ├─ find user by email (+password)
                                                 ├─ bcrypt.compare (dummy hash if email unknown)
                                                 ├─ isActive check
                                                 └─ token.service.sign → { token, user }

GET /<protected> ──► authenticate ──► authorize(ROLES...) ──► controller
                       ├─ "Authorization: Bearer <jwt>" required      ├─ 403 if req.user.role not allowed
                       ├─ jwt.verify (HS256 only, signature + exp)
                       └─ User.findById(sub), must exist and be active → req.user
```

Role permissions are enforced with `authorize(...)` on each business route as it is created (projects, sprints, tasks…). The role is always taken from MongoDB, never from the token.

**Registration policy:** public registration can create `DEVELOPER` (default) or `PROJECT_MANAGER` accounts. A project manager will only manage the projects they create (to be enforced in the project management task), so self-registration as PM does not give access to other users' data. `ADMIN` accounts cannot be self-registered: the first one is created from the command line (`npm run create-admin`, credentials read from `backend/.env`), then any admin can promote other users through `PATCH /api/v1/users/:id/role`.

#### Project-level access control

`services/projectAccess.service.js` centralizes the rules reused by every project-related feature (projects, then sprints, tasks, comments…):

- `visibleProjectsFilter(user)` — MongoDB filter: all projects for `ADMIN`, otherwise `manager = user OR members contains user`;
- `findViewableProject(id, user)` — 404 if the project does not exist **or** the user cannot see it (no information leak);
- `findManagedProject(id, user)` — additionally 403 if the user is not the project's manager, 409 if the project is archived.

Role checks (`authorize`) answer "may this kind of user call this endpoint?"; these ownership checks answer "may this user act on this project?".

#### Activity history

Services call `activityService.record({ project, actor, type, task, sprint, targetUser, details })` after each successful change. The call never throws (a failure is logged), and registered listeners (`onActivity`) are notified of each new activity — this is the single integration point used by notifications: `createApp()` registers `notificationService.registerActivityListener()` (idempotent), which turns each relevant activity into notifications for the people concerned. A listener failure is logged and isolated.

#### User administration

`/api/v1/users/*` is protected at router level by `authenticate` + `authorize(ADMIN)`. An admin cannot change their own status or role, which guarantees at least one active admin at all times. Accounts are deactivated, never deleted, to keep future references (project members, task assignees, comments) valid.

### 5.3 AI service (FastAPI)

```
ai-service/app/
├── routes/     API endpoints
├── services/   AI logic
├── schemas/    Pydantic request/response models
├── models/     persisted ML models
├── ml/         training code
├── prompts/    LLM prompts
└── main.py
```

## 6. Security architecture

| Measure | Status |
|---------|--------|
| Environment-based configuration (no secrets in code, `.env` git-ignored) | Implemented |
| `helmet` security headers | Implemented |
| CORS restricted to configured frontend origin(s) | Implemented |
| JSON body size limit (1 MB) | Implemented |
| Centralized error handling; unexpected errors return a generic 500 message (no stack trace or internal detail leaked) | Implemented |
| bcrypt password hashing (cost 12 by default, configurable 4–15) | Implemented |
| Password hash never returned (`select: false` + `toJSON` transform) | Implemented |
| JWT authentication middleware (HS256 only, `alg: none` and other algorithms rejected, secret ≥ 32 chars enforced at startup) | Implemented |
| User reloaded from DB on each request (deactivation / role change effective immediately) | Implemented |
| Role-based authorization middleware | Implemented (applied to business routes as they are added) |
| Request validation (express-validator); only validated fields reach the services (`matchedData`) — blocks mass assignment and NoSQL operator injection (`{ "$ne": null }`) | Implemented |
| Identical login error for unknown email and wrong password + constant-time-ish comparison (dummy hash) — prevents account enumeration | Implemented |
| ADMIN role cannot be self-assigned at registration; first admin created from the CLI | Implemented |
| User administration restricted to ADMIN; admin cannot deactivate/demote themselves | Implemented |
| Search input escaped before building the MongoDB regex (no ReDoS / regex injection) | Implemented |
| Login rate limiting / account lockout | Not implemented (future improvement) |
| Tokens issued before a password change are rejected (`passwordChangedAt` vs JWT `iat`) | Implemented |
| Password change requires the current password; new password must differ and follow the policy | Implemented |
| Profile endpoints only act on the token's own user (no user id in the URL → no IDOR) | Implemented |
| Validation of array items without `bail()` (express-validator wildcard quirk) + same rules enforced again by the Mongoose schema | Implemented |
| Token revocation on logout (logout = client discards token) | Not implemented (stateless JWT; future improvement) |
