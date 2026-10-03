# REST API Documentation

> Current state: **health, authentication, user administration, own profile, projects & team, developer directory, sprints, tasks & Kanban board, comments, activity history, notifications, dashboards, global search, AI status and AI-01 planning (§ 1.17).** The FastAPI AI service is documented in § 2.
> Endpoints are added to this document only once they exist in the code.

## 1. Express.js backend (main API)

### 1.1 Conventions

- Base URL (local): `http://localhost:3000`
- Base path: `/api/v1` — implemented
- Format: JSON request and response bodies — implemented (max body size 1 MB)
- Authentication: `Authorization: Bearer <JWT>` on protected endpoints — implemented (see [1.5](#15-authentication))
- Role-based authorization: `authorize(...roles)` middleware — implemented, applied to business endpoints as they are added
- Resource-oriented REST URLs (e.g. `/api/v1/users/:id`) — implemented
- Paginated lists — implemented: query `?page=1&limit=20` (limit max 100), response `{ "data": [...], "pagination": { "page", "limit", "total", "totalPages" } }`
- Single resource responses are wrapped in a named key, e.g. `{ "user": { ... } }`

### 1.2 HTTP status codes

| Code | Usage |
|------|-------|
| 200 OK | Successful read/update |
| 201 Created | Resource created |
| 400 Bad Request | Validation error |
| 401 Unauthorized | Missing, invalid or expired token; wrong credentials |
| 403 Forbidden | Authenticated but not allowed (role/ownership); deactivated account at login |
| 404 Not Found | Resource does not exist |
| 409 Conflict | Duplicate resource (e.g. email already used) |
| 413 Payload Too Large | JSON body larger than 1 MB |
| 500 Internal Server Error | Unexpected server error |
| 503 Service Unavailable | Health check: database not connected |

### 1.3 Error response format

Every error (from any endpoint, including unknown routes) uses the same JSON structure, produced by the centralized error handler (`backend/src/middleware/errorHandler.js`):

```json
{
  "error": {
    "status": 404,
    "code": "NOT_FOUND",
    "message": "Route not found: GET /api/v1/unknown",
    "details": [ { "field": "email", "message": "Already exists" } ]
  }
}
```

`details` is present only when useful (validation errors, duplicates).

| Source error | Status | `code` |
|--------------|--------|--------|
| `ApiError` thrown by application code | its own | its own |
| Request validation (express-validator) | 400 | `BAD_REQUEST` (+ `details`: first error per field) |
| Missing / invalid / expired JWT | 401 | `UNAUTHORIZED` |
| Role not allowed | 403 | `FORBIDDEN` |
| Malformed JSON body | 400 | `BAD_REQUEST` |
| JSON body over 1 MB | 413 | `PAYLOAD_TOO_LARGE` |
| Mongoose `ValidationError` | 400 | `BAD_REQUEST` (+ `details` per field) |
| Mongoose `CastError` (e.g. invalid ObjectId) | 400 | `BAD_REQUEST` |
| MongoDB duplicate key (`E11000`) | 409 | `CONFLICT` (+ `details` per field) |
| Unknown route | 404 | `NOT_FOUND` |
| Any other error | 500 | `INTERNAL_SERVER_ERROR` (generic message; details only in server logs) |

### 1.4 Endpoints

#### `GET /api/v1/health`

Health check of the backend and its MongoDB connection. Public (no authentication).

**Response 200** — backend running, MongoDB connected:

```json
{
  "status": "ok",
  "service": "smart-project-manager-backend",
  "uptime": 42,
  "timestamp": "2026-10-02T10:00:00.000Z",
  "database": { "status": "connected" }
}
```

**Response 503** — backend running, MongoDB not connected (`database.status` is `disconnected`, `connecting` or `disconnecting`):

```json
{
  "status": "degraded",
  "service": "smart-project-manager-backend",
  "uptime": 42,
  "timestamp": "2026-10-02T10:00:00.000Z",
  "database": { "status": "disconnected" }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"ok"` \| `"degraded"` | Overall status |
| `service` | string | Service identifier |
| `uptime` | integer | Process uptime in seconds |
| `timestamp` | ISO 8601 string | Server time of the check |
| `database.status` | string | Mongoose connection state |

### 1.5 Authentication

JWT-based, stateless. The client stores the token and sends it as `Authorization: Bearer <token>`. There is no logout endpoint: logging out means discarding the token on the client (it stays valid until it expires — see `JWT_EXPIRES_IN`).

**Token** — HS256, signed with `JWT_SECRET`, lifetime `JWT_EXPIRES_IN` (default `1d`).

| Claim | Content |
|-------|---------|
| `sub` | User id |
| `role` | User role at login time — informational for the frontend only |
| `iat`, `exp` | Issued-at / expiry |

On every protected request the backend reloads the user from MongoDB, so role changes and deactivation apply immediately and a tampered `role` claim has no effect.

**User object** (returned by all auth endpoints; the password hash is never returned):

```json
{
  "id": "6abf8ecb83debc1a3789a483",
  "firstName": "Sara",
  "lastName": "Manager",
  "email": "sara@example.com",
  "role": "PROJECT_MANAGER",
  "isActive": true,
  "jobTitle": "",
  "bio": "",
  "skills": [],
  "createdAt": "2026-10-02T11:00:27.266Z",
  "updatedAt": "2026-10-02T11:00:27.266Z"
}
```

#### `POST /api/v1/auth/register`

Public. Creates an account and logs it in.

| Field | Type | Rules |
|-------|------|-------|
| `firstName` | string | required, trimmed, max 50 |
| `lastName` | string | required, trimmed, max 50 |
| `email` | string | required, valid email, max 254, trimmed and lower-cased, unique |
| `password` | string | 8 chars min, 72 bytes max (bcrypt limit), at least one letter and one digit |
| `role` | string | optional: `DEVELOPER` (default) or `PROJECT_MANAGER`. `ADMIN` is refused. |

Any other field (e.g. `isActive`, `_id`) is ignored.

```json
{ "firstName": "Sara", "lastName": "Manager", "email": "sara@example.com", "password": "Secret123", "role": "PROJECT_MANAGER" }
```

**201 Created**

```json
{ "token": "<jwt>", "tokenType": "Bearer", "expiresIn": "1d", "user": { "...": "user object" } }
```

| Error | Status | Example message |
|-------|--------|-----------------|
| Invalid field(s) | 400 | `Validation failed` + `details: [{ "field": "password", "message": "Password must contain at least one digit" }]` |
| Email already registered | 409 | `Email is already registered` |

#### `POST /api/v1/auth/login`

Public.

```json
{ "email": "sara@example.com", "password": "Secret123" }
```

**200 OK** — same body as register.

| Error | Status | Message |
|-------|--------|---------|
| Missing/invalid fields | 400 | `Validation failed` |
| Unknown email **or** wrong password | 401 | `Invalid email or password` (identical, to prevent account enumeration) |
| Account deactivated (correct password) | 403 | `Account is deactivated` |

#### `GET /api/v1/auth/me`

Protected. Returns the authenticated user.

**200 OK**

```json
{ "user": { "...": "user object" } }
```

| Error | Status | Message |
|-------|--------|---------|
| No `Authorization: Bearer` header | 401 | `Authentication required` |
| Bad signature, malformed token, `alg: none` | 401 | `Invalid token` |
| Expired token | 401 | `Token has expired` |
| User deleted | 401 | `Invalid token` |
| User deactivated | 401 | `Account is deactivated` |
| Token issued before the user's last password change | 401 | `Password has been changed, please log in again` |

These 401 errors apply to **every** protected endpoint.

### 1.6 User administration (`ADMIN` only)

All endpoints require a valid token **and** the `ADMIN` role: 401 without/with an invalid token, 403 for `PROJECT_MANAGER` and `DEVELOPER`.

Users are never deleted through the API: deactivation keeps their history (projects, tasks, comments) consistent while blocking access.

#### `GET /api/v1/users`

Paginated list, newest first.

| Query parameter | Type | Rules |
|-----------------|------|-------|
| `page` | integer | ≥ 1, default 1 |
| `limit` | integer | 1–100, default 20 |
| `role` | string | `ADMIN`, `PROJECT_MANAGER` or `DEVELOPER` |
| `isActive` | string | `true` or `false` |
| `search` | string | max 100 chars; case-insensitive match on first name, last name or email (treated as plain text, not as a regex) |

Example: `GET /api/v1/users?role=DEVELOPER&isActive=true&search=youssef&page=1&limit=20`

**200 OK**

```json
{
  "data": [ { "...": "user object" } ],
  "pagination": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
}
```

Errors: 400 for an invalid query parameter (e.g. `limit=101`, `role=SUPERUSER`, `isActive=yes`).

#### `GET /api/v1/users/:id`

**200 OK** → `{ "user": { ... } }` · 400 invalid id (`Invalid user id`) · 404 `User not found`.

#### `PATCH /api/v1/users/:id/status`

Activates or deactivates an account.

```json
{ "isActive": false }
```

**200 OK** → `{ "user": { ... } }`

Effect of deactivation: the user can no longer log in (403) and their current token is refused immediately (401 `Account is deactivated`).

| Error | Status | Message |
|-------|--------|---------|
| `isActive` missing or not a JSON boolean (`"false"`, `0` are refused) | 400 | `isActive must be a boolean (true or false)` |
| Target is the requesting admin | 403 | `Administrators cannot change the status of their own account` |
| Unknown user | 404 | `User not found` |

#### `PATCH /api/v1/users/:id/role`

```json
{ "role": "PROJECT_MANAGER" }
```

**200 OK** → `{ "user": { ... } }`. Any role can be assigned, including `ADMIN`. The new role applies immediately, even to tokens issued before the change.

| Error | Status | Message |
|-------|--------|---------|
| Invalid role | 400 | `Role must be one of: ADMIN, PROJECT_MANAGER, DEVELOPER` |
| Target is the requesting admin | 403 | `Administrators cannot change the role of their own account` |
| Unknown user | 404 | `User not found` |

Only `role` (resp. `isActive`) is read from the body; any other field is ignored.

**Why an admin cannot modify their own account:** the admin performing a change always stays an active `ADMIN`, so the platform can never lose its last administrator.

### 1.7 Own profile and skills (any authenticated user)

Self-service endpoints: a user can only read and modify **their own** profile (identified by the token). Email, role and account status cannot be changed here.

#### `GET /api/v1/profile`

**200 OK** → `{ "user": { ... } }` (same user object as above, including `jobTitle`, `bio`, `skills`).

#### `PATCH /api/v1/profile`

Partial update; at least one field required. Any other field (`email`, `role`, `isActive`, `password`…) is ignored.

| Field | Type | Rules |
|-------|------|-------|
| `firstName` | string | optional; if present: non-empty, trimmed, max 50 |
| `lastName` | string | optional; same rules |
| `jobTitle` | string | optional; trimmed, max 100; `""` clears it |
| `bio` | string | optional; trimmed, max 500; `""` clears it |

```json
{ "jobTitle": "Full-stack developer", "bio": "Angular + Node.js" }
```

**200 OK** → `{ "user": { ... } }` · 400 `Validation failed` (per-field details) · 400 `Provide at least one field to update: firstName, lastName, jobTitle, bio`.

#### `PATCH /api/v1/profile/password`

```json
{ "currentPassword": "Secret123", "newPassword": "NewSecret456" }
```

**200 OK** — returns a **new token** (same body as login): every token issued before the change, on any device, is now rejected with 401 `Password has been changed, please log in again`. The client must replace its stored token with the returned one.

| Error | Status | Details |
|-------|--------|---------|
| Missing `currentPassword` | 400 | `Current password is required` |
| `newPassword` breaks the password policy | 400 | e.g. `New password must contain at least one digit` |
| `newPassword` equal to `currentPassword` | 400 | `New password must be different from the current password` |
| Wrong `currentPassword` | 400 | `currentPassword`: `Current password is incorrect` — **400, not 401**, so the client does not treat it as an expired session |

Precision note: the comparison uses the JWT `iat` (seconds), so a token issued within the same second as the change remains valid.

#### `PUT /api/v1/profile/skills`

Replaces the **whole** skill list (send `[]` to remove all skills). Available to every role; used by the developer recommendation (AI-02).

```json
{
  "skills": [
    { "name": "Node.js", "level": "ADVANCED", "yearsOfExperience": 3 },
    { "name": "Angular", "level": "INTERMEDIATE" }
  ]
}
```

| Field | Rules |
|-------|-------|
| `skills` | required array, max 50 items, names unique (case-insensitive, after trimming) |
| `skills[i].name` | required string, trimmed, 1–50 characters |
| `skills[i].level` | `BEGINNER`, `INTERMEDIATE`, `ADVANCED` or `EXPERT` |
| `skills[i].yearsOfExperience` | optional integer 0–50 |

Unknown fields inside a skill are dropped.

**200 OK** → `{ "user": { ... } }` with the new `skills`.

Errors (400) list **every** invalid item, e.g.:

```json
{
  "error": {
    "status": 400, "code": "BAD_REQUEST", "message": "Validation failed",
    "details": [
      { "field": "skills[0].name", "message": "Skill name is required (at most 50 characters)" },
      { "field": "skills[1].level", "message": "Skill level must be one of: BEGINNER, INTERMEDIATE, ADVANCED, EXPERT" }
    ]
  }
}
```

Duplicate names → `{ "field": "skills", "message": "Duplicate skill: react" }`.

### 1.8 Projects and team

#### Access rules (all project-related endpoints, including sprints and tasks)

| Actor | View | Modify (fields, status, members, delete) |
|-------|------|------------------------------------------|
| Project manager (`project.manager`, the PM who created it) | ✔ | ✔ |
| Member (`project.members`, developers) | ✔ | ✘ 403 |
| `ADMIN` | ✔ (all projects) | ✘ 403 |
| Anyone else | ✘ **404** `Project not found` (existence not revealed) | ✘ 404 |

An **archived** project is read-only: every modification returns 409 `The project is archived: change its status before modifying it`, except a status change (to un-archive it).

**Project object**

```json
{
  "id": "6abf...",
  "name": "E-commerce platform",
  "description": "Online shop with Stripe payment",
  "startDate": "2026-10-01T00:00:00.000Z",
  "deadline": "2027-01-31T00:00:00.000Z",
  "status": "PLANNING",
  "technologies": ["Angular", "Node.js", "MongoDB"],
  "manager": { "id": "...", "firstName": "Sara", "lastName": "PM", "email": "...", "jobTitle": "" },
  "members": [
    { "id": "...", "firstName": "Youssef", "lastName": "Alami", "email": "...", "jobTitle": "", "isActive": true,
      "skills": [ { "name": "Node.js", "level": "ADVANCED" } ] }
  ],
  "createdAt": "...", "updatedAt": "..."
}
```

`deadline` is absent when not set.

**Fields** (create / update)

| Field | Rules |
|-------|-------|
| `name` | required on create; string 1–100, trimmed |
| `description` | optional string ≤ 2000 (`""` clears it) |
| `startDate` | required on create; ISO date `YYYY-MM-DD` |
| `deadline` | optional ISO date, must be ≥ `startDate` (checked against stored values on update); `null` removes it |
| `status` | `PLANNING` (default), `ACTIVE`, `PAUSED`, `COMPLETED`, `ARCHIVED` (not allowed on create) |
| `technologies` | optional array ≤ 30 strings (1–50 chars, trimmed, unique case-insensitive) |

`manager` and `members` in the body are ignored (the manager is the creator; members have their own endpoints).

#### `POST /api/v1/projects` — `PROJECT_MANAGER` only

**201 Created** → `{ "project": { ... } }` · 400 validation · 403 for `ADMIN` / `DEVELOPER`.

#### `GET /api/v1/projects`

Projects visible to the caller (see access rules), newest first. Query: `page`, `limit`, `status`, `search` (name contains, case-insensitive). **200** → `{ "data": [project], "pagination": { ... } }`.

#### `GET /api/v1/projects/:id`

**200** → `{ "project": { ... } }` · 400 `Invalid project id` · 404.

#### `PATCH /api/v1/projects/:id` — project manager

Partial update (at least one field). **200** → `{ "project": { ... } }` · 400 · 403 · 404 · 409 (archived).

#### `DELETE /api/v1/projects/:id` — project manager

**204 No Content** — the activity history and the notifications of the project are deleted with it · 403 · 404 · 409 when it still has sprints or tasks.

#### `POST /api/v1/projects/:id/members` — project manager

```json
{ "userId": "6abf..." }
```

**201** → `{ "project": { ... } }` with the new member.

| Error | Status | Message |
|-------|--------|---------|
| Invalid id | 400 | `Invalid user id` |
| Not a `DEVELOPER` | 400 | `Only DEVELOPER accounts can be added as project members` |
| Deactivated account | 400 | `This user account is deactivated` |
| Unknown user | 404 | `User not found` |
| Already a member | 409 | `This user is already a member of the project` |
| 50 members reached | 409 | `A project can have at most 50 members` |

#### `DELETE /api/v1/projects/:id/members/:userId` — project manager

**200** → `{ "project": { ... } }` · 404 `This user is not a member of the project`. The removed developer immediately loses access to the project.

### 1.9 Developer directory

#### `GET /api/v1/developers` — `PROJECT_MANAGER` and `ADMIN`

Active `DEVELOPER` accounts, sorted by last name, to build project teams. Public fields only: `id`, `firstName`, `lastName`, `email`, `jobTitle`, `skills`.

| Query | Rules |
|-------|-------|
| `search` | contains, case-insensitive, on first name, last name, email |
| `skill` | exact skill name, case-insensitive (`node.js` matches `Node.js`, `node` does not) |
| `page`, `limit` | pagination |

**200** → `{ "data": [...], "pagination": { ... } }` · 403 for `DEVELOPER`.

### 1.10 Sprints

Same access rules as projects: viewers of the project can read its sprints; only the project manager can create/modify them (403 for members and admins, 404 for outsiders, 409 if the project is archived).

**Sprint object**

```json
{
  "id": "...", "name": "Sprint 1", "objective": "Authentication and catalog",
  "project": "<project id>",
  "startDate": "2026-10-05T00:00:00.000Z", "endDate": "2026-10-18T00:00:00.000Z",
  "status": "ACTIVE",
  "completedAt": "...",
  "createdAt": "...", "updatedAt": "..."
}
```

`completedAt` only exists once the sprint is `COMPLETED`.

**Lifecycle** (`PATCH /sprints/:id/status`)

```
PLANNED ──► ACTIVE ──► COMPLETED
   │          │
   └──────────┴──► CANCELLED          (COMPLETED and CANCELLED are final)
```

At most **one `ACTIVE` sprint per project** (also guaranteed by a unique partial index in MongoDB).

| Endpoint | Who | Body / query | Success | Specific errors |
|----------|-----|--------------|---------|-----------------|
| `POST /api/v1/projects/:id/sprints` | manager | `name` (1–100), `objective` (≤ 1000, optional), `startDate`, `endDate` (≥ start) | 201 `{ sprint }` (status always `PLANNED`) | 400 validation |
| `GET /api/v1/projects/:id/sprints` | viewers | `status`, `page`, `limit` | 200 `{ data, pagination }`, chronological order | 404 project |
| `GET /api/v1/sprints/:id` | viewers | — | 200 `{ sprint }` | 404 `Sprint not found` |
| `PATCH /api/v1/sprints/:id` | manager | any of `name`, `objective`, `startDate`, `endDate` | 200 `{ sprint }` | 409 `The sprint is completed and can no longer be modified` |
| `PATCH /api/v1/sprints/:id/status` | manager | `{ "status": "ACTIVE" }` | 200 `{ sprint }` | 409 `Invalid status transition: PLANNED → COMPLETED`; 409 `The project already has an active sprint: <name>` |
| `DELETE /api/v1/sprints/:id` | manager | — | 204 | 409 `Only PLANNED sprints can be deleted; cancel this sprint instead` |

Deleting a project that still has sprints or tasks → 409 `The project still has sprints or tasks: archive it instead of deleting it`.

Deleting a (PLANNED) sprint moves its tasks back to the backlog.

**Sprint statistics** — `GET /sprints/:id` and `GET /projects/:id/sprints` add a `stats` object to each sprint (computed from its tasks; complexity = story points):

```json
"stats": {
  "totalTasks": 3, "completedTasks": 1, "blockedTasks": 1,
  "totalPoints": 10, "completedPoints": 5, "progress": 50,
  "tasksByStatus": { "TODO": 1, "IN_PROGRESS": 0, "CODE_REVIEW": 0, "TESTING": 0, "DONE": 1, "BLOCKED": 1 }
}
```

`progress` = completed points / total points (%, rounded), 0 for an empty sprint.

### 1.11 Tasks

**Permissions**

| Action | Project manager | Assignee (developer) | Other member / admin | Outsider |
|--------|-----------------|----------------------|----------------------|----------|
| View, list, board | ✔ | ✔ | ✔ | 404 |
| Create, edit fields, assign, delete | ✔ | 403 | 403 | 404 |
| Change status | ✔ | ✔ (own tasks) | 403 | 404 |

All modifications return 409 on an archived project.

**Task object**

```json
{
  "id": "...", "title": "Implement login page", "description": "...",
  "type": "FEATURE", "priority": "HIGH", "complexity": 5, "status": "IN_PROGRESS",
  "deadline": "2026-11-15T00:00:00.000Z", "isOverdue": false,
  "requiredSkills": ["Angular", "TypeScript"],
  "project": "<project id>", "sprint": "<sprint id or null>",
  "assignee": { "id": "...", "firstName": "Youssef", "lastName": "Alami", "email": "..." },
  "createdBy": { "id": "...", "firstName": "Sara", "lastName": "PM", "email": "..." },
  "blockedReason": "only when BLOCKED", "completedAt": "only when DONE",
  "createdAt": "...", "updatedAt": "..."
}
```

`sprint: null` = backlog; `assignee: null` = unassigned; `isOverdue` = deadline passed and status ≠ `DONE`.

**Fields**

| Field | Rules |
|-------|-------|
| `title` | required on create, 1–200 |
| `description` | optional ≤ 5000 |
| `type` | `FEATURE` (default), `BUG`, `IMPROVEMENT`, `TESTING`, `DOCUMENTATION`, `DEVOPS`, `SECURITY` |
| `priority` | `LOW`, `MEDIUM` (default), `HIGH`, `CRITICAL` |
| `complexity` | story points, JSON number in `1, 2, 3, 5, 8, 13` (default 3; ≥ 8 = high complexity) |
| `deadline` | ISO date, `null` removes it |
| `requiredSkills` | array ≤ 20 strings (1–50 chars, unique case-insensitive) |
| `sprint` | id of an **open** sprint (`PLANNED`/`ACTIVE`) of the same project, or `null` (backlog) |
| `assignee` | creation only: id of an active project member, or `null` (afterwards use `PATCH /tasks/:id/assignee`) |

**Workflow** (`PATCH /tasks/:id/status`)

```
TODO ⇄ IN_PROGRESS ⇄ CODE_REVIEW ⇄ TESTING ──► DONE
                     (TESTING → IN_PROGRESS also allowed)      DONE → IN_PROGRESS (reopen)
any of TODO / IN_PROGRESS / CODE_REVIEW / TESTING ──► BLOCKED ──► back to any of them
```

| From | Allowed targets |
|------|-----------------|
| `TODO` | `IN_PROGRESS`, `BLOCKED` |
| `IN_PROGRESS` | `TODO`, `CODE_REVIEW`, `BLOCKED` |
| `CODE_REVIEW` | `IN_PROGRESS`, `TESTING`, `BLOCKED` |
| `TESTING` | `IN_PROGRESS`, `CODE_REVIEW`, `DONE`, `BLOCKED` |
| `DONE` | `IN_PROGRESS` |
| `BLOCKED` | `TODO`, `IN_PROGRESS`, `CODE_REVIEW`, `TESTING` |

Rules: a task must have an assignee to be in `IN_PROGRESS`, `CODE_REVIEW`, `TESTING` or `DONE`; `blockedReason` (optional, ≤ 500) is kept only while `BLOCKED`; `completedAt` is set on `DONE` and removed on reopen.

| Endpoint | Who | Success | Specific errors |
|----------|-----|---------|-----------------|
| `POST /api/v1/projects/:id/tasks` | manager | 201 `{ task }` (status `TODO`) | 400 `sprint`: `Sprint not found in this project`; 409 `Tasks cannot be added to a completed sprint`; 400 `assignee`: `The assignee must be a member of the project` / `The assignee account is deactivated` |
| `GET /api/v1/projects/:id/tasks` | viewers | 200 `{ data, pagination }`, newest first | 400 invalid filter |
| `GET /api/v1/tasks/:id` | viewers | 200 `{ task }` | 404 `Task not found` |
| `PATCH /api/v1/tasks/:id` | manager | 200 `{ task }` | 400 no field / invalid; same sprint errors as create |
| `PATCH /api/v1/tasks/:id/status` | manager, assignee | 200 `{ task }` — body `{ "status": "BLOCKED", "blockedReason": "..." }` | 409 `Invalid status transition: TODO → DONE`; 409 `Assign the task to a developer before moving it to IN_PROGRESS`; 403 |
| `PATCH /api/v1/tasks/:id/assignee` | manager | 200 `{ task }` — body `{ "assigneeId": "<id>" }` or `{ "assigneeId": null }` | 400 non-member / deactivated; 409 `A task in IN_PROGRESS must keep an assignee: move it back to TODO first` |
| `DELETE /api/v1/tasks/:id` | manager | 204 | |

**List filters** (`GET /projects/:id/tasks`): `status`, `priority`, `type`, `assignee` (user id or `unassigned`), `sprint` (sprint id or `backlog`), `search` (title contains), `overdue=true`, `page`, `limit`.

#### `GET /api/v1/projects/:id/board` — Kanban board (viewers)

Query `sprint`: a sprint id (`scope: "SPRINT"`), `backlog` (tasks without sprint, `scope: "BACKLOG"`) or omitted (all tasks, `scope: "ALL"`). Tasks are ordered by priority (CRITICAL first) then creation date.

```json
{
  "project": { "id": "...", "name": "E-commerce platform", "status": "ACTIVE" },
  "sprint": { "id": "...", "name": "Sprint A", "status": "ACTIVE" },
  "scope": "SPRINT",
  "totalTasks": 4,
  "columns": [
    { "status": "TODO", "count": 2, "tasks": [ { "...": "task" } ] },
    { "status": "IN_PROGRESS", "count": 0, "tasks": [] },
    { "status": "CODE_REVIEW", "count": 1, "tasks": [] },
    { "status": "TESTING", "count": 0, "tasks": [] },
    { "status": "DONE", "count": 0, "tasks": [] },
    { "status": "BLOCKED", "count": 1, "tasks": [] }
  ]
}
```

404 `Sprint not found` if the sprint does not belong to the project.

#### `GET /api/v1/tasks/assigned` — my tasks (any authenticated user)

Tasks assigned to the caller in the projects they can still access, ordered by deadline (tasks without deadline last). Query: `status`, `page`, `limit`. Each task's `project` and `sprint` are populated with `name` and `status`.

**Guards on other resources**

| Action | Result |
|--------|--------|
| Remove a member who has unfinished (not `DONE`) tasks in the project | 409 `This member still has 1 unfinished task(s) assigned: reassign them first` |
| Delete a project that has tasks | 409 |

### 1.12 Comments

| Endpoint | Who | Success | Errors |
|----------|-----|---------|--------|
| `GET /api/v1/tasks/:id/comments` | project viewers (incl. admin) | 200 `{ data, pagination }`, **oldest first** | 404 |
| `POST /api/v1/tasks/:id/comments` | project manager and members | 201 `{ comment }` | 400 `content`: `Content is required` / `Content must be at most 2000 characters`; 403 admin; 404 outsider; 409 archived |
| `PATCH /api/v1/comments/:id` | the author only | 200 `{ comment }` (sets `editedAt`) | 403 `Only the author can edit this comment`; 404 |
| `DELETE /api/v1/comments/:id` | the author or the project manager (moderation) | 204 | 403 `Only the author or the project manager can delete this comment`; 404 |

Body: `{ "content": "..." }` (trimmed, 1–2000 characters).

```json
{
  "id": "...", "task": "<task id>", "project": "<project id>",
  "author": { "id": "...", "firstName": "Youssef", "lastName": "Alami", "email": "..." },
  "content": "Login form done, waiting for review",
  "editedAt": "only if edited", "createdAt": "...", "updatedAt": "..."
}
```

Deleting a task deletes its comments.

### 1.13 Activity history

Read-only, append-only log of what happened in a project, recorded automatically by the backend.

| Endpoint | Who | Query |
|----------|-----|-------|
| `GET /api/v1/projects/:id/activities` | project viewers | `type`, `page`, `limit` — newest first |
| `GET /api/v1/tasks/:id/activities` | project viewers | `page`, `limit` — history of one task |

```json
{
  "id": "...", "type": "TASK_STATUS_CHANGED",
  "project": "<project id>", "task": "<task id>",
  "actor": { "id": "...", "firstName": "Youssef", "lastName": "Alami" },
  "details": { "title": "Login page", "from": "TODO", "to": "IN_PROGRESS" },
  "createdAt": "..."
}
```

| Type | Recorded when | `details` | Other refs |
|------|---------------|-----------|------------|
| `PROJECT_CREATED` | project created | `name` | |
| `PROJECT_UPDATED` | project fields actually changed | `fields` (names) | |
| `PROJECT_STATUS_CHANGED` | project status changed | `from`, `to` | |
| `MEMBER_ADDED` / `MEMBER_REMOVED` | team change | `name` (added) | `targetUser` |
| `SPRINT_CREATED` / `SPRINT_DELETED` | sprint created / deleted | `name` | `sprint` |
| `SPRINT_UPDATED` | sprint fields actually changed | `name`, `fields` | `sprint` |
| `SPRINT_STATUS_CHANGED` | sprint lifecycle | `name`, `from`, `to` | `sprint` |
| `TASK_CREATED` / `TASK_DELETED` | task created / deleted | `title` | `task` |
| `TASK_UPDATED` | task fields actually changed | `title`, `fields` | `task` |
| `TASK_ASSIGNED` / `TASK_UNASSIGNED` | (re)assignment / unassignment | `title` | `task`, `targetUser` |
| `TASK_STATUS_CHANGED` | workflow transition | `title`, `from`, `to` | `task` |
| `COMMENT_ADDED` | comment posted | `title`, `commentId` | `task` |
| `AI_PLAN_APPLIED` | AI-01 plan applied (§ 1.17) | `sprints`, `tasks` (counts created), `method` (`llm` / `local` / `null`) | |

`details` keeps a snapshot (title, name) so entries stay readable after the task or sprint is deleted. Writing the history never makes the main operation fail (errors are logged).

### 1.14 Notifications

Generated automatically from the activity history; a user only sees **their own** notifications and is never notified of their own actions.

| Activity | Notification type | Recipients | Example message |
|----------|-------------------|------------|-----------------|
| `MEMBER_ADDED` | `ADDED_TO_PROJECT` | the added developer | `Sara Manager added you to the project «Shop»` |
| `MEMBER_REMOVED` | `REMOVED_FROM_PROJECT` | the removed developer | `Sara Manager removed you from the project «Shop»` |
| `TASK_ASSIGNED` | `TASK_ASSIGNED` | the new assignee | `Sara Manager assigned you the task «Login»` |
| `TASK_UNASSIGNED` | `TASK_UNASSIGNED` | the previous assignee | `Sara Manager unassigned you from the task «Cart»` |
| `TASK_STATUS_CHANGED` | `TASK_STATUS_CHANGED` | project manager + assignee | `Youssef Alami moved «Login» from TODO to IN_PROGRESS` |
| `COMMENT_ADDED` | `COMMENT_ADDED` | project manager + assignee | `Sara Manager commented on «Login»` |
| `SPRINT_STATUS_CHANGED` → `ACTIVE` | `SPRINT_STARTED` | project members | `The sprint «S1» has started in «Shop»` |

```json
{
  "id": "...", "type": "TASK_ASSIGNED", "message": "Sara Manager assigned you the task «Login»",
  "actor": { "id": "...", "firstName": "Sara", "lastName": "Manager" },
  "project": "<project id>", "task": "<task id>",
  "read": false, "readAt": "only once read", "createdAt": "..."
}
```

| Endpoint | Success | Notes |
|----------|---------|-------|
| `GET /api/v1/notifications` | 200 `{ data, pagination, unreadCount }` | Newest first. Query: `unread=true`, `page`, `limit` |
| `GET /api/v1/notifications/unread-count` | 200 `{ "unreadCount": 2 }` | For the header badge |
| `PATCH /api/v1/notifications/:id/read` | 200 `{ notification }` | Sets `read` and `readAt` |
| `PATCH /api/v1/notifications/read-all` | 200 `{ "updated": 3 }` | |
| `DELETE /api/v1/notifications/:id` | 204 | |

Another user's notification → 404 `Notification not found`. Notifications are deleted automatically after **90 days** (MongoDB TTL index), and with their project when it is deleted. A failure while storing notifications never makes the original action fail.

### 1.15 Dashboards

#### `GET /api/v1/dashboard` — any authenticated user

Indicators computed over the projects the caller can see (admin: all; manager: managed projects; developer: member projects).

```json
{
  "role": "PROJECT_MANAGER",
  "projects": { "total": 1, "active": 1, "byStatus": { "PLANNING": 0, "ACTIVE": 1, "PAUSED": 0, "COMPLETED": 0, "ARCHIVED": 0 } },
  "sprints": {
    "active": 1,
    "activeSprints": [
      { "id": "...", "name": "Sprint 1", "project": { "id": "...", "name": "Shop" }, "endDate": "...",
        "daysRemaining": 5, "stats": { "totalPoints": 16, "completedPoints": 5, "progress": 31, "...": "..." } }
    ]
  },
  "tasks": {
    "total": 4, "completed": 1, "blocked": 1, "overdue": 1,
    "byStatus": { "TODO": 1, "IN_PROGRESS": 1, "CODE_REVIEW": 0, "TESTING": 0, "DONE": 1, "BLOCKED": 1 },
    "byPriority": { "LOW": 1, "MEDIUM": 1, "HIGH": 1, "CRITICAL": 1 }
  },
  "workload": [
    { "user": { "id": "...", "firstName": "Amira", "lastName": "...", "email": "..." },
      "openTasks": 1, "openPoints": 8, "inProgressTasks": 0, "blockedTasks": 1 }
  ]
}
```

| Section | Present for | Content |
|---------|-------------|---------|
| `projects`, `sprints`, `tasks` | everyone | Counts by status, active sprints with progress and `daysRemaining` (negative = late), overdue = deadline passed and not DONE |
| `workload` | `PROJECT_MANAGER`, `ADMIN` | Open (not DONE) tasks and story points per assignee, heaviest first |
| `myTasks` | `DEVELOPER` | Same structure as `tasks`, restricted to the caller's tasks |
| `platform` | `ADMIN` | `{ "users": { "total", "active", "inactive", "byRole": { "ADMIN", "PROJECT_MANAGER", "DEVELOPER" } } }` |

#### `GET /api/v1/projects/:id/dashboard` — project viewers

```json
{
  "project": { "id": "...", "name": "Shop", "status": "ACTIVE", "startDate": "...", "deadline": "...", "daysRemaining": 30, "memberCount": 3 },
  "tasks": { "...": "same structure as above" },
  "sprints": { "total": 2, "byStatus": { "PLANNED": 0, "ACTIVE": 1, "COMPLETED": 1, "CANCELLED": 0 }, "activeSprint": { "...": "or null" } },
  "workload": [ { "user": { "...": "..." }, "openTasks": 0, "openPoints": 0, "inProgressTasks": 0, "blockedTasks": 0 } ]
}
```

The project workload lists **every member**, including members without open tasks. 404 for outsiders.

AI risk indicators will be added to the dashboards with AI-03.

### 1.16 Global search

#### `GET /api/v1/search?q=payment&limit=5` — any authenticated user

Case-insensitive "contains" search in the projects the caller can see: project **name/description** and task **title/description**. `q`: 2–100 characters (treated as plain text); `limit`: items per type, 1–20 (default 5).

```json
{
  "query": "payment",
  "projects": { "total": 1, "items": [ { "id": "...", "name": "Payment platform", "status": "PLANNING", "...": "..." } ] },
  "tasks": { "total": 2, "items": [ { "id": "...", "title": "Stripe payment integration", "status": "TODO",
             "project": { "id": "...", "name": "Payment platform" }, "assignee": { "...": "or null" } } ] }
}
```

### 1.17 AI (backend gateway to the AI service)

The backend is the only caller of the AI service (`AI_SERVICE_URL`, shared secret `AI_SERVICE_TOKEN` sent as `X-AI-Service-Token`, timeout `AI_TIMEOUT_MS`, default 90 000 ms). AI failures become backend errors:

| Status | Code | When |
|--------|------|------|
| 503 | `AI_UNAVAILABLE` | `AI_SERVICE_TOKEN` not set, or the AI service is unreachable |
| 504 | `AI_TIMEOUT` | No answer within `AI_TIMEOUT_MS` |
| 400 | `BAD_REQUEST` | The AI service refused the submitted content (unreadable file, scanned PDF, no requirement found…): its message is returned |
| 502 | `AI_ERROR` | The AI service failed or returned something that does not match the contract |

#### `GET /api/v1/ai/status` — any authenticated user

Never fails: reports whether the AI service answers and which analyzer it will use (shown on the home page and the "Plan with AI" page).

```json
{ "available": true, "llm": { "provider": "openai", "configured": false, "model": null } }
{ "available": false, "reason": "NOT_CONFIGURED", "llm": null }
```

`reason`: `NOT_CONFIGURED` (no token), `UNREACHABLE`, `TIMEOUT`. `llm.configured` is true when `OPENAI_API_KEY` is set in the AI service (the key itself is never returned).

#### `POST /api/v1/projects/:id/ai/plan` — project manager, project not archived

AI-01: proposes sprints and tasks from the specification. **Nothing is stored.** `multipart/form-data` (or JSON without file):

| Field | Rules |
|-------|-------|
| `text` | Pasted specification, ≤ 200 000 characters (optional if a file is sent) |
| `file` | One file, `.txt` `.md` `.pdf` `.docx`, ≤ 5 MB (413 / 415 otherwise); kept in memory, never written to disk |
| `startDate` | `YYYY-MM-DD`, optional — default: today, the project start date if later, or the day after the last sprint of the project |
| `sprintLengthDays` | Integer 5–30, default 14 |
| `capacityPerSprint` | Story points per sprint, integer 3–200, default 20 |

Text + file text must reach 20 characters (400 otherwise). The project is checked (403 / 404) **before** the file is read.

```json
{
  "plan": {
    "method": "local",
    "model": "local analyzer (rules + naive Bayes type classifier)",
    "warnings": ["The last sprint ends on 2027-02-14, after the project deadline (2027-01-31): …"],
    "sprints": [
      {
        "name": "Sprint 1", "objective": "Deliver: Authentication, Payment",
        "startDate": "2026-10-05", "endDate": "2026-10-18",
        "tasks": [
          { "title": "Pay by card with Stripe", "description": "Pay by card with Stripe",
            "type": "FEATURE", "priority": "HIGH", "complexity": 5,
            "requiredSkills": ["Stripe", "Node.js", "Payments"], "epic": "Payment" }
        ]
      }
    ],
    "backlog": [],
    "stats": { "taskCount": 8, "sprintCount": 3, "totalPoints": 31, "epics": ["Authentication", "Payment", "Catalog"] },
    "options": { "startDate": "2026-10-05", "sprintLengthDays": 14, "capacityPerSprint": 13 },
    "source": { "filename": "cahier-des-charges.docx", "characters": 1200 }
  }
}
```

`method`: `llm` (OpenAI) or `local` (local analyzer, also used when OpenAI fails — a warning says why). Sprint names continue the numbering of the existing sprints. The AI answer is validated strictly before being returned (otherwise 502 `AI_ERROR`).

#### `POST /api/v1/projects/:id/ai/plan/apply` — project manager, project not archived

Creates the plan reviewed (and possibly edited) by the manager: **PLANNED** sprints and **TODO**, unassigned tasks, all or nothing (if an insert fails, everything already inserted is removed). JSON body:

```json
{
  "method": "local",
  "sprints": [
    { "name": "Sprint 1", "objective": "Deliver: Authentication", "startDate": "2026-10-05", "endDate": "2026-10-18",
      "tasks": [ { "title": "Sign up with email", "description": "", "type": "FEATURE", "priority": "HIGH",
                   "complexity": 5, "requiredSkills": ["Angular"] } ] }
  ],
  "backlog": [ { "title": "Dark mode", "description": "", "type": "IMPROVEMENT", "priority": "LOW", "complexity": 2, "requiredSkills": [] } ]
}
```

Rules: ≤ 20 sprints, 1–100 tasks in total, sprint name ≤ 100 characters, objective ≤ 1 000, `endDate` ≥ `startDate`; task fields as in § 1.11 (title ≤ 200, description ≤ 5 000, enums, story points 1/2/3/5/8/13, ≤ 20 unique skills of ≤ 50 characters); `method` optional (`llm` / `local`). An `epic` field is ignored (not stored). → **201**:

```json
{ "sprints": [ { "id": "...", "name": "Sprint 1", "status": "PLANNED", "...": "..." } ], "tasksCreated": 8, "backlogTasks": 1 }
```

One `AI_PLAN_APPLIED` activity is recorded (no notification: the tasks are unassigned).

#### `GET /api/v1/tasks/:id/ai/recommendations` — project manager, project not archived

AI-02: the active members of the project ranked for the task. **Nothing is stored**; assigning stays `PATCH /api/v1/tasks/:id/assignee`.

```json
{
  "task": { "id": "...", "title": "Login page", "requiredSkills": ["Angular", "Node.js"] },
  "method": "scoring",
  "model": "transparent scoring v1 (skills 60 %, workload 25 %, experience 15 %)",
  "skillsSource": "required",
  "skills": ["Angular", "Node.js"],
  "recommendations": [
    {
      "developer": { "id": "...", "firstName": "Bob", "lastName": "Martin", "email": "bob@example.com", "jobTitle": "" },
      "score": 54,
      "matchingSkills": ["angular", "NodeJS"], "missingSkills": [],
      "openTasks": 0, "openPoints": 0, "similarCompletedTasks": 1,
      "breakdown": { "skills": 0.425, "workload": 1, "experience": 0.2 },
      "explanation": "Has 2 of 2 skills: angular (beginner), NodeJS (intermediate); 0 open points (0 tasks) for a capacity of 20; 1 completed task with these skills.",
      "isAssignee": false
    }
  ],
  "warnings": []
}
```

At most 5 developers, best first. `skillsSource`: `required` (task skills), `inferred` (team skills found in the task title / description) or `none`. A project without active developer → `recommendations: []` with a warning (the AI service is not called). Errors: 403 (member, administrator), 404 (outsider), 409 (archived project), 503 / 504 / 502 as above. Scoring: [ai.md](ai.md) § 4.2.

#### `GET /api/v1/sprints/:id/ai/risk` — project viewers

AI-03: delay risk of a **planned or active** sprint (409 for a completed or cancelled one). Recomputed at each call, never stored.

```json
{
  "sprint": { "id": "...", "name": "Sprint 2", "status": "ACTIVE", "startDate": "2026-09-26T00:00:00.000Z", "endDate": "2026-10-09T00:00:00.000Z" },
  "asOf": "2026-10-03",
  "riskLevel": "HIGH",
  "probability": 1,
  "method": "model",
  "factors": [
    { "code": "pace_ratio", "label": "Needs 3.9× the usual pace: 3.9 points/day for 7 remaining days (usual 1.0)", "impact": 6.1 },
    { "code": "progress_gap", "label": "Behind schedule: 50% of the time elapsed, 10% of the story points done", "impact": 4.2 }
  ],
  "measures": { "total": 6, "done": 1, "blocked": 2, "highComplexityOpen": 2, "unassignedOpen": 1,
                "totalPoints": 30, "donePoints": 3, "teamSize": 2, "historicalVelocity": 1 },
  "features": { "elapsed_ratio": 0.5, "progress_gap": 0.4, "pace_ratio": 3.857, "...": 0 },
  "model": { "name": "logistic regression (7 features, synthetic sprints)", "version": 1, "accuracy": 0.864, "rocAuc": 0.934, "f1": 0.861 },
  "warnings": []
}
```

`method`: `model` (logistic regression) or `rule` (no estimated task, all points done, end date passed). `historicalVelocity`: story points per day of the last 3 completed sprints of the project (`null` if none). Errors: 404 (outsider), 409 (closed sprint), 503 / 504 / 502. Model: [ai.md](ai.md) § 4.3.

#### `POST /api/v1/projects/:id/ai/assistant/chat` — project manager, project not archived

AI-04: one message of the manager → the assistant's reply. **Nothing is changed**: the changes it prepares come back as `proposals`.

```json
{ "messages": [
    { "role": "user", "content": "Which tasks are late?" },
    { "role": "assistant", "content": "1 late task: «Login page»." },
    { "role": "user", "content": "Assign it to Bob" }
] }
```

1–20 messages, `role` `user` or `assistant` (the last one `user`), `content` 1–4 000 characters. → 200:

```json
{
  "reply": "Prepared, waiting for your confirmation: Assign «Login page» to Bob Martin.",
  "proposals": [
    { "id": "8c0e…", "tool": "assign_task", "arguments": { "taskId": "...", "assigneeId": "..." },
      "summary": "Assign «Login page» to Bob Martin" }
  ],
  "toolsUsed": ["get_project_overview", "list_tasks", "assign_task"],
  "model": "gpt-4o-mini"
}
```

Errors: 503 `LLM_NOT_CONFIGURED` (no `OPENAI_API_KEY` in the AI service) or `AI_UNAVAILABLE`, 502 (OpenAI failure or invalid answer), 504, 400 (conversation), 403 / 404 / 409 (access).

#### `POST /api/v1/projects/:id/ai/assistant/actions` — project manager, project not archived

Applies a proposal the manager confirmed: `{ "tool": "create_task" | "update_task" | "assign_task" | "change_task_status" | "create_sprint", "arguments": { … } }`. The arguments are validated by the rules of the matching REST route (§ 1.10, § 1.11) and the change goes through the same service (history, notifications). → **201** `{ "tool", "message": "«Login page» assigned to Bob Martin.", "task" | "sprint" }`. 400 (unknown tool — there is no delete tool — or invalid arguments), 404 (task not in the project), 409 (transition not allowed, closed sprint…), 403 (not the manager).

## 2. FastAPI AI service (internal API)

Called only by the Express backend, never by the browser. Base URL `AI_SERVICE_URL` (default `http://localhost:8000`). Interactive documentation (Swagger UI) at `/docs` while the service runs.

- **Authentication**: every `/api/v1/ai/*` route requires the header `X-AI-Service-Token: <AI_SERVICE_TOKEN>` (same value in `backend/.env` and `ai-service/.env`, ≥ 32 characters, compared in constant time) → 401 `UNAUTHORIZED` otherwise. `/api/v1/health` is public.
- **Errors**: same format as the backend, `{"error": {"status", "code", "message", "details"}}`; request validation errors → 400 `BAD_REQUEST` with `details[{field, message}]`; unexpected errors → 500 without internal details.

### 2.1 Endpoints

| Method | Path | Feature | Status |
|--------|------|---------|--------|
| GET  | `/api/v1/health` | Health check + analyzer in use | Done (TASK 20) |
| POST | `/api/v1/ai/documents/extract` | AI-01: text of a specification file | Done (TASK 22) |
| POST | `/api/v1/ai/projects/plan` | AI-01: sprints and tasks from a specification | Done (TASK 22) |
| POST | `/api/v1/ai/developers/recommend` | AI-02 Developer recommendation | Done (TASK 23) |
| POST | `/api/v1/ai/sprints/predict-risk` | AI-03 Sprint delay risk | Done (TASK 24) |
| POST | `/api/v1/ai/assistant/chat` | AI-04 Manager assistant (one turn) | Done (TASK 25) |
| POST | `/api/v1/ai/sprints/summary` | Optional: sprint summary | Covered by AI-04 ("Summarize the sprint") |

### 2.2 Details

#### `GET /api/v1/health`

```json
{ "status": "ok", "service": "smart-project-manager-ai", "llm": { "provider": "openai", "configured": false, "model": null } }
```

`configured` / `model`: whether `OPENAI_API_KEY` is set and the model used; the key is never returned.

#### `POST /api/v1/ai/documents/extract`

`multipart/form-data`, field `file` (`.txt` `.md` `.pdf` `.docx`, ≤ `MAX_UPLOAD_BYTES`, 5 MB). Returns the plain text with its structure kept as Markdown (headings `# …`, list items `- …`, table rows `a | b`), cut at `MAX_DOCUMENT_CHARS` (100 000):

```json
{ "filename": "cahier.docx", "text": "# Authentication\n- Sign up with email\n…", "characters": 1200, "truncated": false }
```

Errors: 413 (too large), 415 (other extension), 422 (empty, corrupted, password-protected or image-only PDF), 400 (no `file` field).

#### `POST /api/v1/ai/projects/plan`

```json
{
  "text": "# Authentication\n- Sign up with email (Must)\n…",
  "project": { "name": "Shop", "description": "Online shop", "technologies": ["Angular", "Node.js"], "deadline": "2027-01-31" },
  "options": { "startDate": "2026-10-05", "sprintLengthDays": 14, "capacityPerSprint": 20 },
  "teamSkills": ["Angular", "Stripe"]
}
```

`text` 20–200 000 characters; `project.name` 1–100, `description` ≤ 2 000, ≤ 30 technologies; `deadline` optional; options as in § 1.17; ≤ 200 team skills. Response: `method`, `model`, `warnings`, `sprints` (each with `totalPoints`, named `Sprint 1…`), `backlog`, `stats` — the backend validates it, renames the sprints after the existing ones and adds `options` and `source` (§ 1.17). 422 when no requirement can be found in the text. Approach, rules and limits: [ai.md](ai.md) § 4.1; LLM prompt: [prompts.md](prompts.md) Part B.

#### `POST /api/v1/ai/developers/recommend`

```json
{
  "task": { "title": "Login page", "description": "", "type": "FEATURE", "complexity": 8, "requiredSkills": ["Angular", "Node.js"] },
  "candidates": [
    { "id": "u1", "name": "Bob Martin",
      "skills": [ { "name": "angular", "level": "BEGINNER" }, { "name": "NodeJS", "level": "INTERMEDIATE", "yearsOfExperience": 2 } ],
      "openTasks": 0, "openPoints": 0, "completedTasks": 1, "completedSkills": { "Angular": 1 } }
  ],
  "options": { "workloadCapacity": 20, "limit": 5 }
}
```

1–100 candidates (≤ 50 skills each, level `BEGINNER` / `INTERMEDIATE` / `ADVANCED` / `EXPERT`, years 0–60); `complexity` a story-point value; `workloadCapacity` 3–200 (default 20); `limit` 1–20 (default 5). Response: `method` (`scoring`), `model`, `skillsSource`, `skills`, `recommendations[{id, score, matchingSkills, missingSkills, similarCompletedTasks, breakdown{skills, workload, experience}, explanation}]`, `warnings` — the backend replaces `id` by the developer's public fields.

#### `POST /api/v1/ai/sprints/predict-risk`

```json
{
  "sprint": { "startDate": "2026-09-26", "endDate": "2026-10-09", "asOf": "2026-10-03" },
  "tasks": { "total": 6, "done": 1, "blocked": 2, "highComplexityOpen": 2, "unassignedOpen": 1, "totalPoints": 30, "donePoints": 3 },
  "team": { "size": 2, "historicalVelocity": 1.0 }
}
```

Rules: `endDate` ≥ `startDate`; done values ≤ totals; blocked, high-complexity and unassigned counts ≤ open tasks; `historicalVelocity` ≥ 0 or `null`. Response: `riskLevel`, `probability`, `method`, `factors[{code, label, impact}]`, `features` (the 7 values), `model` (name, version, accuracy, rocAuc, f1), `warnings`.

#### `POST /api/v1/ai/assistant/chat`

```json
{
  "messages": [
    { "role": "user", "content": "Which tasks are late?" },
    { "role": "assistant", "content": "", "toolCalls": [ { "id": "c1", "name": "list_tasks", "arguments": { "overdue": true } } ] },
    { "role": "tool", "toolCallId": "c1", "content": "{\"total\":1,\"tasks\":[…]}" }
  ],
  "project": { "name": "Shop", "status": "ACTIVE", "technologies": ["Angular"], "manager": "Sara Manager" },
  "today": "2026-10-03"
}
```

1–80 messages (`user`, `assistant` with optional `toolCalls`, `tool` with `toolCallId`; ≤ 20 000 characters each). → `{ "type": "message" | "tool_calls", "content", "toolCalls": [{ "id", "name", "arguments", "error" }], "model" }`; `error` is set when the arguments do not match the tool schema. 503 `LLM_NOT_CONFIGURED` without `OPENAI_API_KEY`; 502 when OpenAI fails.
