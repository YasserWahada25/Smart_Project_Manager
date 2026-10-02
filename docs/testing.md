# Testing

> Current state: **backend tests implemented** (Jest + Supertest + in-memory MongoDB). Frontend and AI service tests: not yet (services not created).
> Results are recorded here only after tests have actually been executed.

## 1. Strategy

| Service | Test types | Tooling | Status |
|---------|-----------|---------|--------|
| Backend (Express.js) | Unit tests (config, middleware, model), API tests (Supertest), authentication and authorization tests | Jest 30, Supertest 7, mongodb-memory-server 11 | In place |
| Frontend (Angular) | Component, service, interceptor and routing tests (form-validation tests with the forms) | Vitest 4 + jsdom through the Angular CLI unit-test builder, `HttpTestingController`, `RouterTestingHarness` | In place |
| AI service (FastAPI) | Endpoint tests, prediction validation, malformed input, model loading, malformed LLM response | pytest + FastAPI `TestClient` | Planned |

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
npm run build            # production build (type checking + budgets)
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

`tests/user.model.test.js` also covers (TASK 05): duplicate skill names and unknown levels rejected by the schema, > 50 skills rejected, `passwordChangedAt` set on change but not at creation, `isTokenIssuedBeforePasswordChange` boundaries.
| `tests/user.model.test.js` | Unit (in-memory MongoDB) | Defaults (DEVELOPER, active, timestamps); password hashed on save and checked by `comparePassword`; no re-hash when another field changes; password not selected by default; JSON without `password`/`_id`/`__v`; unknown role rejected; unique email index (case-insensitive through lowercase) |

## 3b. Frontend test inventory

| File | What is verified |
|------|------------------|
| `core/http/api-error.interceptor.spec.ts` | Successful responses untouched; backend error body → `ApiError` (status, code, message, field details) without toast for 4xx; network error → status 0 `NETWORK_ERROR` + toast; 502 without body → fallback message + toast; 500 → backend message in toast; `SKIP_ERROR_TOAST` disables the toast |
| `core/services/health.service.spec.ts` | `GET /api/v1/health` → backend & database up; 503 → backend up / database down (no toast); 502 → `ApiError` emitted, no global toast |
| `core/services/toast.service.spec.ts` | success / info / error open a snack bar with the right style and duration |
| `shared/components/error-state/error-state.spec.ts` | Message rendered as an alert; "Try again" emits `retry`; button hidden when not retryable |
| `features/home/home.spec.ts` | Loading state; three services operational; database outage highlighted; backend unreachable → error state, retry calls the service again and shows the status |
| `layouts/main-layout/main-layout.spec.ts` | Application name and navigation links; menu button only on handsets |
| `app.spec.ts` | Routing with a fake session: signed-in user → home in the layout with tab title (regression test for the redirect loop), unknown URL → not-found page, `/login` → sent home; visitor → `/login?returnUrl=…` with title "Sign in", `/register` without side navigation |
| `core/auth/jwt.spec.ts` | Payload decoding, unreadable tokens → null, expiry date, expired / not expired / no `exp` |
| `core/auth/token-storage.spec.ts` | Save/load, partial or corrupted storage → null, clear |
| `core/auth/auth.service.spec.ts` | Login (POST body, no Authorization header, session persisted), register, restore valid session, discard expired session, refresh user with Bearer header, 401 → session ended + toast + redirect to login, automatic logout at token expiry (fake timers), logout |
| `core/auth/auth.interceptor.spec.ts` | Bearer header on API requests only (never another origin), no header without session, 401 on authenticated request → `expireSession`, 401 without session and 403 → session kept |
| `core/auth/auth.guards.spec.ts` | `authGuard` (allow / redirect with returnUrl), `guestGuard`, `roleGuard` (allow / refuse with message), `safeReturnUrl` (8 cases incl. `//host`, backslash, `https://`, `javascript:`) |
| `shared/forms/forms.spec.ts` | Password policy validator (same cases as the backend incl. multi-byte), confirmation validator, first error message, backend messages applied to controls and cleared on edit |
| `features/auth/login/login.spec.ts` | Validation messages without API call, login + navigation to returnUrl, external returnUrl ignored, explicit messages for 401 and 403, password visibility toggle |
| `features/auth/register/register.spec.ts` | Password policy and confirmation messages, confirmation re-checked when the password changes, developer by default + success toast + navigation, project manager choice, 409 → "already registered" on the email field, backend 400 details on fields, other errors above the form |

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

Not verified: graceful shutdown on `SIGTERM` (Windows does not deliver POSIX signals to Node processes the same way; to be verified in the Docker task).
