"""AI-02 — developer recommendation by transparent scoring (documented in docs/ai.md § 4.2).

score = 100 × (0.60 × skills + 0.25 × workload + 0.15 × experience), each part between 0 and 1:
- skills: mean over the task skills of the developer's level weight (BEGINNER 0.4, INTERMEDIATE 0.65,
  ADVANCED 0.85, EXPERT 1.0) + 0.05 per year of experience (at most +0.15, capped at 1); a missing
  skill counts 0; on a task of 8 points or more a BEGINNER level counts half. When the task names no
  skill at all, every developer gets 0.5 (neutral);
- workload: 1 − open story points / workload capacity (0 when the capacity is reached);
- experience: DONE tasks that required one of the task skills, 5 or more = 1 (without task skills:
  any DONE task, 10 or more = 1).
Skills are compared ignoring case, accents and punctuation ("Node.js" = "nodejs" = "NodeJS"), with a
few common aliases ("JS" = "JavaScript"…).
"""

import re

from ..ml.text_classifier import normalize
from ..schemas.recommendation import (
    Candidate,
    Recommendation,
    RecommendRequest,
    RecommendResponse,
    ScoreBreakdown,
)

MODEL = "transparent scoring v1 (skills 60 %, workload 25 %, experience 15 %)"
WEIGHTS = {"skills": 0.60, "workload": 0.25, "experience": 0.15}
LEVEL_WEIGHT = {"BEGINNER": 0.40, "INTERMEDIATE": 0.65, "ADVANCED": 0.85, "EXPERT": 1.0}
YEAR_BONUS, MAX_YEAR_BONUS = 0.05, 0.15
HIGH_COMPLEXITY = 8
NEUTRAL_SKILLS = 0.5
SIMILAR_TASKS_TARGET = 5
COMPLETED_TASKS_TARGET = 10

_ALIASES = {
    "js": "javascript",
    "ts": "typescript",
    "node": "nodejs",
    "postgres": "postgresql",
    "k8s": "kubernetes",
    "mongo": "mongodb",
    "py": "python",
    "reactjs": "react",
    "vuejs": "vue",
    "angularjs": "angular",
    "csharp": "c#",
}


def skill_key(name: str) -> str:
    """Comparison key of a skill name: lower-case, no accent, no punctuation (except + and #)."""
    key = re.sub(r"[^a-z0-9+#]", "", normalize(name))
    return _ALIASES.get(key, key)


def _mentioned(name: str, text: str) -> bool:
    pattern = r"(?<![a-z0-9])" + re.escape(normalize(name).strip()) + r"(?![a-z0-9])"
    return re.search(pattern, text) is not None


def target_skills(request: RecommendRequest) -> tuple[list[str], str]:
    """The skills to match and where they come from: required, inferred from the text, or none."""
    unique: dict[str, str] = {}
    for skill in request.task.requiredSkills:
        unique.setdefault(skill_key(skill), skill.strip())
    if unique:
        return list(unique.values()), "required"
    text = normalize(f"{request.task.title}\n{request.task.description}")
    for candidate in request.candidates:
        for skill in candidate.skills:
            key = skill_key(skill.name)
            if key and key not in unique and _mentioned(skill.name, text):
                unique[key] = skill.name.strip()
    return (list(unique.values()), "inferred") if unique else ([], "none")


def _skill_weight(level: str, years: float | None, complexity: int) -> float:
    weight = LEVEL_WEIGHT[level]
    if level == "BEGINNER" and complexity >= HIGH_COMPLEXITY:
        weight /= 2
    return min(1.0, weight + min(MAX_YEAR_BONUS, YEAR_BONUS * (years or 0)))


def score_candidate(candidate: Candidate, skills: list[str], request: RecommendRequest) -> Recommendation:
    own = {skill_key(skill.name): skill for skill in candidate.skills}
    matching, missing, weights = [], [], []
    for name in skills:
        found = own.get(skill_key(name))
        if found:
            matching.append(found.name)
            weights.append(_skill_weight(found.level, found.yearsOfExperience, request.task.complexity))
        else:
            missing.append(name)
            weights.append(0.0)
    skills_part = sum(weights) / len(weights) if weights else NEUTRAL_SKILLS

    capacity = request.options.workloadCapacity
    workload_part = max(0.0, 1 - candidate.openPoints / capacity)

    keys = {skill_key(name) for name in skills}
    similar = sum(count for name, count in candidate.completedSkills.items() if skill_key(name) in keys)
    # A DONE task requiring two of the skills is counted once.
    similar = min(similar, candidate.completedTasks)
    if keys:
        experience_part = min(1.0, similar / SIMILAR_TASKS_TARGET)
    else:
        experience_part = min(1.0, candidate.completedTasks / COMPLETED_TASKS_TARGET)

    total = (
        WEIGHTS["skills"] * skills_part
        + WEIGHTS["workload"] * workload_part
        + WEIGHTS["experience"] * experience_part
    )
    return Recommendation(
        id=candidate.id,
        score=round(100 * total),
        matchingSkills=matching,
        missingSkills=missing,
        similarCompletedTasks=similar,
        breakdown=ScoreBreakdown(
            skills=round(skills_part, 3), workload=round(workload_part, 3), experience=round(experience_part, 3)
        ),
        explanation=_explain(candidate, skills, matching, missing, similar, capacity),
    )


def _explain(
    candidate: Candidate, skills: list[str], matching: list[str], missing: list[str], similar: int, capacity: int
) -> str:
    levels = {skill_key(skill.name): skill.level.lower() for skill in candidate.skills}
    parts = []
    if skills:
        detail = ", ".join(f"{name} ({levels[skill_key(name)]})" for name in matching)
        parts.append(f"Has {len(matching)} of {len(skills)} skills" + (f": {detail}" if detail else ""))
        if missing:
            parts.append(f"missing {', '.join(missing)}")
    plural = "task" if candidate.openTasks == 1 else "tasks"
    parts.append(f"{candidate.openPoints} open points ({candidate.openTasks} {plural}) for a capacity of {capacity}")
    if skills:
        parts.append(f"{similar} completed task{'' if similar == 1 else 's'} with these skills")
    else:
        parts.append(f"{candidate.completedTasks} completed task{'' if candidate.completedTasks == 1 else 's'}")
    return "; ".join(parts) + "."


def recommend(request: RecommendRequest) -> RecommendResponse:
    skills, source = target_skills(request)
    names = {candidate.id: candidate.name for candidate in request.candidates}
    points = {candidate.id: candidate.openPoints for candidate in request.candidates}
    ranked = sorted(
        (score_candidate(candidate, skills, request) for candidate in request.candidates),
        key=lambda item: (-item.score, points[item.id], names[item.id].lower()),
    )
    warnings = []
    if source == "none":
        warnings.append(
            "The task names no skill and none of the team skills appears in its text: the ranking relies on "
            "workload and experience only. Add required skills to the task for a better recommendation."
        )
    elif source == "inferred":
        warnings.append(f"The task has no required skill: skills found in its text were used ({', '.join(skills)}).")
    if skills and not any(not item.missingSkills for item in ranked):
        covered = {skill_key(name) for item in ranked for name in item.matchingSkills}
        uncovered = [name for name in skills if skill_key(name) not in covered]
        warnings.append(
            "No member has all the skills of the task"
            + (f"; nobody has: {', '.join(uncovered)}." if uncovered else ".")
        )
    return RecommendResponse(
        method="scoring",
        model=MODEL,
        skillsSource=source,
        skills=skills,
        recommendations=ranked[: request.options.limit],
        warnings=warnings,
    )
