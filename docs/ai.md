# AI Features and Models

> Current state: **no AI feature is implemented yet.**
> Each feature section is completed (approach, data, model, metrics, endpoint) when the feature is implemented.

## 1. Principles

- AI is used only where it brings a measurable benefit, never for visual effect.
- Every AI feature has a clear input, clear output, defined technical approach, validation, error handling and documented behavior.
- AI runs in the separate FastAPI service; the Express backend calls it, validates the result and persists it if needed.
- AI-generated output is validated before being saved to MongoDB.

## 2. Feature overview

| ID    | Feature | Input | Output | Status |
|-------|---------|-------|--------|--------|
| AI-01 | Automatic task generation | Project or feature description | Structured tasks: title, description, type, priority, required skills, estimated complexity | Planned |
| AI-02 | Developer recommendation | Task required skills, developer skills, current workload, previous experience, availability (if implemented) | Recommended developer, compatibility score, matching skills, optional explanation | Planned |
| AI-03 | Sprint delay risk prediction | Total/completed/remaining/blocked tasks, high-complexity tasks, days remaining, team size, team velocity | Risk level (`LOW`/`MEDIUM`/`HIGH`), probability, main contributing factors | Planned |
| OPT-1 | Task complexity estimation | — | — | Optional |
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

None yet.
