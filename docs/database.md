# Database Design (MongoDB)

> Current state: **collections `users`, `projects`, `sprints`, `tasks`, `comments`, `activities` and `notifications`.**
> Each collection is documented here (schema, validation, references, indexes) when its task implements it.

## 1. Technology

- Database: MongoDB
- ODM: Mongoose 9
- Connection string: `MONGODB_URI` environment variable (required; see [deployment.md](deployment.md))
- Default local database name: `smart_project_manager`

## 1.1 Connection management (implemented)

File: `backend/src/config/database.js`

| Function | Behavior |
|----------|----------|
| `connectDatabase(uri, options)` | Connects Mongoose; server selection timeout 10 s; logs `disconnected` / `reconnected` / `error` events. Throws if `uri` is empty or MongoDB is unreachable. |
| `disconnectDatabase()` | Closes the connection (used on graceful shutdown and in tests). |
| `getDatabaseStatus()` | Returns the Mongoose state: `connected`, `connecting`, `disconnecting`, `disconnected`. Used by `GET /api/v1/health`. |

The backend connects **before** starting the HTTP server; if the connection fails, the process exits with code 1.

Tests use `mongodb-memory-server` (an in-memory MongoDB started by Jest), so no local database is needed to run them.

## 2. Design principles

- Use Mongoose schemas with explicit types, `required` fields and validation.
- Use references (`ObjectId` + `ref`) between independent entities (users, projects, sprints, tasks).
- Embed small value lists that belong to a single document (e.g. technologies, skills).
- Enable `timestamps` where creation/update dates are useful.
- Add indexes only when justified by queries.
- Avoid duplicated data.

## 3. Planned collections

| Collection   | Purpose | Status |
|--------------|---------|--------|
| `users`      | Accounts, roles, profiles, developer skills | Implemented |
| `projects`   | Projects, manager, members, technologies | Implemented |
| `sprints`    | Sprints belonging to a project | Implemented |
| `tasks`      | Tasks belonging to a project (and optionally a sprint) | Implemented |
| `comments`   | Comments on tasks | Implemented |
| `activities` | Activity history | Implemented |
| `notifications` | User notifications | Implemented |

## 4. Enumerations (from requirements)

| Enumeration     | Values |
|-----------------|--------|
| User role       | `ADMIN`, `PROJECT_MANAGER`, `DEVELOPER` |
| Project status  | `PLANNING`, `ACTIVE`, `PAUSED`, `COMPLETED`, `ARCHIVED` |
| Sprint status   | `PLANNED`, `ACTIVE`, `COMPLETED`, `CANCELLED` |
| Task type       | `FEATURE`, `BUG`, `IMPROVEMENT`, `TESTING`, `DOCUMENTATION`, `DEVOPS`, `SECURITY` |
| Task priority   | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| Task status     | `TODO`, `IN_PROGRESS`, `CODE_REVIEW`, `TESTING`, `DONE`, `BLOCKED` |

## 5. Implemented schemas

### 5.1 `users` — model `User` (`backend/src/models/user.model.js`)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `_id` | ObjectId | auto | Exposed as `id` in JSON |
| `firstName` | String | required, trim, max 50 | |
| `lastName` | String | required, trim, max 50 | |
| `email` | String | required, **unique**, trim, lowercase, max 254, email format | Login identifier |
| `password` | String | required, min 8 (before hashing), `select: false` | bcrypt hash (`$2b$`, cost `BCRYPT_SALT_ROUNDS`, default 12) |
| `role` | String | enum `ADMIN` / `PROJECT_MANAGER` / `DEVELOPER`, default `DEVELOPER` | |
| `isActive` | Boolean | default `true` | Deactivated users cannot log in or use their token |
| `jobTitle` | String | trim, max 100, default `''` | Profile |
| `bio` | String | trim, max 500, default `''` | Profile |
| `skills` | [Skill] (embedded) | max 50 items, unique names (case-insensitive), default `[]` | Used by AI-02 developer recommendation |
| `passwordChangedAt` | Date | set on every password change (not at creation) | Tokens issued before it are rejected; never returned in JSON |
| `createdAt`, `updatedAt` | Date | auto (`timestamps`) | |

**Embedded `Skill` sub-document** (no `_id`):

| Field | Type | Constraints |
|-------|------|-------------|
| `name` | String | required, trim, max 50 |
| `level` | String | required, enum `BEGINNER` < `INTERMEDIATE` < `ADVANCED` < `EXPERT` |
| `yearsOfExperience` | Number | optional, 0–50 |

Skills are **embedded** rather than stored in a separate collection: they are always read and written together with their owner, a user has few of them (≤ 50), and no other document references a single skill. Skill names are free text (e.g. `Node.js`); matching them against task required skills (normalization of `Node.js` / `nodejs`…) will be handled by the AI-02 feature.

**Indexes**

| Index | Type | Justification |
|-------|------|---------------|
| `{ _id: 1 }` | default | — |
| `{ email: 1 }` | unique | Login lookup by email; guarantees no duplicate accounts even under concurrent registrations |

No index on `role`, `isActive` or `createdAt` yet: the admin user list filters/sorts on them, but the `users` collection stays small for a team platform (hundreds of documents), where a collection scan is cheap. To be revisited if needed.

**Behavior**

- `pre('save')` hook: hashes `password` with bcrypt only when it was modified (no double hashing on other updates); on a password **change** (not creation) also sets `passwordChangedAt`.
- `comparePassword(candidate)`: bcrypt comparison (the document must be loaded with `.select('+password')`).
- `isTokenIssuedBeforePasswordChange(iat)`: true if a JWT `iat` (seconds) is older than `passwordChangedAt` (compared at second precision).
- `toJSON` transform: removes `password`, `passwordChangedAt`, `_id` and `__v`, adds `id` — the password hash can never leak through an API response.

### 5.2 `projects` — model `Project` (`backend/src/models/project.model.js`)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `name` | String | required, trim, max 100 | |
| `description` | String | trim, max 2000, default `''` | |
| `startDate` | Date | required | |
| `deadline` | Date | optional, ≥ `startDate` | Checked in a `pre('validate')` hook so that changing only `startDate` is checked too |
| `status` | String | enum `PLANNING` / `ACTIVE` / `PAUSED` / `COMPLETED` / `ARCHIVED`, default `PLANNING` | `ARCHIVED` = read-only |
| `technologies` | [String] | ≤ 30 items, each trimmed, max 50 | Unique (case-insensitive) checked by the request validator |
| `manager` | ObjectId → `users` | required | The PROJECT_MANAGER who created the project |
| `members` | [ObjectId → `users`] | ≤ 50 | The team (DEVELOPER accounts) |
| `createdAt`, `updatedAt` | Date | auto | |

**Relationship design:** `manager` and `members` are **references** (not embedded copies) — user data (names, skills, status) changes independently and must not be duplicated. Members are stored on the project (bounded list ≤ 50) rather than on the user, because the main queries are "members of this project" and "projects of this user", both served by the multikey index below. API responses populate them with public fields only.

**Indexes**

| Index | Justification |
|-------|---------------|
| `{ manager: 1 }` | "Projects I manage" (project manager's project list) |
| `{ members: 1 }` (multikey) | "Projects I am a member of" (developer's project list) |

### 5.3 `sprints` — model `Sprint` (`backend/src/models/sprint.model.js`)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `name` | String | required, trim, max 100 | |
| `objective` | String | trim, max 1000, default `''` | |
| `project` | ObjectId → `projects` | required | |
| `startDate`, `endDate` | Date | required, `endDate ≥ startDate` (`pre('validate')`) | |
| `status` | String | enum `PLANNED` / `ACTIVE` / `COMPLETED` / `CANCELLED`, default `PLANNED` | Transitions enforced by `canTransitionTo()` |
| `completedAt` | Date | set when the sprint becomes `COMPLETED` | For velocity / risk prediction |
| `createdAt`, `updatedAt` | Date | auto | |

The sprint's tasks are **not** stored in the sprint: each task references its sprint (`tasks.sprint`), which avoids keeping two lists in sync.

**Indexes**

| Index | Justification |
|-------|---------------|
| `{ project: 1, startDate: 1 }` | Sprint list of a project in chronological order |
| `{ project: 1 }` **unique**, partial `{ status: 'ACTIVE' }` (`one_active_sprint_per_project`) | Business rule "one active sprint per project" guaranteed by the database, even for concurrent requests |

### 5.4 `tasks` — model `Task` (`backend/src/models/task.model.js`)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `title` | String | required, trim, max 200 | |
| `description` | String | trim, max 5000, default `''` | |
| `type` | String | enum `FEATURE` / `BUG` / `IMPROVEMENT` / `TESTING` / `DOCUMENTATION` / `DEVOPS` / `SECURITY`, default `FEATURE` | |
| `priority` | String | enum `LOW` / `MEDIUM` / `HIGH` / `CRITICAL`, default `MEDIUM` | Weights 1–4 for ordering |
| `complexity` | Number | one of `1, 2, 3, 5, 8, 13`, default 3 | **Story points**; ≥ 8 = high complexity |
| `status` | String | enum `TODO` / `IN_PROGRESS` / `CODE_REVIEW` / `TESTING` / `DONE` / `BLOCKED`, default `TODO` | Transitions enforced by `canTransitionTo()` |
| `deadline` | Date | optional | |
| `requiredSkills` | [String] | ≤ 20, each trimmed, max 50 | Used by AI-02 |
| `project` | ObjectId → `projects` | required | |
| `sprint` | ObjectId → `sprints` | default `null` | `null` = backlog |
| `assignee` | ObjectId → `users` | default `null` | Must be an active project member |
| `createdBy` | ObjectId → `users` | required | |
| `blockedReason` | String | max 500 | Only while `BLOCKED` |
| `completedAt` | Date | | Set on `DONE`, removed on reopen (velocity, AI-03) |
| `createdAt`, `updatedAt` | Date | auto | |

Virtual (in JSON, not stored): `isOverdue` = `deadline < now` and `status ≠ DONE`.

**Indexes**

| Index | Justification |
|-------|---------------|
| `{ project: 1, status: 1 }` | Project task list, Kanban board, project statistics |
| `{ sprint: 1, status: 1 }` | Sprint board and sprint statistics (aggregation by status) |
| `{ assignee: 1, status: 1 }` | "My tasks", member-removal guard, developer workload |

### 5.5 `comments` — model `Comment` (`backend/src/models/comment.model.js`)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `task` | ObjectId → `tasks` | required | |
| `project` | ObjectId → `projects` | required | Copy of the task's project (immutable): access checks without loading the task |
| `author` | ObjectId → `users` | required | |
| `content` | String | required, trim, max 2000 | |
| `editedAt` | Date | | Set when the author edits |
| `createdAt`, `updatedAt` | Date | auto | |

Index `{ task: 1, createdAt: 1 }`: comments of a task in chronological order. Comments are **not embedded** in the task: their number is unbounded and they are paginated independently. They are deleted with their task.

### 5.6 `activities` — model `Activity` (`backend/src/models/activity.model.js`)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `project` | ObjectId → `projects` | required | |
| `actor` | ObjectId → `users` | required | Who did it |
| `type` | String | required, enum (16 types, see api.md §1.13) | |
| `task`, `sprint` | ObjectId | optional | Related entity (may have been deleted since) |
| `targetUser` | ObjectId → `users` | optional | Affected user (member added/removed, assignee) |
| `details` | Mixed | default `{}` | Small snapshot: `{ title }`, `{ from, to }`, `{ fields }` |
| `createdAt` | Date | auto (no `updatedAt`: append-only) | |

**Indexes:** `{ project: 1, createdAt: -1 }` (project history), `{ task: 1, createdAt: -1 }` (task history).

### 5.7 `notifications` — model `Notification` (`backend/src/models/notification.model.js`)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `recipient` | ObjectId → `users` | required | Owner of the notification |
| `type` | String | required, enum (7 types, see api.md §1.14) | |
| `message` | String | required, max 300 | Generated text (names and titles at the time of the event) |
| `actor` | ObjectId → `users` | required | |
| `project` | ObjectId → `projects` | required | |
| `task`, `sprint` | ObjectId | optional | For navigation from the UI |
| `read` | Boolean | default `false` | |
| `readAt` | Date | | |
| `createdAt` | Date | auto | |

**Indexes**

| Index | Justification |
|-------|---------------|
| `{ recipient: 1, read: 1, createdAt: -1 }` | "My notifications" (all or unread only), newest first, and the unread counter |
| `{ createdAt: 1 }` with `expireAfterSeconds: 7776000` (TTL, 90 days) | Automatic purge of old notifications |
