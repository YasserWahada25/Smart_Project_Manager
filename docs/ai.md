# AI Features and Models

> Current state: **AI-01 (planning from the specification, TASK 22), AI-02 (developer recommendation, TASK 23) and AI-03 (sprint delay risk, TASK 24) and AI-04 (manager assistant, TASK 25) are implemented.**
> Each feature section is completed (approach, data, model, metrics, endpoint) when the feature is implemented.

## 1. Principles

- AI is used only where it brings a measurable benefit, never for visual effect.
- Every AI feature has a clear input, clear output, defined technical approach, validation, error handling and documented behavior.
- AI runs in the separate FastAPI service; the Express backend calls it, validates the result and persists it if needed.
- AI-generated output is validated before being saved to MongoDB.

## 2. Feature overview

| ID    | Feature | Input | Output | Status |
|-------|---------|-------|--------|--------|
| AI-01 | Sprint & task planning from the specification (includes automatic task generation and complexity estimation) | Specification pasted and/or uploaded (.txt, .md, .pdf, .docx), project context, team skills, sprint options | Sprints (dates, objective) containing structured tasks: title, description, type, priority, required skills, story points; backlog; warnings | **Done** (TASK 22) |
| AI-02 | Developer recommendation | Task required skills (or skills found in its text), developer skills and levels, current workload, previous experience | Ranked developers: compatibility score 0–100, matching / missing skills, score breakdown, explanation | **Done** (TASK 23) |
| AI-03 | Sprint delay risk prediction | Total/completed/blocked/unassigned tasks, open high-complexity tasks, story points, dates, team size, velocity of the previous sprints | Risk level (`LOW`/`MEDIUM`/`HIGH`), probability, main contributing factors | **Done** (TASK 24) |
| AI-04 | Manager assistant (chat) | Manager message + project data (through backend tools) | Answers, and changes proposed then applied only after the manager confirms | **Done** (TASK 25) |
| OPT-1 | Task complexity estimation | — | — | Covered by AI-01 (story points per task) |
| OPT-2 | Automatic sprint summary | — | — | Optional |
| OPT-3 | Intelligent task prioritization | — | — | Optional |

The technical approach (ML vs. LLM vs. rule-based scoring) is decided and justified in each feature's task.

### Data already collected for AI features

| Data | Source | Used by |
|------|--------|---------|
| Task `requiredSkills`, assignee workload (open tasks / story points per developer) | `tasks` | AI-02 |
| Sprint data: tasks per status, story points (`complexity`), blocked tasks, high-complexity tasks (≥ 8 points), dates, `completedAt` of sprints and tasks (velocity) | `sprints`, `tasks` | AI-03 |
| Developer skills: `name`, `level` (`BEGINNER` < `INTERMEDIATE` < `ADVANCED` < `EXPERT`, i.e. 1–4), optional `yearsOfExperience` | `users.skills` (see [database.md](database.md)), edited through `PUT /api/v1/profile/skills` | AI-02 |

## 3. Documentation template

### For a Machine Learning feature

- Problem
- Dataset (source, size, how generated/collected)
- Features
- Preprocessing
- Model / algorithm (and why)
- Training method
- Evaluation metrics and results
- Model persistence (file, format, loading)
- Prediction API endpoint

### For an LLM feature

See [prompts.md](prompts.md) for prompts. Here document:

- Provider / model
- Input / output
- Expected JSON structure
- Validation
- Timeout and error handling
- Security considerations

## 4. Implemented features

### 4.1 AI-01 — Sprint & task planning from the specification

**Problem.** For every project, the manager used to create the sprints and each task by hand. With AI-01 the manager pastes the specification (cahier des charges, product backlog, user stories…) and/or uploads it; the AI proposes the epics, the tasks (type, priority, story points, skills) and their split into sprints. The manager **reviews and edits** the proposal, then applies it. **Nothing is created before "Apply the plan".**

#### Approach: hybrid (LLM + local analyzer)

| Step | Where | What |
|---|---|---|
| 1. Text | `ai-service/app/services/text_extraction.py` | A file becomes plain text with its structure kept as Markdown: Word headings → `# …`, list items → `- …` (indented), table rows → `a \| b`. `.txt` / `.md` read as UTF-8 (cp1252 fallback), `.pdf` with pypdf (300 pages max; password-protected or image-only PDF → 422), `.docx` with python-docx. Other extensions → 415. Text cut at `MAX_DOCUMENT_CHARS` (100 000) with `truncated: true` |
| 2a. Analysis — LLM | `services/llm_client.py`, `prompts/project_plan.py` | When `OPENAI_API_KEY` is set: Chat Completions with **structured outputs** (JSON schema; strict on OpenAI), temperature 0.2, on OpenAI or any OpenAI-compatible provider (Google Gemini on the development machine). Returns epics → tasks. Prompt, schema and validation: [prompts.md](prompts.md) Part B |
| 2b. Analysis — local analyzer | `services/requirement_parser.py`, `services/task_enricher.py`, `ml/` | Without a key, **or when the OpenAI call fails** (timeout, quota, invalid answer…): rules + a Naive Bayes classifier, below. The answer always says which one ran (`method: "llm" \| "local"`) and a warning explains a fallback |
| 3. Sprints | `services/sprint_planner.py` | Same deterministic planner for both analyzers (below) |
| 4. Validation, review, creation | backend `services/aiPlan.service.js`, Angular `features/ai-plan/` | The backend validates the AI answer strictly (any wrong field → 502) and numbers the sprints after the existing ones; the manager edits the plan; the reviewed plan is validated again and created all-or-nothing |

Why hybrid: an LLM understands free-form specifications best, but needs a paid key, sends the document to a third party and can fail; the local analyzer always works, offline and for free, on structured documents (headings, lists, user stories, tables). The supervisor chose this approach (prompt #22 of [prompts.md](prompts.md)).

#### Local analyzer, step 1 — requirements (`requirement_parser.py`)

- **Recognised structures** (French and English): headings (Markdown `#`, numbered `2.1 Title`, roman numerals, upper-case lines, `Module: X`) → epic of the requirements below; list items (`-`, `*`, `•`, `1.`, `a)`); an item with sub-items becomes their epic, except a user story or a full sentence, whose sub-items are its acceptance criteria (also after an "Acceptance criteria:" label); user stories "As a …, I want … so that …" / "En tant que …, je veux … afin de …"; table rows with column names (title, description, priority, points, days, epic…); requirement sentences of paragraphs ("must", "shall", "doit", "permet"…).
- **Skipped**: context sections (introduction, glossary, planning, budget…) and out-of-scope sections.
- **Explicit metadata** read and removed from the title: MoSCoW / priority (`(Must)`, `[P1]`, `Priority: high`), story points (`5 pts`), days (`3 jours` → points: ≤ 0.5 d = 1, ≤ 1 = 2, ≤ 2 = 3, ≤ 3 = 5, ≤ 5 = 8, more = 13), also combined in one bracket (`(Must, 5 pts)`, `[Won't have; 2 jours]`). Points are snapped to the nearest Fibonacci value. "Won't have" → task kept for the backlog.
- Duplicates removed, **at most 100** requirements; when no structure is found, requirement-like sentences are used; nothing usable → **422**.

#### Local analyzer, step 2 — tasks (`task_enricher.py`)

| Field | Rule |
|---|---|
| `type` | Naive Bayes classifier (below). In a specification almost everything is to be built, so `BUG` is kept only when a correction is explicitly asked ("fix", "corriger", "bug"…), otherwise `FEATURE` |
| `priority` | Explicit value of the document; else keywords (critical/blocking → CRITICAL, mandatory/essential → HIGH, optional/later → LOW, foundations such as authentication or database → HIGH); else per type (SECURITY, BUG → HIGH, DOCUMENTATION → LOW, others MEDIUM) |
| `complexity` | Explicit points or days; else a base per type (FEATURE 3, BUG 2, DOCUMENTATION 2…) raised one Fibonacci step per "heavy" topic found (integration, payment, real time, files/import/export, AI, reporting, messaging, maps, workflow, scale, security, i18n; at most two steps) and lowered for light UI work |
| `requiredSkills` | Project technologies and team skills named in the text, the matching part of the project stack (a screen → the frontend framework, an API → the backend…), a skill dictionary and a skill per type (Testing, Security, DevOps, Technical writing); unique ignoring case, **at most 5** |
| `epic` | The heading the requirement belongs to (`General` otherwise) |

#### ML model — task type classifier (`ai-service/app/ml/`)

| Item | Value |
|---|---|
| Problem | Classify a requirement sentence into the 7 task types: FEATURE, BUG, IMPROVEMENT, TESTING, DOCUMENTATION, DEVOPS, SECURITY |
| Dataset | `app/ml/data/task_types.csv`: **155 hand-written sentences** (French and English) labelled by hand — synthetic, written for the project. FEATURE 30, BUG 22, IMPROVEMENT 22, TESTING 21, DEVOPS 20, DOCUMENTATION 20, SECURITY 20 |
| Features | Lower-cased, accent-free words without stop words (sub-linear term frequency `1 + log(count)`), plus one **lexicon cue** per type whose FR/EN stem list matches (`lexicon.py`, weight 2.0). The cues generalise to synonyms and to the other language, which about 20 sentences per type cannot cover |
| Model | **Multinomial Naive Bayes**, Laplace smoothing (α = 1), log space; features never seen in training are ignored at prediction time. Written in pure Python (`text_classifier.py`): scikit-learn / scipy DLLs were blocked by Windows application control on the development machine, and the model is simple enough to implement and test directly |
| Training | `python -m app.ml.task_type_model` (< 1 s). Also done automatically at the first prediction when the model file is missing, outdated (`MODEL_VERSION = 3`) or the dataset changed (hash) |
| Evaluation | **Stratified 5-fold cross-validation (seed 42): accuracy 0.916, macro F1 0.921.** Per-class F1: BUG 0.878, DEVOPS 0.95, DOCUMENTATION 0.974, FEATURE 0.833, IMPROVEMENT 0.936, SECURITY 0.923, TESTING 0.955. Reproduced on 3 October 2026 (Python 3.12.5) |
| Caveat | These metrics are **optimistic**: the data is synthetic and the lexicon was written while looking at it. With words only (no lexicon), accuracy was about 0.48 during development. Real specifications will score lower; the classifier is a fallback, and the manager reviews every type |
| Persistence | JSON file `app/ml/models/task_type.json` (git-ignored, rebuilt automatically): vocabulary, class priors, log-probabilities, metrics, dataset hash, version |

#### Sprint planner (`sprint_planner.py`, both analyzers)

- Tasks sorted by **priority** (CRITICAL → LOW), then document order.
- Each task goes into the first sprint with room for its story points (`capacityPerSprint`, default 20, 3–200), never before a sprint holding a higher-priority task. A task larger than the capacity gets its own sprint (warning: split it).
- **At most 20 sprints**; tasks that do not fit, and "Won't have" tasks, go to the **backlog** (with a warning).
- Sprint *i* starts at `startDate + i × sprintLengthDays` (default 14 days, 5–30) and lasts `sprintLengthDays` days; its objective lists its epics ("Deliver: Authentication, Catalog"). The backend chooses the default start date (today, the project start if later, or the day after the last existing sprint) and names the sprints after the existing ones (`Sprint 4`…).
- Warning when the last sprint ends after the project deadline.

#### Validation and errors

| Layer | Checks |
|---|---|
| Angular | Text ≥ 20 characters or a file; extension and 5 MB before upload; options in range; reviewed plan: titles, lengths, sprint end ≥ start, skills (≤ 20, ≤ 50 characters, unique), 1–100 tasks |
| Backend — proposal | Manager of a non-archived project (403/404 otherwise, checked **before** the file is read); multer: one file, 5 MB (413), `.txt .md .pdf .docx` (415); text ≤ 200 000 characters (cut with a warning); content refused by the AI service (unreadable or scanned file, no requirement found) → **400** with its message; the AI answer must match the contract exactly (method, dates, enums, Fibonacci points, lengths, ≤ 20 sprints, ≤ 100 tasks), otherwise **502** `AI_ERROR` and nothing is returned |
| Backend — apply | express-validator on every sprint and task field, 1–100 tasks, ≤ 20 sprints, end ≥ start; sprints and tasks inserted with ids chosen in advance and removed if any insert fails (all or nothing); one `AI_PLAN_APPLIED` activity |
| AI service | Token header (401); Pydantic request schema (400 `BAD_REQUEST`); LLM answer validated by Pydantic (`extra="forbid"`, enums), then cleaned (lengths cut, empty and duplicate tasks dropped, ≤ 60 tasks); invalid → local analyzer |
| AI unavailable | Backend → 503 `AI_UNAVAILABLE` (not configured / unreachable), 504 `AI_TIMEOUT` (> `AI_TIMEOUT_MS`, 90 s); shown on the page, the input is kept |

#### Limits

- The local analyzer depends on the document structure: a free-form essay gives fewer and rougher tasks than a structured backlog (the page shows the method used).
- The classifier is trained on 155 synthetic sentences: its metrics do not measure real-world accuracy (no labelled real specifications are available).
- Story points are estimates from rules (local) or from the LLM: the manager is expected to adjust them during the review.
- Scanned PDFs (images only) are refused: no OCR.
- When OpenAI is enabled, the specification (up to `LLM_MAX_DOCUMENT_CHARS`, 30 000 characters) is sent to OpenAI; the page says so before generation. The OpenAI path is covered by mocked tests only: no key was available during development.
- The epic of a task is shown during the review and used for the sprint objective, but is not stored on the task (no field in the task model).

### 4.2 AI-02 — Developer recommendation

**Problem.** When a task is ready, the manager must choose who takes it: the developer with the right skills, who is not overloaded and who has already done similar work. AI-02 ranks the active members of the project for a task and explains each score; the manager assigns one in a click (the assignment stays the manager's decision).

#### Approach: transparent scoring (rule-based)

Why not a trained model: the platform has **no history of "good" assignments** to learn from (no labels), and a recommendation that decides who works on what must be **explainable** to the manager. A weighted score over measurable criteria is deterministic, testable and readable; its weights are documented and can be tuned. (Implemented in `ai-service/app/services/developer_scoring.py`.)

```
score = round(100 × (0.60 × skills + 0.25 × workload + 0.15 × experience))      each part in [0, 1]
```

| Part | Computation |
|---|---|
| **Skills** (60 %) | Mean, over the skills of the task, of the developer's level weight: BEGINNER 0.40, INTERMEDIATE 0.65, ADVANCED 0.85, EXPERT 1.0, + 0.05 per year of experience (at most + 0.15; capped at 1). A missing skill counts 0. On a task of **8 points or more**, a BEGINNER level counts half (0.20). When the task has no skill at all (none required, none found in its text), every developer gets 0.5 (neutral) |
| **Workload** (25 %) | `1 − open story points / capacity` (0 when the capacity is reached). Open = assigned tasks not DONE, **in every project** (a developer busy elsewhere is not available), the task itself excluded. Capacity = 20 points (the default sprint capacity of AI-01) |
| **Experience** (15 %) | DONE tasks of the developer that required at least one of the task skills: 5 or more = 1 (`n / 5`). Without task skills: any DONE task, 10 or more = 1 |

- **Which skills**: the task's `requiredSkills`; if it has none, the team skills **named in its title or description** (e.g. "Write the Docker compose file" → Docker), with a warning; otherwise none (warning: the ranking relies on workload and experience).
- **Skill matching** ignores case, accents and punctuation (`Node.js` = `nodejs` = `NodeJS`) and knows a few aliases (`JS` → JavaScript, `TS` → TypeScript, `Node` → Node.js, `Postgres` → PostgreSQL, `K8s` → Kubernetes, `Mongo` → MongoDB…). `C++` and `C#` stay distinct.
- **Ties**: same score → the developer with fewer open points first, then by name.
- **Output**: the top 5 developers with `score`, `matchingSkills`, `missingSkills`, `similarCompletedTasks`, `breakdown` (the three parts) and a generated `explanation` ("Has 2 of 2 skills: angular (beginner), NodeJS (intermediate); 0 open points (0 tasks) for a capacity of 20; 1 completed task with these skills."), plus warnings ("No member has all the skills of the task; nobody has: Node.js.").

**Worked example** (verified end to end, task "Login page", 8 points, skills Angular + Node.js):

| Developer | Skills | Open points | Similar DONE | Skills / workload / experience | Score |
|---|---|---|---|---|---|
| Bob | angular BEGINNER, NodeJS INTERMEDIATE | 0 | 1 | (0.20 + 0.65) / 2 = 0.425 / 1.0 / 0.2 | **54** |
| Alice | Angular EXPERT, 3 years | 13 | 0 | (1.0 + 0) / 2 = 0.5 / 0.35 / 0 | 39 |
| Carol | Python, Docker | 0 | 0 | 0 / 1.0 / 0 | 25 |

#### Data flow and validation

1. The backend (`backend/src/services/aiRecommendation.service.js`) loads the task (manager of a non-archived project only), the **active** members (deactivated accounts cannot be assigned), their workload and DONE tasks (MongoDB aggregations), and sends them to `POST /api/v1/ai/developers/recommend`. No member → empty answer with an explanation, without calling the AI service.
2. The AI service validates the request (Pydantic: levels, story points, ≤ 100 candidates…) and returns the ranking.
3. The backend checks the answer strictly (method, every id among the candidates, no duplicate, integer score 0–100, ratios 0–1, string lists) → otherwise **502** `AI_ERROR`; it adds the developers' public fields and `isAssignee`.
4. The Angular dialog shows the ranking; **Assign** calls the existing `PATCH /tasks/:id/assignee` (same rules, activity and notification as a manual assignment).

#### Limits

- The weights (60 / 25 / 15), level weights and the 20-point capacity are expert choices, not learned; they are not validated against real assignment outcomes.
- Skills are compared by name: synonyms outside the alias list (e.g. "Spring" vs "Spring Boot") do not match.
- Availability (holidays, part time) is not modelled: the platform has no such data.
- Experience counts DONE tasks with the same skill names, whatever their size or quality.

### 4.3 AI-03 — Sprint delay risk prediction (Machine Learning)

**Problem.** During a sprint, the manager wants to know early whether all the committed story points will be done by the end date, and why not. AI-03 gives the risk (`LOW` / `MEDIUM` / `HIGH`), the probability of a delay and the main factors, for every planned or active sprint. It is shown on the active sprints of both dashboards and of the Sprints tab (FR-13 "AI risk indicators").

| Item | Value |
|---|---|
| Problem type | Binary classification: will story points be left at the end date (`delayed` = 1)? |
| Dataset | `ai-service/app/ml/data/sprint_risk.csv`: **2 000 simulated sprints** (49.5 % delayed), generated by `app/ml/sprint_risk_data.py` (seed 2026). **Synthetic**: the platform has no sprint history yet |
| Simulation | A team of 1–8 members with a hidden velocity per member (log-normal around 0.7 point/day) commits to 50–125 % of what it can deliver over a 7–21-day sprint, observed on a random day. Blocked tasks, open tasks of 8+ points and unassigned tasks reduce the velocity ("friction"). The past and future velocities get random noise (log-normal, σ 0.20 and 0.25), so the label is **not** a function of the features. The historical velocity known by the backend is the true one ± 20 %, missing for 30 % of the teams |
| Features (7) | `elapsed_ratio` (time elapsed ÷ duration), `progress_gap` (elapsed ratio − share of points done; > 0 = behind), `pace_ratio` (points/day still needed ÷ usual pace, capped at 5; usual pace = velocity of the last 3 completed sprints, else the pace of this sprint, else the planned pace), `blocked_ratio`, `high_complexity_ratio`, `unassigned_ratio` (÷ open tasks), `load_per_member` (points per member and per remaining day, capped at 5) — `app/ml/sprint_features.py`, **shared by the simulator and the prediction** so they cannot diverge |
| Preprocessing | Standardisation (z-score with the training means and standard deviations) |
| Model | **Logistic regression**, L2 = 0.01, fitted by Newton's method (IRLS) in pure Python (`app/ml/logistic_regression.py`). Chosen because it is accurate enough here, fast, and **explainable**: each feature's contribution `w × z` (log-odds) gives the factors shown to the manager |
| Training | Stratified split **75 % / 25 %** (seed 42): 1 500 train, 500 test; < 1 s. `python -m app.ml.sprint_risk_model`, also automatic when `app/ml/models/sprint_risk.json` is missing, outdated (`MODEL_VERSION = 1`) or the dataset changed |
| **Results (test set, 500 sprints)** | **accuracy 0.864, precision 0.875, recall 0.847, F1 0.861, ROC AUC 0.934** (confusion: 210 TP, 30 FP, 222 TN, 38 FN) |
| Baseline | Rule "late if `progress_gap` > 0.10": accuracy 0.696, precision 0.944, recall 0.411, F1 0.573 — the model finds twice as many late sprints for a similar false-alarm level |
| Learned weights (standardised) | intercept 0.128; `pace_ratio` 2.353, `progress_gap` 1.688, `blocked_ratio` 0.791, `high_complexity_ratio` 0.379, `elapsed_ratio` −0.125 (all printed by the training command) |
| Persistence | `app/ml/models/sprint_risk.json` (git-ignored, rebuilt automatically): means, standard deviations, weights, metrics, dataset hash, version |
| Caveat | The metrics measure how well the model learned **the simulator**, not real projects. Once real sprints are completed, the dataset should be replaced by the platform's history (same features) and the model re-trained |

#### Prediction (`app/services/sprint_risk.py`)

- Probability < 0.35 → **LOW**, < 0.65 → **MEDIUM**, otherwise **HIGH**.
- **Factors**: the features with the largest positive contribution (> 0.25 log-odds, at most 3; a MEDIUM or HIGH risk always names at least its main cause), described with the sprint's numbers, e.g. "Needs 3.9× the usual pace: 3.9 points/day for 7 remaining days (usual 1.0)", "Behind schedule: 50% of the time elapsed, 10% of the story points done", "2 blocked tasks (40% of the open tasks)".
- **Obvious cases by rule** (`method: "rule"`, no model): no estimated task → LOW 0; every point done → LOW 0; end date passed with points left → HIGH 1.
- Warnings: no active developer (a team of one is assumed); no completed sprint yet (pace estimated from the sprint itself).

#### Data flow

1. `GET /api/v1/sprints/:id/ai/risk` (any project viewer; planned or active sprints only — 409 otherwise): the backend (`aiRisk.service.js`) counts the sprint's tasks (total, done, blocked, open with 8+ points, open unassigned), story points, active team size and the velocity of the last 3 completed sprints (DONE points ÷ days), and sends them with today's date.
2. The AI service validates the request (consistent counts, dates in order) and predicts.
3. The backend validates the answer (level, probability 0–1, factors, numeric features, model name) → otherwise 502, then returns it with the measures. Nothing is stored: the risk is recomputed at each display.

#### Limits

- Synthetic training data (see caveat); the thresholds 0.35 / 0.65 are conventions.
- The sprint is measured in story points: unestimated work is invisible; the velocity uses the last 3 completed sprints of the project, whatever the team changes.
- Days are calendar days (weekends and holidays are not modelled).

### 4.4 AI-04 — Manager assistant (LLM with tools)

**Problem.** Idea of the supervisor (prompt #23): a chat in which the manager asks about the project ("which tasks are late?", "summarize the sprint", "who is free?") and asks for changes ("create a task…", "assign…", "move… to the next sprint"), instead of navigating through several screens.

**Approach.** An LLM (OpenAI, function calling) with **9 tools** executed by the Express backend — the only component that touches MongoDB:

| Kind | Tools | Execution |
|---|---|---|
| Read | `get_project_overview`, `list_tasks`, `get_sprint_risk` (AI-03), `recommend_developers` (AI-02) | Immediately, with the manager's rights, limited to the project (50 tasks per list) |
| Write | `create_task`, `update_task`, `assign_task`, `change_task_status`, `create_sprint` | **Never executed by the model**: each call becomes a proposal shown in plain language ("Assign «Login page» to Bob Martin"); applied only when the manager clicks **Confirm**, through the same validation rules and services as the REST API (history, notifications) |

There is **no delete tool**. The chat acts on the project **data**, never on the application code. Prompt, tool schemas, validation and security: [prompts.md](prompts.md) Part B.

**Why no local fallback.** Unlike AI-01, understanding free questions and choosing tools requires an LLM; without `OPENAI_API_KEY` the backend answers 503 `LLM_NOT_CONFIGURED` and the page explains how to enable the assistant (AI-01 to AI-03 keep working).

**Safeguards.** Manager of a non-archived project only; ≤ 20 messages of ≤ 4 000 characters per request, no `system` message accepted from the browser; ≤ 6 model calls and ≤ 12 tool calls per message; tool arguments validated by Pydantic (AI service) then every id checked inside the project (backend); invalid calls are returned to the model as errors (it can correct itself); untrusted data rule in the prompt. The conversation is **saved per manager and project** (`assistantconversations`, 200 messages max) with the outcome of each proposal: it is still there after leaving the page or reloading; a saved proposal is applied with its stored arguments, and only once (api.md § 1.17).

**Evaluation.** The loop is verified with **Google Gemini** (`gemini-3.5-flash-lite`): 6/6 end-to-end checks on 3 October 2026, then the saved conversation (FIX-1, 4 October: question → proposal → confirmation → reload); the quality of the answers is not measured on a benchmark. The loop, the proposals, the confirmations and the safeguards are verified by automated tests with a mocked OpenAI (pytest, Jest, Vitest) and by an end-to-end run of the real services against a **simulated OpenAI server** that calls the tools (12/12 checks, [testing.md](testing.md)).

**Limits.** Quality depends on the model; answers are not cached; one saved conversation per manager and project (no list of past conversations); only five kinds of change are possible (no deletion, no member management, no sprint status change).
