# Testing

> Current state: **backend** (Jest + Supertest + in-memory MongoDB, 358 tests), **frontend** (Vitest, 349 tests) and **AI service** (pytest, 148 tests) suites in place; end-to-end checks against the real services after each feature (TASK 22: 17/17, TASK 23: 10/10, TASK 24: 11/11, TASK 25: 12/12).
> Results are recorded here only after tests have actually been executed.

## 1. Strategy

| Service | Test types | Tooling | Status |
|---------|-----------|---------|--------|
| Backend (Express.js) | Unit tests (config, middleware, model), API tests (Supertest), authentication and authorization tests | Jest 30, Supertest 7, mongodb-memory-server 11 | In place |
| Frontend (Angular) | Component, service, interceptor and routing tests (form-validation tests with the forms) | Vitest 4 + jsdom through the Angular CLI unit-test builder, `HttpTestingController`, `RouterTestingHarness` | In place |
| AI service (FastAPI) | Endpoint tests (token, validation, errors), text extraction from in-memory documents, requirement parser, task enricher, sprint planner, ML model (training, persistence, metrics), OpenAI client and fallback with a mocked HTTP transport (no real OpenAI call) | pytest 9 + FastAPI `TestClient`, `httpx.MockTransport` | In place |

### 1.1 Backend test database

Tests that need MongoDB start an **in-memory MongoDB** (`mongodb-memory-server`, helper `backend/tests/helpers/db.js`). Tests therefore:

- never read or modify the development database;
- need no local MongoDB, so they can also run in CI.

The MongoDB binary (~80 MB executable, ~800 MB download on Windows) is downloaded once by `npm install` into `backend/node_modules/.cache/mongodb-memory-server/`.

### 1.2 Why Jest runs with `--experimental-vm-modules`

The MongoDB Node.js driver 7.6 (used by Mongoose 9.10) loads the `os` module with a dynamic `import()`. Jest runs tests inside a Node `vm` sandbox, which rejects dynamic imports unless Node is started with `--experimental-vm-modules`. Without the flag, the driver silently sends an empty handshake and the server rejects the connection (`Missing required sub-document 'driver' in the client metadata document`). The `npm test` script therefore starts Jest as `node --experimental-vm-modules node_modules/jest/bin/jest.js`. This only affects tests; the application itself runs normally.

### 1.3 Test environment variables

`backend/tests/setup-env.js` (Jest `setupFiles`) runs before any application module is loaded and sets:

- `JWT_SECRET` — a new random 96-character value on every run (no secret is stored in the repository);
- `JWT_EXPIRES_IN=1h`;
- `BCRYPT_SALT_ROUNDS=4` — minimum cost, keeps password hashing fast in tests (production default: 12).

These values take precedence over `backend/.env` because dotenv never overrides existing variables. The fixed passwords in test files (e.g. `Secret123`) belong to throw-away users created in the in-memory database.

## 2. How to run

### Backend

```bash
cd backend
npm test                 # all tests
npm run test:coverage    # with coverage report (backend/coverage/, git-ignored)
npm run lint             # ESLint
```

### Frontend

```bash
cd frontend
npm run test:ci          # single run (npm test = watch mode)
npm run lint
npm run format:check     # Prettier
npm run build            # production build (type checking + budgets)
```

Requires Node.js 22.22.3+ or 24.15+ (Angular CLI 22).

### AI service

```bash
cd ai-service
.venv/Scripts/python.exe -m pytest -q                 # add --basetemp <folder> if the system temp folder is not writable
.venv/Scripts/python.exe -m flake8 app tests
.venv/Scripts/python.exe -m app.ml.task_type_model    # re-train + cross-validation metrics
```

## 3. Backend test inventory

| File | Type | What is verified |
|------|------|------------------|
| `tests/health.test.js` | API (in-memory MongoDB) | `GET /api/v1/health` → 200 `ok` when MongoDB is connected; 503 `degraded` when not |
| `tests/app.test.js` | API | JSON 404 for unknown routes; 400 for malformed JSON; 413 for body > 1 MB; helmet security headers, no `X-Powered-By`; CORS allowed for configured origin, refused for others |
| `tests/errorHandler.test.js` | Unit | Error mapping: `ApiError`, Mongoose `ValidationError` (400 + details), `CastError` (400), duplicate key (409), unknown error → generic 500 without leaking internal details |
| `tests/env.test.js` | Unit | `PORT`/`CORS_ORIGIN` parsing; `validateConfig()` rejects missing `MONGODB_URI`, invalid ports, missing/short `JWT_SECRET`, invalid `JWT_EXPIRES_IN`, out-of-range `BCRYPT_SALT_ROUNDS`; reports all problems at once |
| `tests/auth.test.js` | API (in-memory MongoDB) | **Register:** 201 + token + user without password; default role DEVELOPER; PROJECT_MANAGER allowed; ADMIN refused (400); unexpected fields ignored (mass assignment); email trimmed/lower-cased; duplicate email 409 (case-insensitive); per-field validation messages; weak passwords (no digit, no letter, > 72 bytes); non-string values. **Login:** 200 with token; case-insensitive email; wrong password 401; unknown email gives the identical 401; deactivated account 403; missing fields 400; NoSQL operator injection rejected. **Me:** 200 with valid token; 401 without header, non-Bearer scheme, foreign signature, `alg: none`, expired token, deleted user, deactivated user; tampered `role` claim ignored (role read from DB) |
| `tests/authorize.test.js` | Unit | Allowed role passes; other role → 403; no `req.user` → 401 |
| `tests/users.test.js` | API (in-memory MongoDB) | **Access control:** every `/users` endpoint → 401 without token, 403 for PROJECT_MANAGER and DEVELOPER. **List:** newest first, pagination metadata, `page`/`limit`, filters `role` and `isActive`, case-insensitive search on name/email, regex characters treated as text, 400 for invalid query values, no passwords. **Get:** 200, 404 unknown id, 400 invalid id. **Status:** deactivation blocks the existing token (401) and login (403); reactivation restores login; self-deactivation 403; non-boolean `isActive` 400; unknown user 404. **Role:** change effective immediately for an existing token; promotion to ADMIN; self role change 403; invalid role 400; extra body fields ignored |
| `tests/createAdmin.test.js` | Unit (in-memory MongoDB) | Admin bootstrap: creates an active ADMIN with hashed password; normalizes email; idempotent (no duplicate, password unchanged); refuses to promote an existing non-admin (409); enforces password policy |
| `tests/password.policy.test.js` | Unit | Accepts a valid password; rejects missing/non-string, < 8 chars, > 72 bytes (incl. multi-byte characters), no digit, no letter |
| `tests/profile.test.js` | API (in-memory MongoDB) | **Auth:** every `/profile` endpoint → 401 without token. **Get:** defaults (`jobTitle`, `bio`, `skills`), no `password`/`passwordChangedAt`. **Update:** names/job title/bio trimmed; partial update; clearing with `""`; `email`/`role`/`isActive`/`password` ignored; empty update 400; per-field validation. **Password:** new token returned and working, new password logs in, old one refused; token issued before the change → 401; wrong current password → 400 (not 401); missing fields, weak or unchanged new password → 400. **Skills:** full replacement; `[]` clears; available to PROJECT_MANAGER; unknown item fields dropped; duplicate names (case-insensitive) 400; errors of every invalid item reported; non-array / > 50 items 400 |

| `tests/projects.test.js` | API (in-memory MongoDB) | **Create:** PM only (403 ADMIN/DEVELOPER); creator becomes manager, status PLANNING, technologies trimmed; body `manager`/`members` ignored; validation (name, dates, status, duplicate technologies, non-array); deadline before start date; no ARCHIVED creation. **List:** PM sees managed projects, developer sees member projects, admin sees all (newest first); status filter, name search, invalid filter 400. **Get:** manager/member/admin 200 with populated members; outsider and other PM 404; unknown 404, invalid id 400. **Update:** fields & status; `deadline: null`; date check against stored values; member/admin 403, outsider 404; empty update 400; archived project only accepts a status change (409). **Delete:** manager 204, member 403. **Members:** add (201, grants access), duplicate 409, non-developer/deactivated 400, unknown 404, invalid id 400, only manager (403), remove (access lost), remove non-member 404, archived 409 |
| `tests/developers.test.js` | API (in-memory MongoDB) | Active developers only, sorted by last name, public fields only; exact case-insensitive skill filter; search; ADMIN 200, DEVELOPER 403 |
| `tests/sprints.test.js` | API (in-memory MongoDB) | **Create:** manager only (403 member/admin, 404 outsider), always PLANNED, validation, end before start 400, archived project 409. **Read:** chronological list, status filter, viewers vs outsiders. **Update:** open sprint OK, completed sprint 409, member 403. **Status:** PLANNED→ACTIVE→COMPLETED with `completedAt`; invalid transitions 409; second active sprint 409 (service message) and duplicate key at DB level; unknown status 400. **Delete:** PLANNED 204, started 409; project with sprints cannot be deleted (409) |
| `tests/tasks.test.js` | API (in-memory MongoDB) | **Create:** TODO in backlog, defaults, sprint/assignee at creation, foreign or closed sprint, non-member assignee, field validation (type, priority, story points, ids), permissions (403/404). **List:** all filters (status, priority, type, search, overdue, assignee id/unassigned, sprint id/backlog), `isOverdue` flag, invalid filter 400, outsider 404. **Get/update/delete:** viewers only, move to sprint and back to backlog, clear deadline, empty update 400, manager only. **Workflow:** assignee goes TODO→…→DONE (`completedAt`), skipped steps 409, BLOCKED with reason cleared on unblock, reopen clears `completedAt`, assignee required to start, other developer/admin 403, unknown status 400. **Assignment:** assign/reassign/unassign, cannot unassign in progress, non-member/deactivated 400, assigneeId required, manager only. **Board:** columns in workflow order + BLOCKED, priority ordering, counts, scopes SPRINT/BACKLOG/ALL, foreign sprint 404. **My tasks:** deadline ordering (none last), populated project/sprint, status filter, former projects hidden. **Stats & guards:** sprint story-point statistics, deleted sprint → backlog, member with open tasks 409, project with tasks 409, archived project read-only |
| `tests/comments.test.js` | API (in-memory MongoDB) | Members and manager comment (trimmed, author populated); admin 403, outsider 404; content validation; archived 409; oldest-first pagination for all viewers; author-only edit with `editedAt`; author or manager delete, other member 403; unknown 404, invalid id 400; comments deleted with their task |
| `tests/activities.test.js` | API (in-memory MongoDB) | Full scenario records PROJECT_CREATED, MEMBER_ADDED, SPRINT_CREATED, TASK_CREATED, TASK_ASSIGNED, TASK_UPDATED (only really changed fields), TASK_STATUS_CHANGED, COMMENT_ADDED, PROJECT_STATUS_CHANGED, newest first with populated actor/target; type filter; task history; unassignment, sprint status, task deletion snapshots; outsider 404, invalid type 400; a failing history write does not fail the main request |
| `tests/notifications.test.js` | API (in-memory MongoDB) | Generated from activity: member added, task assigned/unassigned, status change (to manager only, not the author), comment (to assignee), sprint started (to members), member removed; author never notified; storage failure does not fail the action. Endpoints: newest first with `unreadCount` and actor, pagination, mark one read (`readAt`), `unread=true` filter, unread counter, read-all, delete, other users' notifications 404, validation 400, 401 without token. TTL index of 90 days present |
| `tests/dashboard.test.js` | API (in-memory MongoDB) | Manager: project counts by status, task totals (completed, blocked, overdue, by status, by priority), active sprint with `daysRemaining` and story-point progress, workload sorted by open points (no `myTasks`/`platform`). Developer: own projects + `myTasks`, no workload. Admin: all projects + platform user counts by role. User without projects: zeros. 401 without token. Project dashboard: project info (`daysRemaining`, member count), sprint counts, active sprint, every member in the workload (incl. 0), outsider 404, invalid id 400 |
| `tests/search.test.js` | API (in-memory MongoDB) | Case-insensitive search in project name and task title/description, only in visible projects; populated task project; per-type limit with total; regex characters as text; `q` missing/too short/too long and limit > 20 → 400 |

| `tests/aiClient.test.js` | Unit + API | AI client (TASK 21): service token and JSON body sent; 503 when not configured or unreachable; 504 on timeout; content refused by the AI service → 400 with its details; 5xx, refused token or invalid body → 502. `GET /ai/status`: 401 without token, available with the LLM state, reasons when unavailable (never an error) |
| `tests/aiPlan.test.js` | API (in-memory MongoDB, mocked AI client) | AI-01 (TASK 22). **Plan:** specification, project context and team skills sent; uploaded file extracted and joined to the pasted text; default options; missing / short text, invalid options, unsupported file (415) refused; reserved to the manager of an active project; duplicate skills of the AI answer removed; AI refusal forwarded (400), AI down (503); invalid AI answers → 502; default start date (today, project start, day after the last sprint). **Apply:** PLANNED sprints + TODO tasks + one `AI_PLAN_APPLIED` activity; every field validated; empty plan, too many tasks or sprints, dates in the wrong order refused; nothing left when the creation fails midway; manager only |

| `tests/aiRecommendation.test.js` | API (in-memory MongoDB, mocked AI service) | AI-02 (TASK 23): task and **active** members sent with their workload (open tasks / points in every project, the task itself excluded) and experience (DONE tasks, skill counts); ranking returned with the developers' public fields; current assignee marked; no developer → empty answer without AI call; invalid AI answers (unknown id, score > 100, duplicate, wrong method, missing breakdown) → 502; AI down → 503; manager only (member / admin 403, outsider 404, archived 409, invalid id 400) |
| `tests/aiRisk.test.js` | API (in-memory MongoDB, mocked AI service) | AI-03 (TASK 24): sprint measures (total, done, blocked, open 8+ points, unassigned, points), active team size, velocity of the last completed sprint, today's date; validated risk returned with the measures; no history → `historicalVelocity: null`; any viewer (admin included), outsider 404; closed sprint 409 without AI call; invalid answers (level, probability, factor, feature, model) → 502; timeout → 504 |
| `tests/aiAssistant.test.js` | API (in-memory MongoDB, mocked AI service) | AI-04 (TASK 25): conversation and project context sent; read tools run on the project data (tasks, overview) and returned to the model; **write tools become proposals with readable summaries and change nothing**; invalid references (task of another project, non-member, forbidden transition), invalid arguments and unknown tools (`delete_task`) reported to the model; step limit (6); 503 `LLM_NOT_CONFIGURED`; invalid AI answer 502; conversation validation (empty, last not user, too long, `system` role); manager only. **Actions:** create task (history), assign, block, update (move to backlog), create sprint; same validation as the REST API (400 / 409 / 404), no delete tool; manager only |

`tests/user.model.test.js` also covers (TASK 05): duplicate skill names and unknown levels rejected by the schema, > 50 skills rejected, `passwordChangedAt` set on change but not at creation, `isTokenIssuedBeforePasswordChange` boundaries.
| `tests/user.model.test.js` | Unit (in-memory MongoDB) | Defaults (DEVELOPER, active, timestamps); password hashed on save and checked by `comparePassword`; no re-hash when another field changes; password not selected by default; JSON without `password`/`_id`/`__v`; unknown role rejected; unique email index (case-insensitive through lowercase) |

## 3b. Frontend test inventory

| File | What is verified |
|------|------------------|
| `core/http/api-error.interceptor.spec.ts` | Successful responses untouched; backend error body → `ApiError` (status, code, message, field details) without toast for 4xx; network error → status 0 `NETWORK_ERROR` + toast; 502 without body → fallback message + toast; 500 → backend message in toast; `SKIP_ERROR_TOAST` disables the toast |
| `core/services/health.service.spec.ts` | `GET /api/v1/health` → backend & database up; 503 → backend up / database down (no toast); 502 → `ApiError` emitted, no global toast |
| `core/services/toast.service.spec.ts` | success / info / error open a snack bar (loaded on demand) with the right style and duration; messages shown in the order requested |
| `shared/components/error-state/error-state.spec.ts` | Message rendered as an alert; "Try again" emits `retry`; button hidden when not retryable |
| `features/home/home.spec.ts` | Loading state; three services operational; database outage highlighted; backend unreachable → error state, retry calls the service again and shows the status |
| `layouts/main-layout/main-layout.spec.ts` | Application name; navigation links by role (Home, Dashboard, Projects, My profile; My tasks for developers, Users for administrators); toolbar search; notifications bell with the unread count; menu button only on handsets; user menu with My profile link |
| `app.spec.ts` | Routing with a fake session: signed-in user → home in the layout with tab title (regression test for the redirect loop), unknown URL → not-found page, `/login` → sent home, `/profile` with title "My profile", `/admin/users` refused (toast + home), `/projects` → `/projects/new` ("new" not read as an id) → `/projects/p1` with their titles; developer → `/projects/new` and `/projects/:id/edit` refused; administrator → `/admin/users` with title "Users"; visitor → `/login?returnUrl=…` with title "Sign in", `/register` without side navigation |
| `core/auth/jwt.spec.ts` | Payload decoding, unreadable tokens → null, expiry date, expired / not expired / no `exp` |
| `core/auth/token-storage.spec.ts` | Save/load, partial or corrupted storage → null, clear |
| `core/auth/auth.service.spec.ts` | Login (POST body, no Authorization header, session persisted), register, restore valid session, discard expired session, refresh user with Bearer header, 401 → session ended + toast + redirect to login, automatic logout at token expiry (fake timers), session user updated with the token kept, new token after a password change, logout |
| `core/auth/auth.interceptor.spec.ts` | Bearer header on API requests only (never another origin), no header without session, 401 on authenticated request → `expireSession`, 401 without session and 403 → session kept |
| `core/auth/auth.guards.spec.ts` | `authGuard` (allow / redirect with returnUrl), `guestGuard`, `roleGuard` (allow / refuse with message), `safeReturnUrl` (8 cases incl. `//host`, backslash, `https://`, `javascript:`) |
| `shared/forms/forms.spec.ts` | Password policy validator (same cases as the backend incl. multi-byte), confirmation validator, first error message, backend messages applied to controls and cleared on edit, array paths (`skills[1].level`) mapped to `FormArray` controls, `formSubmitError`, integer validator |
| `shared/components/confirm-dialog/confirm-dialog.spec.ts` | Title, message and destructive style; confirm → `true`, Cancel → `false` |
| `features/profile/profile.service.spec.ts` | `GET`/`PATCH /profile`, `PUT /profile/skills`, `PATCH /profile/password` (session switched to the new token); session user refreshed on success, untouched on error |
| `features/profile/profile.spec.ts` | Loader, account card (email, role, member since) and the three forms; load error + retry |
| `features/profile/profile-info-form/profile-info-form.spec.ts` | Current values, Save enabled only after a change, validation (blank first name, bio > 500), trimmed values sent + toast + `saved` event, Cancel, backend field messages vs. other errors |
| `features/profile/skills-form/skills-form.spec.ts` | Current skills, empty state, add / remove, whole list saved (years optional), duplicate names (case-insensitive) and non-integer years refused, backend messages on `skills[i].name` and on the list, Cancel, no error on a new empty skill after a save (regression) |
| `features/profile/password-form/password-form.spec.ts` | Required fields, password policy + confirmation, success → toast + form cleared **without error messages** (regression), wrong current password on its field (400, session kept), show / hide |
| `features/users/user-admin.service.spec.ts` | Query parameters (only the filters that are set, trimmed search), `PATCH /users/:id/status`, `PATCH /users/:id/role` |
| `shared/data/paged-list.spec.ts` | Items / total / loading, only the latest query displayed (slow response ignored), error message then recovery, item replaced in place; `actionErrorMessage` (network, 5xx and 401 → null) |
| `features/projects/project.service.spec.ts` | List parameters, get, create (empty deadline not sent), update (deadline `null`), status, delete, add / remove member; `DeveloperService` search parameters (name and skill) |
| `features/projects/project-list/project-list.spec.ts` | Cards (link, manager, status, dates in UTC, technologies "+N", team size), "New project" and subtitle per role, empty states per role / filters, debounced search + status filter (harness), error + retry |
| `features/projects/project-form/project-form.spec.ts` | Today as default start date, technologies as chips (Enter, duplicates ignored, remove), creation payload + toast + navigation, validation (blank name, deadline before start, re-check when the start date moves), backend field messages, edition (fields filled, cleared deadline → `null`), refusal for another manager's or an archived project |
| `features/projects/add-members-dialog/add-members-dialog.spec.ts` | Developers with skills, members marked "In the team", search by name and by skill (same text in both fields still searches — regression), addition (API call, page callback, toast, row updated), refused addition reported, empty state |
| `features/projects/project-shell/project-shell.spec.ts` | Header and tabs (Overview, Sprints, Tasks, Board, Activity, Dashboard), manager actions vs read-only administrator, status change (archiving confirmed, read-only banner), deletion confirmed + navigation, refused deletion (409), reload on `:id` change, 404 without retry |
| `features/projects/project-overview/project-overview.spec.ts` | Overview and team, team management only for the manager (not admin, not archived), member removal (409 then success), "Add developers" dialog and page updated from it |
| `features/sprints/sprint-list/sprint-list.spec.ts` | Sprints with dates, progress, counts and links; actions allowed by the status; read-only for others; start without confirmation (409 reported); complete / cancel / delete confirmed then reload; form dialog; empty state |
| `features/sprints/sprint-form-dialog/sprint-form-dialog.spec.ts` | Two-week default from today, creation payload, validation (name, end ≥ start), edition with backend error |
| `features/tasks/task.service.spec.ts` | Task list filters, my tasks, creation (empty deadline not sent), update (deadline `null`), status with / without reason, assignee, get / delete; `SprintService` (all sprints in one request, CRUD, status) |
| `features/tasks/task-workflow.spec.ts` | Transition table, assignee required to start, move + toast, blocking reason asked (cancel = no change), backend refusal; `BlockReasonDialog` (trimmed reason, too long refused) |
| `features/tasks/task-form-dialog/task-form-dialog.spec.ts` | Creation in the pre-selected sprint with assignee and skills (defaults: Feature, Medium, 3 points), only open sprints offered, edition (closed sprint of the task kept, no assignee field), validation and backend errors |
| `features/tasks/task-list/task-list.spec.ts` | Rows (status, priority, assignee, sprint, overdue), `?sprint=` filter + status filter, creation by the manager then reload, no creation for members |
| `features/tasks/task-detail/task-detail.spec.ts` | Details, allowed moves (start needs an assignee), move then new targets, blocked reason, assignee vs other members, assignment (refusal restores the previous value), edition, deletion + navigation, comments and history sections |
| `features/tasks/my-tasks/my-tasks.spec.ts` | My tasks with project, sprint, deadline / overdue and link, status filter, empty state |
| `features/kanban/kanban-board/kanban-board.spec.ts` | Active sprint by default, six columns with counts, cards, `?sprint=` / backlog / all scopes, "Move to" menu (allowed targets, assignee required) then reload, assignee vs other members, error + retry |
| `core/models/activity.spec.ts` | Readable text of the activity types (labels, missing user) |
| `core/services/notification.service.spec.ts` | List + unread count, silent badge refresh (no toast), mark read / delete update the count only for unread ones, mark all |
| `features/comments/comment.service.spec.ts` | Comment requests; activity requests (project with type filter, task) |
| `shared/data/load-more-list.spec.ts` | Pages appended until everything is loaded, response before a reset ignored, replace / remove, errors |
| `features/comments/task-comments/task-comments.spec.ts` | List, post + reload + event, empty comment refused, author edits / deletes, manager moderates but does not edit, no comment for an administrator nor in an archived project, backend refusal |
| `features/activity/project-activity/project-activity.spec.ts` | Project timeline with "Show older entries", filter by event type; `TaskHistory` reloads when the task page changes it |
| `features/notifications/notification-list/notification-list.spec.ts` | Unread highlighted, open = mark as read + navigation (none for "removed from project"), mark all, delete, unread only |
| `features/dashboard/dashboard.service.spec.ts` | Dashboard and search requests; `describeDaysRemaining` |
| `features/dashboard/dashboard-widgets.spec.ts` | Task charts (single-hue horizontal bars ≤ 24 px, values as text, empty state), workload table (bars relative to the heaviest, blocked highlighted), active sprint card (link to its board, late) |
| `features/dashboard/dashboard-pages.spec.ts` | Dashboard of a manager (figures, charts, sprints, workload), a developer (my tasks first), an administrator (accounts), error + retry; project dashboard (deadline, members, sprints by status, workload of every member, no deadline / no active sprint) |
| `features/search/search-page/search-page.spec.ts` | Query from the URL, projects and tasks with links, "x of y shown", nothing below 2 characters, typing updates the URL (debounced), error + retry |
| `features/users/user-list/user-list.spec.ts` | First page, own account marked "You" without actions, debounced search + role/status filters (Angular Material test harnesses), pagination, role change after confirmation (row updated + toast), cancelled confirmation, deactivate with confirmation / activate without, backend refusal → toast, load error + retry |
| `features/auth/login/login.spec.ts` | Validation messages without API call, login + navigation to returnUrl, external returnUrl ignored, explicit messages for 401 and 403, password visibility toggle |
| `features/auth/register/register.spec.ts` | Password policy and confirmation messages, confirmation re-checked when the password changes, developer by default + success toast + navigation, project manager choice, 409 → "already registered" on the email field, backend 400 details on fields, other errors above the form |

| `features/ai-plan/ai-plan.service.spec.ts` | AI-01 (TASK 22): multipart form (text, file, start date, options), empty text / missing file / automatic date not sent, AI errors left to the page (no global toast), reviewed plan posted as JSON |
| `features/ai-plan/ai-plan-page/ai-plan-page.spec.ts` | Analyzer shown (local: the document stays on the servers; OpenAI: it is sent to OpenAI); generation disabled when the AI service is down; ≥ 20 characters or a file; file type and size checked before upload; option ranges; spinner then error with the input kept; review (method, stats, warnings, sprint names, points vs capacity, backlog); edit + move (Material menu harness) + delete + remove a sprint → exact apply payload (no epic), toast, navigation to the Sprints tab; add a sprint (next number and dates); invalid plan refused before sending; backend field errors shown on the matching fields; Back keeps the input; reserved to the manager of a non-archived project |

| `features/ai-recommendation/recommend-dialog/recommend-dialog.spec.ts` | AI-02 (TASK 23): ranking with score, matching / missing skills, explanation, formula and warnings; current assignee without button; assign → dialog closes with the updated task; refused assignment → toast, dialog stays; AI error with retry → empty list message; `AiRecommendationService` (GET without global toast) |
| `features/ai-risk/sprint-risk/sprint-risk.spec.ts` | AI-03 (TASK 24): level, probability and factors; low risk and warnings; reload when the sprint changes; discreet message when the AI service is unavailable; `AiRiskService` (GET without global toast) |
| `features/ai-assistant/assistant-page/assistant-page.spec.ts` | AI-04 (TASK 25): explanation and suggestions; unavailable without OpenAI key or AI service (Send disabled); Enter sends, "thinking" state, history sent back; proposal applied only after **Confirm** (toast, result, outcome appended to the history sent to the assistant); dismiss; refused proposal shows the reason; error gives the question back; new conversation; manager of an active project only; `AiAssistantService` (chat without global toast, apply) |

`task-detail.spec.ts` also covers the "Recommend a developer" button (manager only, assignment from the dialog); `dashboard-widgets.spec.ts`, `dashboard-pages.spec.ts` and `sprint-list.spec.ts` the risk indicator on active sprints (only the active sprint is requested); `project-shell.spec.ts` the **Assistant** tab (manager only).

`core/models/activity.spec.ts` also covers `AI_PLAN_APPLIED` ("created 12 tasks in 3 sprints with the AI planner", singular, backlog only); `sprint-list.spec.ts` the "Plan with AI" link (manager only).

### AI service test inventory (`ai-service/tests/`)

| File | What is verified |
|------|------------------|
| `test_service.py` | Health says which analyzer will be used (a configured LLM is reported without the key); settings: token ≥ 32 characters, blank key = no LLM; AI routes require the backend token; unknown route in the backend error format |
| `test_text_extraction.py` | `.txt` and `.md`, Windows-encoded (cp1252) text, `.docx` (headings, lists, tables kept), `.pdf`; long text truncated; rejected files; PDF without text rejected |
| `test_requirement_parser.py` | French and English specifications: epics from headings, context and out-of-scope sections skipped, explicit metadata (MoSCoW, points, days, several markers in one bracket), user stories with acceptance criteria, sub-items, numbered headings, tables (with and without header), requirement sentences, duplicates, sentence fallback, nothing usable → 422, at most 100, language detection |
| `test_task_enricher.py` | Inferred priority and story points; skills (team spelling, project stack, at most 5, no partial-word matches); explicit values combined with inferred ones; BUG only when a correction is explicit |
| `test_sprint_planner.py` | Packing by priority within the capacity, gaps filled by the same priority, a lower priority never before a higher one, dates / names / objective, oversized task alone with a warning, at most 20 sprints then backlog (+ excluded tasks), deadline warning, no task → no sprint |
| `test_ml.py` | Normalisation (case, accents), features (stop words dropped, lexicon cues), Naive Bayes learns and survives serialisation, unknown words ignored, cross-validation metrics per class, type prediction, low confidence → FEATURE, model trained when the file is missing |
| `test_llm_client.py` | Strict structured-output request, retry without temperature, HTTP / format errors → `LlmError`, timeout and network errors, the API key never logged |
| `test_recommendation.py` | AI-02 (TASK 23): skill keys (case, accents, punctuation, aliases; C++ ≠ C#); formula of a full match (exact breakdown and score); ranking balancing skills, workload and experience; beginner halved on 8+ points; workload 0 beyond capacity, ties by load then name; skills inferred from the text; neutral score without skills; warnings and `limit`; route, validation (400) and token |
| `test_sprint_risk.py` | AI-03 (TASK 24): features of a snapshot (ratios, caps, usual pace); logistic regression learns a separable rule and survives serialisation; ROC AUC / metrics / stratified split helpers; dataset reproducible (seed) and balanced; trained model ≥ 0.8 accuracy, ≥ 0.9 ROC AUC and better F1 than the baseline rule (saved in a temporary folder); risk levels; on-track sprint LOW; late sprint HIGH with its 3 factors and labels; rules (empty, all done, overdue); a MEDIUM risk always names a cause; warnings; route and validation |
| `test_assistant.py` | AI-04 (TASK 25): tools match their Pydantic schemas, all strict, no delete tool; system prompt rules (proposals only, no deletion, untrusted data) and project; tool-call validation (valid → cleaned arguments; wrong points, unknown tool, bad JSON, extra field → error); 503 without key; final answer and the payload sent to OpenAI (tools, system prompt); tool calls returned with validation errors; previous tool calls and results sent back in OpenAI format; OpenAI failures (429, cut, empty) → 502; token and body validation |
| `test_planning_api.py` | Token required on both routes; plan with the local analyzer; plan with the (mocked) LLM; invalid or failed LLM answer → local fallback with a warning; long document truncated for the LLM; request validation; no requirement → 422; extraction of a Word document, unsupported / too large files, missing file |

`layouts/main-layout/main-layout.spec.ts` and `features/home/home.spec.ts` also cover the user menu (name, role, logout) and the greeting.

## 4. Test execution log

| Date | Task | Service | Command | Result |
|------|------|---------|---------|--------|
| 2026-10-02 | TASK 02 | Backend | `npm test` | 4 suites, 24 tests passed (2 consecutive runs) |
| 2026-10-02 | TASK 02 | Backend | `npm run test:coverage` | Statements 96.09 %, branches 80 %, functions 92.85 %, lines 98.29 % |
| 2026-10-02 | TASK 02 | Backend | `npm run lint` | 0 errors, 0 warnings |
| 2026-10-02 | TASK 03 | Backend | `npm test` | 7 suites, 72 tests passed (2 consecutive runs) |
| 2026-10-02 | TASK 03 | Backend | `npm run test:coverage` | Statements 98.07 %, branches 87.5 %, functions 96.07 %, lines 99.18 % |
| 2026-10-02 | TASK 03 | Backend | `npm run lint` | 0 errors, 0 warnings |
| 2026-10-02 | TASK 04 | Backend | `npm test` | 10 suites, 115 tests passed (2 consecutive runs) |
| 2026-10-02 | TASK 04 | Backend | `npm run test:coverage` | Statements 98.11 %, branches 88.72 %, functions 95.52 %, lines 99.15 % |
| 2026-10-02 | TASK 04 | Backend | `npm run lint` | 0 errors, 0 warnings |
| 2026-10-02 | TASK 05 | Backend | `npm test` | 11 suites, 148 tests passed (2 consecutive runs) |
| 2026-10-02 | TASK 05 | Backend | `npm run test:coverage` | Statements 98.28 %, branches 89.87 %, functions 96.51 %, lines 99.31 % |
| 2026-10-02 | TASK 05 | Backend | `npm run lint` | 0 errors, 0 warnings |
| 2026-10-02 | TASK 06 | Backend | `npm test` / `npm run test:coverage` | 13 suites, 188 tests passed; statements 98.42 %, branches 90.76 %, lines 99.23 % |
| 2026-10-02 | TASK 06 | Backend | `npm run lint` | 0 errors, 0 warnings |
| 2026-10-02 | TASK 07 | Backend | `npm test` / `npm run test:coverage` | 14 suites, 211 tests passed; statements 98.17 %, branches 90.5 %, lines 98.97 % |
| 2026-10-02 | TASK 07 | Backend | `npm run lint` | 0 errors, 0 warnings |
| 2026-10-02 | TASK 08 | Backend | `npm test` / `npm run test:coverage` | 15 suites, 254 tests passed; statements 98.8 %, branches 92.73 %, lines 99.3 % |
| 2026-10-02 | TASK 08 | Backend | `npm run lint` | 0 errors, 0 warnings |
| 2026-10-02 | TASK 09 | Backend | `npm test` | 17 suites, 271 tests passed |
| 2026-10-02 | TASK 09 | Backend | `npm run lint` | 0 errors, 0 warnings |
| 2026-10-02 | TASK 10 | Backend | `npm test` | 18 suites, 281 tests passed |
| 2026-10-02 | TASK 10 | Backend | `npm run lint` | 0 errors, 0 warnings |
| 2026-10-02 | TASK 11 | Backend | `npm test` / `npm run test:coverage` | 20 suites, 295 tests passed; statements 98.98 %, branches 91.23 %, functions 98.93 %, lines 99.49 % |
| 2026-10-02 | TASK 11 | Backend | `npm run lint` / `npm audit --omit=dev` | 0 errors, 0 warnings / 0 vulnerabilities |
| 2026-10-02 | TASK 12 | Frontend | `npm run test:ci` | 7 files, 23 tests passed |
| 2026-10-02 | TASK 12 | Frontend | `npm run lint` / `npm run format:check` | All files pass linting / Prettier style OK |
| 2026-10-02 | TASK 12 | Frontend | `npm run build` | Success; initial bundle 494 kB raw / 120 kB transferred; lazy chunks: home 24 kB, not-found 1 kB |
| 2026-10-02 | TASK 12 | Frontend | `npm audit --omit=dev` | 0 vulnerabilities |
| 2026-10-02 | TASK 13 | Frontend | `npm run test:ci` | 15 files, 90 tests passed |
| 2026-10-02 | TASK 13 | Frontend | `npm run lint` / `npm run format:check` / `npm run build` | Pass / pass / success, initial bundle 471 kB raw (119 kB transferred) |
| 2026-10-02 | TASK 14 | Frontend | `npm run test:ci` | 23 files, 143 tests passed |
| 2026-10-02 | TASK 14 | Frontend | `npm run lint` / `npm run format:check` | All files pass linting / Prettier style OK |
| 2026-10-02 | TASK 14 | Frontend | `npm run build` | Success; initial bundle 499.7 kB raw / 125 kB transferred (budget warning at 500 kB); lazy chunks: user-list 128 kB, profile 22 kB. The +29 kB come from CDK overlay / accessibility code shared by the new Material menus, selects and dialog, which the bundler keeps in the initial chunk (measured: 470.8 kB with the two new routes removed) |
| 2026-10-02 | TASK 14 | Frontend | `npm audit --omit=dev` | 0 vulnerabilities |
| 2026-10-02 | TASK 14 | Backend | `npm test` / `npm run lint` | 20 suites, 295 tests passed / 0 errors (backend unchanged) |
| 2026-10-02 | TASK 15 | Frontend | `npm run test:ci` | 29 files, 194 tests passed |
| 2026-10-02 | TASK 15 | Frontend | `npm run lint` / `npm run format:check` | All files pass linting / Prettier style OK |
| 2026-10-02 | TASK 15 | Frontend | `npm run build` | Success; **initial bundle 341.6 kB raw / 94.4 kB transferred** (500.8 kB / 125.8 kB before the snack bar was loaded on demand — the 500 kB budget warning is gone); lazy chunks: project-form 86 kB, user-list 54 kB, project-detail 22 kB, project-list 11 kB |
| 2026-10-02 | TASK 15 | Frontend | `npm audit --omit=dev` | 0 vulnerabilities |
| 2026-10-02 | TASK 16 | Frontend | `npm run test:ci` / lint / format / build | 38 files, 240 tests passed / pass / pass / success, initial bundle 342.5 kB |
| 2026-10-02 | TASK 17 | Frontend | `npm run test:ci` / lint / format / build | 39 files, 245 tests passed / pass / pass / success, initial bundle 342.6 kB |
| 2026-10-02 | TASK 18 | Frontend | `npm run test:ci` / lint / format / build | 46 files, 283 tests passed / pass / pass / success, initial bundle 342.9 kB |
| 2026-10-02 | TASK 18 | Backend | `npm test` / `npm run lint` | 20 suites, 296 tests passed (+1: a deleted project takes its notifications with it) / 0 errors |
| 2026-10-03 | TASK 19 | Frontend | `npm run test:ci` | 50 files, 307 tests passed |
| 2026-10-03 | TASK 19 | Frontend | `npm run lint` / `npm run format:check` / `npm run build` | Pass / pass / success; initial bundle 344.0 kB raw / 95.6 kB transferred; Chart.js only in the lazy dashboard chunks (dashboard-page 7 kB, project-dashboard 5 kB + shared Chart.js chunk) |
| 2026-10-03 | TASK 19 | Frontend | `npm audit --omit=dev` | 0 vulnerabilities (chart.js 4.5.1 added) |
| 2026-10-03 | TASK 20–22 | AI service | `pytest -q` / `flake8 app tests` | 102 tests passed / clean (previous agent, Python 3.14.8) |
| 2026-10-03 | TASK 21–22 | Backend | `npm test` / `npm run lint` / `npm audit --omit=dev` | 22 suites, 325 tests passed / 0 errors / 0 vulnerabilities (multer 2.4.0 added) |
| 2026-10-03 | TASK 22 | Frontend | `npm run test:ci` | 52 files, 329 tests passed (+22: AI plan service and page, activity type, Sprints link) |
| 2026-10-03 | TASK 22 | Frontend | `npm run lint` / `npm run format:check` / `npm run build` | Pass / pass / success; initial bundle 344.7 kB raw / 95.8 kB transferred (the AI plan page is lazy-loaded). Run with Node 24.21 (the machine's Node 22.21.1 is refused by Angular CLI 22) |
| 2026-10-03 | TASK 22 | AI service | `pytest -q` / `flake8 app tests` / `python -m app.ml.task_type_model` | 103 tests passed (+1: several markers in one bracket) / clean / accuracy 0.916, macro F1 0.921 (Python 3.12.5, new virtual environment) |
| 2026-10-03 | TASK 22 | Backend | `npm test` / `npm run lint` / `npm audit --omit=dev` | 22 suites, 325 tests passed / 0 errors / 0 vulnerabilities (backend unchanged by the end of TASK 22) |
| 2026-10-03 | TASK 23 | All | pytest / Jest / Vitest + lint, format, build | AI service 117 tests (+14), flake8 clean; backend 23 suites, 335 tests (+10); frontend 53 files, 335 tests (+6), lint / format pass, build success, initial bundle 344.7 kB. Node 22.22.3 installed by the supervisor (Angular CLI runs natively) |
| 2026-10-03 | TASK 24 | AI service | `pytest -q` / `python -m app.ml.sprint_risk_model` | 135 tests (+18); test set: accuracy 0.864, precision 0.875, recall 0.847, F1 0.861, ROC AUC 0.934 (baseline rule: accuracy 0.696, F1 0.573) |
| 2026-10-03 | Fix (supervisor test) | AI service / Backend | `pytest -q` / `npm test`, flake8, ESLint | 148 tests (+2: 429 `insufficient_quota` vs rate limit) / 358 tests (+1: explicit 502 message passed on, 500 kept generic) — found when the supervisor's OpenAI key answered "no credits remaining" |
| 2026-10-03 | Gemini thought signature, retry | AI service / Backend | `pytest -q` / Jest | 159 tests (+2) / 359 tests (+1) |
| 2026-10-03 | LLM provider configurable | AI service / Frontend | `pytest -q`, flake8 / Vitest | Provider detected from `OPENAI_BASE_URL` (OpenAI, Google Gemini, Groq, Ollama); compatible mode without `strict`, with `max_tokens`; JSON code fences accepted; Google errors (400 "API key not valid", list-wrapped 429) named; the UI names the real provider (data-sharing notice of Plan with AI, home, assistant) |
| 2026-10-03 | TASK 24–25 | All | pytest / Jest / Vitest + lint, format, build, audit | AI service **146 tests**, flake8 clean; backend **25 suites, 357 tests**, lint 0 errors, 0 vulnerabilities; frontend **55 files, 349 tests**, lint / format pass, build success, initial bundle 348.6 kB raw / 97.0 kB transferred, 0 vulnerabilities |

### Manual verification (TASK 02)

Real `src/server.js` started against the local MongoDB (`mongodb://localhost:27017/smart_project_manager`):

| Check | Result |
|-------|--------|
| `GET /api/v1/health` | 200, `"database":{"status":"connected"}`, `Access-Control-Allow-Origin: http://localhost:4200`, `X-Content-Type-Options: nosniff` |
| `GET /api/v1/projects` (not implemented) | 404 JSON error |
| `POST /api/v1/health` with malformed JSON | 400 JSON error |
| Start with empty `MONGODB_URI` | Exit 1: `Invalid configuration: MONGODB_URI is required` |
| Start with `PORT=abc` | Exit 1: `Invalid configuration: PORT must be an integer between 1 and 65535` |
| Start with unreachable MongoDB | Exit 1 after 10 s: `connect ECONNREFUSED` |

### Manual verification (TASK 03)

Real `src/server.js` against the local MongoDB, with throw-away `@smoke.test` accounts deleted afterwards:

| Check | Result |
|-------|--------|
| Register PROJECT_MANAGER / DEVELOPER | 201, token + user, no password in response |
| Register with `role: ADMIN` | 400, `Role must be one of: DEVELOPER, PROJECT_MANAGER` |
| Register same email in other case | 409 |
| Login valid / wrong password / unknown email | 200 / 401 (0.34 s) / 401 (0.34 s after the first call) — same message and similar timing |
| `GET /auth/me` with / without token | 200 / 401 |
| MongoDB `users` indexes | `_id_`, `email_1` (unique) |
| Stored password | bcrypt hash, `$2b$12$…`, 60 characters |
| Start without `JWT_SECRET`, or with short secret / `JWT_EXPIRES_IN=forever` / `BCRYPT_SALT_ROUNDS=20` | Exit 1 with all configuration errors listed |

### Manual verification (TASK 04)

Real `npm run create-admin` and `src/server.js` against the local MongoDB, with throw-away `@smoke.test` accounts deleted afterwards:

| Check | Result |
|-------|--------|
| `create-admin` without `ADMIN_EMAIL`/`ADMIN_PASSWORD` | Exit 1, clear message |
| `create-admin` with weak password | Exit 1, `Password must be at least 8 characters` |
| `create-admin` with `Admin@Smoke.test` | Exit 0, `Admin account created: admin@smoke.test` |
| `create-admin` run again | Exit 0, `Admin account already exists … nothing changed` |
| Developer calls `GET /users` | 403 |
| Admin `GET /users?search=smoke.test&limit=2` | 200, `{"page":1,"limit":2,"total":3,"totalPages":2}` |
| Admin deactivates developer → developer's token on `/auth/me` | 200 → 401 `Account is deactivated` |
| Admin promotes developer to PM and reactivates → developer's **old** token on `/auth/me` | role `PROJECT_MANAGER`, active |
| Admin deactivates self | 403 |

### Manual verification (TASK 05)

Real `src/server.js` against the local MongoDB, with a throw-away `@smoke.test` account deleted afterwards:

| Check | Result |
|-------|--------|
| `GET /profile` after registration | 200, `jobTitle: ""`, `bio: ""`, `skills: []` |
| `PATCH /profile` with `jobTitle`, `bio` and `role: ADMIN` | 200, job title and bio updated, role still `DEVELOPER` |
| `PUT /profile/skills` with 3 skills | 200, skills stored as sent (optional `yearsOfExperience` omitted when absent) |
| Duplicate skills `Git` / `git` | 400 `Duplicate skill: git` |
| Password change with wrong current password | 400 `Current password is incorrect` |
| Password change (> 1 s after the token was issued) | 200 + new token |
| Old token / new token on `/profile` | 401 `Password has been changed, please log in again` / 200 |
| Login with old / new password | 401 / 200 |
| Stored document | contains `passwordChangedAt`, never returned by the API |

### End-to-end verification of the backend (TASK 06–11)

Real `src/server.js` against the local MongoDB, scripted HTTP scenario following the demo (throw-away `@smoke.test` accounts; every created document deleted afterwards, collections back to 0). **22/22 checks passed, no error in the server log:**

register PM and developer → developer sets skills → create project → developer directory filtered by skill → add developer to the team → activate project → create and start a sprint → create an assigned task in the sprint and a backlog task → developer starts the task → skipping a workflow step refused (409) → move to CODE_REVIEW → Kanban board (`CODE_REVIEW:1`) → manager comments → task history (5 events) → developer notifications (4 unread: comment, assignment, sprint started, added to project) → manager dashboard (2 tasks, 1 active sprint, workload) → project dashboard (sprint progress) → global search → "my tasks".

### Manual verification (TASK 12)

`ng serve` + real backend + local MongoDB:

| Check | Result |
|-------|--------|
| `GET http://localhost:4200/` | 200, `<title>Smart Project Manager</title>` |
| `GET http://localhost:4200/some/unknown/page` | 200 (SPA fallback; the Angular router shows the not-found page) |
| `GET http://localhost:4200/api/v1/health` with the backend **stopped** | 502 from the proxy (→ "backend unreachable" in the UI) |
| `GET http://localhost:4200/api/v1/health` with the backend running | 200 `{"status":"ok", ... "database":{"status":"connected"}}` through the proxy |
| `GET http://localhost:4200/api/v1/projects` without token | 401 with the backend JSON error format through the proxy |

The visual rendering was checked through component tests (jsdom), not in a real browser session.

### Manual verification (TASK 13)

`ng serve` + real backend + local MongoDB (throw-away `@smoke.test` account deleted afterwards): `/login`, `/register`, `/`, `/some/page` served (200); register through the proxy → token + user; login → token; wrong password → 401 `Invalid email or password`; `/auth/me` → 200 with the token, 401 without.

**Browser check (2026-10-02, by the project supervisor):** in a real browser, one `PROJECT_MANAGER` and one `DEVELOPER` account were created through `/register`; each landed on the home page with the right greeting, role and email, the user menu showed the full name, role and **Log out**, and the system status showed Frontend, Backend API and Database as Operational.

### Manual verification (TASK 14)

Through the dev proxy (`http://localhost:4200/api/v1` → backend → local MongoDB), with a throw-away developer and an administrator created by `npm run create-admin` (`@smoke.test` accounts, deleted afterwards) — **21/21 checks passed**:

- `/profile` and `/admin/users` served (200);
- profile read and update; skills saved; invalid level → 400 on `skills[0].level` and duplicate → 400 on `skills` (the field paths the forms map);
- wrong current password → 400 on `currentPassword` (not 401); password changed → new token; old token → 401 "Password has been changed, please log in again"; new token → 200;
- admin: list with search and with role + status filters; developer → 403 on `/users`; change role; deactivate → the user's token gets 401 "Account is deactivated"; reactivate; own account → 403.

### Manual verification (TASK 15)

Through the dev proxy, with a throw-away project manager, two developers (with skills) and an administrator (`@smoke.test` accounts and their project, deleted afterwards) — **26/26 checks passed**:

- `/projects`, `/projects/new`, `/projects/:id`, `/projects/:id/edit` served (200);
- creation without deadline (status `PLANNING`, no `deadline` field); deadline before start → 400 on `deadline`; developer → 403;
- list with search; developer directory filtered by skill (`angular` matches `Angular`);
- add member; same member again → 409; non-developer → 400;
- the member sees the project, an outsider gets 404; member and administrator cannot modify (403), the administrator can view;
- edition with a deadline, then cleared deadline (`null`) removed;
- archive → modification 409 and team change 409 → un-archive allowed; remove member; delete the empty project → 204, then 404.

**Finding (backend, not fixed in this task):** deleting a project removes its activities but not its **notifications**; they keep referencing the deleted project (2 such notifications were removed by the cleanup script). To be handled with the notifications screen (TASK 18).

### Manual verification (TASK 16–19)

Through the dev proxy, with a throw-away project manager and developer (`@smoke.test`, deleted afterwards with their project, sprints, tasks, activities and notifications) — **35/35 checks passed**:

- `/dashboard`, `/search`, `/my-tasks`, `/notifications` and the five project tabs served;
- sprints: creation (PLANNED), start, second active sprint refused (409), statistics;
- tasks: creation in a sprint with assignee (empty deadline not sent), overdue backlog task, filters (sprint, unassigned + overdue); unassigned start refused (409), another developer's task refused (403), skipped steps refused (409); start, block with reason, unblock; my tasks;
- board: six columns for the sprint, backlog scope;
- comments: post, the manager cannot edit (403) but moderates (204), the author edits (`editedAt`); activity recorded (7 types), filtered by type, task history;
- notifications: developer (added, assigned, sprint started) and manager (status changes, comments); mark one / all as read;
- dashboards: manager (workload), developer (my tasks), project (active sprint, overdue); search (projects + tasks), 1 character refused (400);
- backend fix: deleting a project deletes its notifications (1 before, 0 after).

**Test timeout:** `src/app/testing/test-setup.ts` (`angular.json` → `test.options.setupFiles`) sets a 15 s timeout: with 50 spec files running in parallel, a few tests driven by Material harnesses took more than the default 5 s on a loaded machine.

### End-to-end verification (TASK 22, AI-01)

Real backend (port 3000, supervisor's process) + real AI service (`uvicorn`, port 8000, **no OpenAI key → local analyzer**) + local MongoDB `smart_project_manager`, scripted HTTP scenario with a throw-away manager and developer (`@smoke.test`). **17/17 checks passed:**

1. register a manager and a developer; 2. developer skills (Angular, Stripe), project created, developer added;
3. `GET /ai/status` → available, `llm.configured: false`;
4. plan from pasted text (multipart, 3 epics, Must/Should/Could, a bug, documentation, an out-of-scope section) → 200 in < 50 ms, `method: local`, 8 tasks in 3 sprints;
5. every task valid (types, priorities, Fibonacci points), sprints `Sprint 1…`, 14 days from the chosen start date;
6. capacity respected (12, 11, 8 points for a capacity of 13), out-of-scope section skipped;
7. team skills used (`Stripe` on the payment task), bug typed `BUG`, documentation typed `DOCUMENTATION`; 7b. `(Must, 5 pts)` read as HIGH / 5 points and removed from the title;
8. plan from a `.docx` file whose name contains `é` (name kept); 9. plan from a `.pdf` file + pasted text;
10. refused: text too short (400), `.exe` (415), sprint length 40 (400); 11. developer member → 403;
12. apply refused (end before start, empty plan) → 400, nothing created;
13. apply the edited plan (renamed sprint, edited title, a task moved to the backlog) → 201;
14. sprints PLANNED with the new name, tasks TODO and unassigned, edits kept, backlog task without sprint;
15. one `AI_PLAN_APPLIED` activity `{ sprints: 3, tasks: 8, method: "local" }`;
16. a new proposal continues the numbering (`Sprint 4`) and starts the day after the last sprint.

Cleanup: tasks, sprints and project deleted through the API, the 4 `@smoke.test` accounts deleted in `smart_project_manager` (0 left); no other database touched.

**Finding fixed in this task:** check 7b first failed — `(Must, 5 pts)` left `(Must` in the title and the priority at MEDIUM, because MoSCoW tags and points were only recognised in separate brackets. The parser now reads several markers in one bracket (`_metadata_group`, new pytest case).

Not verified: the OpenAI path against the real API (no key on the development machine; covered by mocked tests), and the page in a real browser by the supervisor (covered by component tests).

### End-to-end verification (TASK 23, AI-02)

Separate backend instance (port 3001, same code, the supervisor's own backend on 3000 left untouched) + AI service (8000) + local MongoDB `smart_project_manager`, throw-away `@smoke.test` accounts. **10/10 checks passed:** manager + 3 developers with skills (Angular EXPERT 3 years; angular BEGINNER + NodeJS INTERMEDIATE; Python + Docker) → workload (13 open points for the expert) and experience (1 Angular task DONE by the beginner) → `GET /tasks/:id/ai/recommendations` for an 8-point Angular + Node.js task in 55 ms → ranking Bob 54 > Alice 39 > Carol 25, exactly the documented formula (beginner halved on 8 points, workload 0.35 for 13 / 20 points) → `NodeJS` matched `Node.js`, missing skills listed → assignment of the recommended developer, then marked `isAssignee` → task without skills: Docker inferred from its title → member developer 403, outsider 404 → project without developer: empty list with an explanation. Data deleted (5 accounts, 2 projects).

### End-to-end verification (TASK 24, AI-03)

Same setup. **11/11 checks passed:** a completed sprint (14 points in 14 days → velocity 1) and an active sprint at 50 % of its time with 3 / 30 points done, 2 blocked tasks, 2 open tasks of 8 points, 1 unassigned → `GET /sprints/:id/ai/risk` in 49 ms → **HIGH** (model), measures exact, 3 readable factors ("Needs 3.9× the usual pace…", "Behind schedule: 50% of the time elapsed, 10% of the story points done", "1.9 points per member and per day…"), model metrics returned → a sprint on track **LOW** for a member developer, with the "no completed sprint yet" warning → empty planned sprint LOW by rule → planned sprint with tasks predicted by the model → overdue active sprint HIGH by rule (probability 1) → completed sprint 409, outsider 404 → the project dashboard exposes the active sprint shown with its risk. Data deleted with mongosh in `smart_project_manager` only (started sprints cannot be deleted through the API): 3 projects, 5 sprints, 15 tasks, their activities and notifications, 4 accounts.

### End-to-end verification (TASK 25, AI-04)

Two chains on the same database: **3001 → AI service 8000** (real configuration, no OpenAI key) and **3002 → AI service 8001 → simulated OpenAI server (8090)**, a local script that answers like a model using the tools (it decides from the conversation it receives). **12/12 checks passed:**

1. manager, developer, project with a late and a future task;
2. without key: chat → 503 `LLM_NOT_CONFIGURED` with the instruction to set `OPENAI_API_KEY`;
3. confirmed actions work without the LLM: create task (assigned), create sprint, move to In progress, update (priority, sprint) → 201;
4. invalid arguments 400, `delete_task` 400, developer 403;
5. the applied actions appear in the project history;
6. second chain reports the LLM configured (`mock-model`);
7. "Which tasks are late?" → the backend ran `list_tasks` on the real data → "1 late task(s): «Late login page»." (the future task is not listed);
8. the "OpenAI" server received the 9 tools (no delete), the system prompt with the rules and the project name, and the key header from the AI service only;
9. "Assign the late task to the developer" (with the history) → overview + tasks read, **one proposal** "Assign «Late login page» to Dev25 Smoke", the task still unassigned;
10. confirmation → 201, task assigned, the developer notified;
11. invalid tool arguments (4 story points) refused by the AI service and reported back to the model, no proposal;
12. developer 403, forged `system` message 400.

Data deleted (1 project, 3 tasks, 1 sprint, activities, notifications, 2 accounts). **Live verification with Google Gemini (same day, after the supervisor created a free Gemini key):** backend instance 3002 → AI service 8001 → Google Gemini, `@smoke.test` data deleted afterwards. With `gemini-3.8-flash` the chain worked (late tasks answered from the real data, assignment proposed then confirmed) but the free tier was saturated (repeated 503 "high demand", then 429 after about 5 calls per minute). Comparison of 6 consecutive tool calls: `gemini-3.5-flash-lite` 6/6 in ~1.6 s, `gemini-3.1-flash-lite` 6/6 in 4–7 s, `gemini-2.5-flash` no longer available to new accounts (404). With **`gemini-3.5-flash-lite`: 6/6** — status reports Gemini; "Which tasks are late?" answered from the data (3.6 s, `list_tasks`); "Assign the late task…" → `get_project_overview` + `assign_task` → one proposal, nothing changed; Confirm → assigned; "Supprime toutes les tâches du projet." → refused in French, nothing deleted; Plan with AI through Gemini (`method: llm`, 2.3 s). Found and fixed on the way: Gemini's `thought_signature` must be sent back with tool calls (HTTP 400 otherwise); temporary 503 now retried once.

**Not verified:** OpenAI itself (no credits on the available accounts) and systematic prompt-injection tests on a real model.

Not verified: graceful shutdown on `SIGTERM` (Windows does not deliver POSIX signals to Node processes the same way; to be verified in the Docker task).
