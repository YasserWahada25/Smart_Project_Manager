# AI Features and Models

> Current state: **AI-01 (planning from the specification) is implemented** (TASK 22). AI-02, AI-03 and AI-04 are planned (TASK 23–25).
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
| AI-02 | Developer recommendation | Task required skills, developer skills, current workload, previous experience, availability (if implemented) | Recommended developer, compatibility score, matching skills, optional explanation | Planned |
| AI-03 | Sprint delay risk prediction | Total/completed/remaining/blocked tasks, high-complexity tasks, days remaining, team size, team velocity | Risk level (`LOW`/`MEDIUM`/`HIGH`), probability, main contributing factors | Planned |
| AI-04 | Manager assistant (chat) | Manager message + project data (through backend tools) | Answers, and changes proposed then applied only after the manager confirms | Planned (TASK 25) |
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
| 2a. Analysis — OpenAI | `services/llm_client.py`, `prompts/project_plan.py` | When `OPENAI_API_KEY` is set: Chat Completions with **structured outputs** (strict JSON schema), temperature 0.2. Returns epics → tasks. Prompt, schema and validation: [prompts.md](prompts.md) Part B |
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
