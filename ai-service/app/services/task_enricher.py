"""Local analyzer, step 2: a requirement becomes a task (type, priority, story points, skills).

- type: Naive Bayes classifier (app/ml). In a specification almost everything is to be built, so
  BUG is only kept when a correction is explicitly asked ("corriger", "fix"…);
- priority: explicit value of the document (MoSCoW…) or keywords, else a default per type;
- complexity: explicit points / days of the document, else a base per type adjusted by the
  "heavy" topics found (integration, payment, real time…) and the length of the requirement;
- skills: technologies of the project and skills of the team named in the text, the matching
  part of the project stack (frontend for a screen, backend for an API…) and a skill dictionary.
"""

import re

from ..ml.task_type_model import predict_type
from ..ml.text_classifier import normalize
from ..schemas.common import SKILL_MAX, STORY_POINTS, TITLE_MAX
from ..schemas.planning import PlannedTask
from .requirement_parser import Requirement

MAX_TASK_SKILLS = 5

_EXPLICIT_BUG = re.compile(r"\b(corrig\w*|fix\w*|bugs?|anomalies?|defauts?|defects?|repar\w*|repair\w*)\b")

_CRITICAL = re.compile(r"\b(critiques?|critical|bloquant\w*|blocking|blockers?|urgent\w*|urgence|vitale?s?|asap)\b")
_HIGH = re.compile(
    r"\b(obligatoires?|mandatory|essentiel\w*|essential|prioritaires?|primordia\w*|indispensables?|imperati\w*|"
    r"required|requis\w*|important\w*)\b"
)
_LOW = re.compile(
    r"\b(optionnel\w*|optional|facultati\w*|nice to have|bonus|si possible|if possible|eventuel\w*|plus tard|later|"
    r"futur\w*|future|v2|pourrai\w*|could|cosmetiques?|cosmetic|secondaires?|secondary)\b"
)
_FOUNDATION = re.compile(
    r"\b(authentifi\w*|authentication|login|connexion|inscription|sign ?up|register\w*|architecture|"
    r"mise en place|setup|set up|initialis\w*|initializ\w*|base de donnees|database)\b"
)
_DEFAULT_PRIORITY = {"SECURITY": "HIGH", "BUG": "HIGH", "DOCUMENTATION": "LOW"}

_BASE_POINTS = {"FEATURE": 3, "BUG": 2, "IMPROVEMENT": 3, "TESTING": 3, "DOCUMENTATION": 2, "DEVOPS": 3, "SECURITY": 3}
# Each topic found adds one Fibonacci step (at most two).
_HEAVY_TOPICS = {
    "integration": r"integration|api externe|external api|third.party|\btiers\b|webhook",
    "payment": r"paiement|payment|stripe|paypal|factur|billing|invoice",
    "real time": r"temps reel|real.time|websocket|synchronis|synchroniz|offline|hors ligne",
    "data": r"migration|\bimport(?:er|s|ation)?\b|\bexport|upload|fichiers?\b|\bfiles?\b|\bpdf\b|\bcsv\b|excel",
    "ai": r"machine learning|apprentissage|\bia\b|\bai\b|intelligence artificielle|recommand|predict|predi",
    "reporting": r"rapports?\b|reports?\b|dashboard|tableau de bord|statisti|(?<!charte )graphique|\bcharts?\b|\bkpi",
    "messaging": r"notification|e.?mail|\bsms\b|\bchat\b|messagerie|messaging|rappel|reminder",
    "location": r"carte|\bmaps?\b|geolocalis|geolocat|gps",
    "workflow": r"workflow|validation en|approbation|approval|calendrier|calendar|planification|scheduling",
    "scale": r"performance|scalab|haute disponibilite|high availability|load balanc|cluster|kubernetes|\bcache\b",
    "security": r"chiffr|encrypt|\bsso\b|oauth|deux facteurs|two.factor|2fa|\brgpd|gdpr|audit",
    "i18n": r"multi.?langu|internationali|i18n|traduction|translation",
}
_LIGHT = re.compile(
    r"\b(afficher|display|consulter|view|voir|lister|libelles?|labels?|liens?|links?|boutons?|buttons?|couleurs?|"
    r"colou?rs?|logo|icones?|icons?|tooltip|renommer|rename|readme)\b"
)

# (pattern on normalized text, skill name)
_SKILLS: tuple[tuple[str, str], ...] = (
    (r"angular", "Angular"),
    (r"\breact\b", "React"),
    (r"vue\.?js|\bvue\b", "Vue.js"),
    (r"node\.?js|\bnode\b", "Node.js"),
    (r"\bexpress(?:\.?js)?\b", "Express"),
    (r"mongo", "MongoDB"),
    (r"mysql", "MySQL"),
    (r"postgre", "PostgreSQL"),
    (r"\bsql\b|base de donnees|database", "Database"),
    (r"python", "Python"),
    (r"fastapi", "FastAPI"),
    (r"django", "Django"),
    (r"\bjava\b", "Java"),
    (r"spring", "Spring"),
    (r"\bphp\b|laravel|symfony", "PHP"),
    (r"docker|conteneur|container", "Docker"),
    (r"kubernetes|\bk8s\b", "Kubernetes"),
    (r"\bci\b|\bcd\b|pipeline|github actions|gitlab ci|jenkins|integration continue|deploiement continu", "CI/CD"),
    (r"\baws\b|amazon web", "AWS"),
    (r"azure", "Azure"),
    (r"typescript", "TypeScript"),
    (r"javascript", "JavaScript"),
    (r"\bapi\b|\brest\b|endpoint|web service", "REST API"),
    (r"authentifi|authentication|login|connexion|inscription|sign ?up|register|\bjwt\b|oauth|\bsso\b|mot de passe|"
     r"password", "Authentication"),
    (r"securi|chiffr|encrypt|\brgpd|gdpr|vulnerab|\bxss\b|csrf|injection|bcrypt|\bhash", "Security"),
    (r"\btests?\b|recette|\bqa\b|coverage|couverture", "Testing"),
    (r"interface|\bihm\b|\bui\b|\bux\b|maquette|mockup|ergonom|design|responsive|ecrans?\b|screens?\b|\bpages?\b|"
     r"formulaires?|\bforms?\b", "UI/UX"),
    (r"paiement|payment|stripe|paypal|factur|billing|invoice", "Payments"),
    (r"e.?mail|smtp|courriel", "Email"),
    (r"\bpdf\b|rapports?\b|reports?\b|\bexport", "Reporting"),
    (r"(?<!charte )graphiques?\b|\bcharts?\b|dashboard|tableau de bord|statisti|\bkpi", "Data visualization"),
    (r"machine learning|apprentissage automatique|\bia\b|\bai\b|intelligence artificielle|\bnlp\b|recommand",
     "Machine Learning"),
    (r"\bmobiles?\b|android|\bios\b|flutter|react native", "Mobile"),
    (r"documentation|rediger|\bguide|manuel|manual|readme|swagger|openapi", "Technical writing"),
    (r"deploi|deploy|\bserveurs?\b|\bservers?\b|hebergement|hosting|cloud|infrastructure|monitoring|supervision|"
     r"sauvegarde|backup",
     "DevOps"),
    (r"temps reel|real.time|websocket|socket\.io", "WebSockets"),
    (r"recherche|search|filtre|filter", "Search"),
)
_COMPILED_SKILLS = tuple((re.compile(pattern), name) for pattern, name in _SKILLS)
_TYPE_SKILL = {"TESTING": "Testing", "SECURITY": "Security", "DEVOPS": "DevOps", "DOCUMENTATION": "Technical writing"}

# Parts of the project stack, to tag a screen with the frontend framework, an API with the backend…
_FRONTEND = {"angular", "react", "vue.js", "vue", "svelte", "next.js", "nuxt", "flutter", "html", "css", "typescript"}
_BACKEND = {"node.js", "node", "express", "express.js", "nestjs", "django", "flask", "fastapi", "spring", "spring boot",
            "laravel", "symfony", "php", "java", ".net", "asp.net", "python", "ruby on rails", "go"}
_DATABASE = {"mongodb", "mysql", "postgresql", "postgres", "sqlite", "oracle", "sql server", "redis", "firebase",
             "mariadb", "mongoose"}


def to_task(
    requirement: Requirement, language: str, technologies: list[str], team_skills: list[str]
) -> PlannedTask:
    # The title is usually taken from the text; a table title + description gives both.
    same = normalize(requirement.title) in normalize(requirement.text)
    text = requirement.text if same else f"{requirement.title}. {requirement.text}"
    normalized = normalize(text)

    task_type, _ = predict_type(text)
    if task_type == "BUG" and not _EXPLICIT_BUG.search(normalized):
        task_type = "FEATURE"

    return PlannedTask(
        title=requirement.title[:TITLE_MAX],
        description=requirement.description(language),
        type=task_type,
        priority=requirement.priority or infer_priority(normalized, task_type),
        complexity=requirement.points or infer_complexity(normalized, task_type, len(requirement.criteria)),
        requiredSkills=infer_skills(normalize(f"{text} {' '.join(requirement.criteria)}"), task_type,
                                    technologies, team_skills),
        epic=requirement.epic,
    )


def infer_priority(normalized: str, task_type: str) -> str:
    if _CRITICAL.search(normalized):
        return "CRITICAL"
    if _HIGH.search(normalized):
        return "HIGH"
    if _LOW.search(normalized):
        return "LOW"
    if task_type in _DEFAULT_PRIORITY:
        return _DEFAULT_PRIORITY[task_type]
    if _FOUNDATION.search(normalized):
        return "HIGH"  # the other features depend on it
    return "MEDIUM"


def infer_complexity(normalized: str, task_type: str, criteria_count: int = 0) -> int:
    step = STORY_POINTS.index(_BASE_POINTS[task_type])
    heavy = sum(1 for pattern in _HEAVY_TOPICS.values() if re.search(pattern, normalized))
    step += min(heavy, 2)
    if not heavy and _LIGHT.search(normalized):
        step -= 1
    # A short list item is not a small task ("Emprunter un livre"): only long requirements count.
    if len(normalized.split()) > 60 or criteria_count >= 5:
        step += 1
    # Inference stops at 8 points: 13 only when the document says so (the task should be split).
    return STORY_POINTS[max(0, min(step, STORY_POINTS.index(8)))]


def infer_skills(normalized: str, task_type: str, technologies: list[str], team_skills: list[str]) -> list[str]:
    known = _known_names(team_skills + technologies)
    mentioned = [name for name in known.values() if _mentions(normalized, normalize(name))]

    found = [name for pattern, name in _COMPILED_SKILLS if pattern.search(normalized)]
    default = _TYPE_SKILL.get(task_type)
    if default and default not in found:
        found.append(default)

    stack = []
    project_stack = {normalize(name): name for name in technologies}
    if "UI/UX" in found:
        stack += [name for key, name in project_stack.items() if key in _FRONTEND]
    if {"REST API", "Authentication", "Database", "Email", "Payments", "Reporting"} & set(found):
        stack += [name for key, name in project_stack.items() if key in _BACKEND]
    if "Database" in found or "Search" in found:
        stack += [name for key, name in project_stack.items() if key in _DATABASE]

    skills: list[str] = []
    seen: set[str] = set()
    for name in mentioned + stack + found:
        key = _skill_key(name)
        name = known.get(key, name)  # the team's spelling wins ("NodeJS" and "Node.js" are one skill)
        if key and key not in seen and len(name) <= SKILL_MAX:
            seen.add(key)
            skills.append(name)
    return skills[:MAX_TASK_SKILLS]


def _skill_key(name: str) -> str:
    return re.sub(r"[^a-z0-9+#]", "", normalize(name))


def _known_names(names: list[str]) -> dict[str, str]:
    known: dict[str, str] = {}
    for name in names:
        cleaned = " ".join(name.split())
        if _skill_key(cleaned):
            known.setdefault(_skill_key(cleaned), cleaned)
    return known


def _mentions(normalized: str, name: str) -> bool:
    if len(name) < 2:
        return False
    return re.search(r"(?<![a-z0-9])" + re.escape(name) + r"(?![a-z0-9])", normalized) is not None
