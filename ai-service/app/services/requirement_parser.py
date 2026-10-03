"""Local analyzer, step 1: the requirements written in a specification (French or English).

Recognised structures:
- headings: Markdown "#", numbered "2.1 Title", "IV. Title", upper-case lines, short "Title:" lines
  and "Module: X" labels → epic of the requirements below them. A heading with nothing below it is
  itself a requirement (e.g. a numbered list of short features);
- list items "-", "*", "•", "a)"… An item with indented sub-items groups them (it becomes their
  epic), except a user story or a full sentence: its sub-items are its acceptance criteria, like
  the items that follow a "Critères d'acceptation:" / "Acceptance criteria:" label;
- user stories "En tant que …, je veux … afin de …" / "As a …, I want … so that …";
- table rows ("a | b" or tab-separated) with column names (title, description, priority, points…);
- sentences of paragraphs that state a requirement ("doit", "devra", "permet", "must", "shall"…).
Context sections (introduction, glossary, planning, budget…) are ignored, out-of-scope sections
always. Explicit metadata is read and removed from the title: MoSCoW / priority, story points, days.
"""

import re
from dataclasses import dataclass, field

from ..errors import ApiError
from ..ml.text_classifier import normalize
from ..schemas.common import DESCRIPTION_MAX, MAX_TASKS, STORY_POINTS

TITLE_LIMIT = 120
EPIC_LIMIT = 100
DEFAULT_EPIC = "General"
FALLBACK_LIMIT = 60

# ---------- line patterns (on the original text) ----------
_MD_HEADING = re.compile(r"^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$")
_MULTI_NUMBER = re.compile(r"^\s*(\d{1,2}(?:\.\d{1,2}){1,3})\.?\s+(\S.*)$")
_SINGLE_NUMBER = re.compile(r"^\s*(\d{1,2})[.)]\s+(\S.*)$")
_ROMAN = re.compile(r"^\s*([IVX]{1,4})[.)]\s+(\S.*)$")
_LABEL = re.compile(r"^\s*([^:|\t]{2,60}?)\s*:\s*$")
_EPIC_LABEL = re.compile(r"^\s*(?:epic|[ée]pique|module|th[èe]me|domaine)\s*\d*\s*[:–—-]\s*(\S.{0,98})$", re.IGNORECASE)
_BULLET = re.compile(r"^(\s*)(?:[-*+•●▪◦‣○■□►▶✓✔–—]|\d{1,3}[.)]|[a-z][.)]|\(\w{1,3}\))\s+(\S.*)$")
_NOISE = re.compile(r"^\s*(?:page\s*)?\d+(?:\s*(?:/|sur|of)\s*\d+)?\s*$", re.IGNORECASE)
_TABLE_SEPARATOR = re.compile(r"^[\s|:+-]+$")
_HEADING_NUMBER = re.compile(r"^(?:\d{1,2}(?:\.\d{1,2})*\.?|[IVX]{1,4}[.)])\s+")

# ---------- text patterns (on normalized text: lower-case, no accents) ----------
_REQUIREMENT_VERB = re.compile(
    r"\b(doit|doivent|devra|devront|devrait|devraient|pourra|pourront|permet|permettent|permettra|permettre|"
    r"peut|peuvent|possibilite de|il faut|necessaire|obligatoire|must|shall|should|will be able|can|needs? to|"
    r"has to|have to|allows?|enables?|required)\b"
)
_SKIP_SECTION = re.compile(
    r"\b(introduction|contexte|context|presentation|objet du document|purpose|glossaire|glossary|definitions?|"
    r"acronymes|abreviations|sommaire|table des matieres|table of contents|contents|references|historique|"
    r"history|budget|couts?|costs?|planning|calendrier|schedule|timeline|equipe|team|contacts?|annexes?|"
    r"appendix|signatures?|approbation|approval|objectifs?|objectives?|goals?|enjeux)\b"
)
_OUT_OF_SCOPE = re.compile(r"\b(hors (du )?perimetre|hors scope|out of scope|exclusions?|non inclus|not included)\b")
_CRITERIA_LABEL = re.compile(
    r"^(criteres? d.acceptation|criteres? de validation|acceptance criteria|conditions? de succes)"
)

_STORY = re.compile(
    r"^(?:en\s+tant\s+qu(?:e\s+|['’]\s*)|as\s+an?\s+)(?P<role>[^,]{1,80}?),?\s+"
    r"(?:je\s+(?:veux|voudrais|souhaite|souhaiterais|dois\s+pouvoir|peux|aimerais|desire|désire)|j['’]aimerais|"
    r"i\s+(?:want|would\s+like|need|wish|can|should\s+be\s+able))\s+"
    r"(?:to\s+|pouvoir\s+|être\s+capable\s+de\s+|be\s+able\s+to\s+)?(?P<goal>.+?)"
    r"(?:,?\s+(?:afin\s+(?:de|d['’]|que|qu['’])|pour\s+(?:que|qu['’]|pouvoir)|de\s+sorte\s+que|so\s+that|"
    r"in\s+order\s+to)\s*(?P<benefit>.+))?$",
    re.IGNORECASE,
)
_ID_PREFIX = re.compile(r"^(?:#\d+|[A-Z]{1,6}[-_ ]?\d+(?:\.\d+)*|\d+(?:\.\d+)+)\s*[:.)–—-]\s*")
_MARKDOWN = re.compile(r"\*\*|__|`")

_VERB_START = re.compile(
    r"\b(doit|doivent|devra|devront|devrait|devraient|pourra|pourront|peut|peuvent|permet|permettent|permettra|"
    r"must|shall|should|will|can|needs? to|has to|have to|allows?|enables?)\b",
    re.IGNORECASE,
)
_PERMETTRE = re.compile(
    r"^(?:permettre|permet|permettent|permettra)\s+(?:(?:à|a|au|aux)\s+.{1,60}?\s+)?(?:de\s+|d['’]\s*)", re.IGNORECASE
)
_ALLOW = re.compile(r"^(?:allows?|enables?)\s+(?:.{1,60}?\s+)?to\s+", re.IGNORECASE)
_ABLE = re.compile(r"^(?:pouvoir|être\s+(?:en\s+mesure|capable)\s+de|be\s+able\s+to)\s+", re.IGNORECASE)
# Quality requirements ("doit être responsive") keep their whole sentence as title.
_STATE_VERB = re.compile(
    r"^(être|etre|be|avoir|have|rester|remain|respecter|comply|fonctionner|work|supporter|support)\b", re.IGNORECASE
)

# ---------- explicit metadata ----------
_PRIORITY_WORDS = {
    "CRITICAL": ("critique", "critical", "bloquant", "blocker", "urgent", "p0"),
    "HIGH": ("must", "must have", "m", "haute", "high", "elevee", "forte", "p1", "obligatoire", "essentiel", "1"),
    "MEDIUM": ("should", "should have", "s", "moyenne", "medium", "normale", "normal", "p2", "2"),
    "LOW": ("could", "could have", "c", "basse", "low", "faible", "p3", "optionnel", "optional", "3"),
    "EXCLUDED": ("won't", "wont", "won't have", "wont have", "w", "will not"),
}
_TAG = re.compile(
    r"[\[(]\s*(must(?: have)?|should(?: have)?|could(?: have)?|won['’]?t(?: have)?|haute|high|moyenne|medium|"
    r"basse|low|faible|critique|critical|bloquant|P[0-3])\s*[\])]",
    re.IGNORECASE,
)
_PRIORITY_LABEL = re.compile(
    r"[\[(,;–—-]?\s*\b(?:priorit[ée]|priority|moscow)\s*[:=]\s*(won['’]?t have|\w+(?: have)?)\s*[\])]?", re.IGNORECASE
)
_POINTS = re.compile(r"[\[(,;–—-]?\s*\b(\d{1,3})\s*(?:pts?|points?|sp|story points?)\b\s*[\])]?", re.IGNORECASE)
_POINTS_LABEL = re.compile(
    r"[\[(,;–—-]?\s*\b(?:estimation|estimate|complexit[ée]|complexity)\s*[:=]\s*(\d{1,3})\b"
    r"(?!\s*(?:j|jours?|jh|days?|h)\b)\s*[\])]?",
    re.IGNORECASE,
)
_DAYS = re.compile(
    r"[\[(,;–—-]?\s*(?:\b(?:estimation|estimate|charge|dur[ée]e|duration|effort)\s*[:=]\s*)?[\[(]?\s*"
    r"(\d{1,3}(?:[.,]\d+)?)\s*(j|jours?|jh|j/h|days?|h|heures?|hours?)\s*[\])]",
    re.IGNORECASE,
)
_DAYS_LABEL = re.compile(
    r"[\[(,;–—-]?\s*\b(?:estimation|estimate|charge|dur[ée]e|duration|effort)\s*[:=]\s*"
    r"(\d{1,3}(?:[.,]\d+)?)\s*(j|jours?|jh|j/h|days?|h|heures?|hours?)\b\s*[\])]?",
    re.IGNORECASE,
)

_COLUMNS = {
    "id": ("id", "ref", "reference", "n", "no", "num", "numero", "#", "code"),
    "priority": ("priorite", "priority", "moscow", "importance"),
    "points": ("points", "story points", "sp", "estimation", "estimate", "complexite", "complexity", "poids"),
    "days": ("jours", "days", "charge", "j/h", "effort", "duree", "duration"),
    "epic": ("epic", "epique", "module", "theme", "categorie", "category", "domaine", "domain", "composant",
             "component"),
    "criteria": ("criteres", "critere", "acceptance", "conditions"),
    "description": ("description", "detail", "details", "contenu", "content", "commentaire", "comment", "remarque"),
    "title": ("titre", "title", "intitule", "nom", "name", "fonctionnalite", "feature", "exigence", "requirement",
              "besoin", "need", "tache", "task", "user story", "story", "us", "item", "element", "objectif"),
}

_FRENCH = frozenset("le la les des du et est une pour dans doit que qui avec sur par au aux ce cette".split())
_ENGLISH = frozenset("the and is for with must shall should that which to of on by an be this".split())


@dataclass
class Requirement:
    title: str
    text: str
    epic: str
    priority: str | None = None
    points: int | None = None
    excluded: bool = False  # MoSCoW "Won't have": kept out of the sprints
    detailed: bool = False  # user story / full sentence: its sub-items are acceptance criteria
    is_group: bool = False  # list item with sub-items: an epic, not a task
    criteria: list[str] = field(default_factory=list)

    def description(self, language: str) -> str:
        parts = [] if self.text.lower() == self.title.lower() else [self.text]
        if self.criteria:
            label = "Critères d'acceptation :" if language == "fr" else "Acceptance criteria:"
            parts.append(label + "\n" + "\n".join(f"- {criterion}" for criterion in self.criteria))
        return "\n\n".join(parts)[:DESCRIPTION_MAX]


@dataclass
class ParseResult:
    requirements: list[Requirement]
    language: str
    warnings: list[str]


@dataclass
class _Line:
    kind: str  # heading | item | table | text | blank
    text: str = ""
    level: int = 0  # heading level / item indentation
    number: str = ""  # "2.1" of a numbered heading
    cells: list[str] = field(default_factory=list)


def detect_language(text: str) -> str:
    words = re.findall(r"[a-z]+", normalize(text[:20_000]))
    french = sum(word in _FRENCH for word in words)
    english = sum(word in _ENGLISH for word in words)
    return "en" if english > french else "fr"


def parse_requirements(text: str) -> ParseResult:
    """Raises ApiError 422 when no requirement can be found."""
    language = detect_language(text)
    lines = _mark_leaf_headings(_classify(text))
    warnings: list[str] = []

    requirements = _Extractor(skip_sections=True).run(lines)
    if not requirements:
        requirements = _Extractor(skip_sections=False).run(lines)
    if not requirements:
        requirements = _sentence_fallback(lines)
        if requirements:
            warnings.append(
                "No list, user story or requirement sentence was recognised: each sentence of the document became "
                "a task. Review the plan carefully."
            )
    if not requirements:
        raise ApiError(
            422,
            "No requirement could be identified in the document: write one requirement per line, "
            "as a list or as user stories",
        )

    requirements = _deduplicate(requirements)
    if len(requirements) > MAX_TASKS:
        warnings.append(f"The document contains {len(requirements)} requirements: only the first {MAX_TASKS} are kept.")
        requirements = requirements[:MAX_TASKS]
    return ParseResult(requirements, language, warnings)


# ---------- step 1: one kind per line ----------
def _classify(text: str) -> list[_Line]:
    lines: list[_Line] = []
    for raw in text.split("\n"):
        line = _classify_line(raw)
        previous = lines[-1] if lines else None
        # Line wrapped by the PDF extraction: a lower-case start continues the previous item.
        if line.kind == "text" and previous is not None and previous.kind == "item" and line.text[:1].islower():
            previous.text += " " + line.text
            continue
        lines.append(line)
    return lines


def _classify_line(raw: str) -> _Line:
    stripped = raw.strip()
    if _TABLE_SEPARATOR.match(stripped) and "|" in stripped:
        return _Line("table")  # "|---|---|" under a Markdown table header: no cells, keeps the table going
    if not stripped or _NOISE.match(stripped) or _TABLE_SEPARATOR.match(stripped):
        return _Line("blank")

    cells = _table_cells(stripped)
    if cells:
        return _Line("table", stripped, cells=cells)

    match = _MD_HEADING.match(raw)
    if match:
        return _Line("heading", _clean(_HEADING_NUMBER.sub("", match.group(2))), level=len(match.group(1)))
    match = _MULTI_NUMBER.match(raw)
    if match and _title_like(match.group(2)):
        return _Line("heading", _clean(match.group(2)), level=match.group(1).count(".") + 1, number=match.group(1))
    match = _SINGLE_NUMBER.match(raw)
    if match and _title_like(match.group(2)):
        return _Line("heading", _clean(match.group(2)), level=1, number=match.group(1))
    match = _ROMAN.match(raw)
    if match and _title_like(match.group(2)):
        return _Line("heading", _clean(match.group(2)), level=1)
    match = _EPIC_LABEL.match(raw)
    if match:
        return _Line("heading", _clean(match.group(1)), level=9)
    match = _LABEL.match(raw)
    if match and _title_like(match.group(1)):
        return _Line("heading", _clean(match.group(1)), level=9)
    if stripped.isupper() and len(stripped.split()) <= 8 and re.search(r"[A-Z]", stripped):
        return _Line("heading", _clean(stripped.capitalize()), level=1)

    match = _BULLET.match(raw.replace("\t", "    "))
    if match:
        return _Line("item", _clean(match.group(2)), level=len(match.group(1)))
    return _Line("text", _clean(stripped))


def _table_cells(line: str) -> list[str]:
    if "|" in line:
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    elif "\t" in line:
        cells = [cell.strip() for cell in line.split("\t")]
    else:
        return []
    return cells if sum(1 for cell in cells if cell) >= 2 else []


def _title_like(text: str) -> bool:
    text = text.strip()
    return (
        0 < len(text.split()) <= 10
        and not re.search(r"[.;!?]$", text)
        and not _REQUIREMENT_VERB.search(normalize(text))
        and not _STORY.match(text)
    )


def _mark_leaf_headings(lines: list[_Line]) -> list[_Line]:
    """A heading followed by no content (another heading of the same rank or the end) is a requirement."""
    # Consecutive "1. …", "2. …" lines with nothing between them are a numbered list, not headings.
    numbered = [line for line in lines if line.kind != "blank"]
    for line, following in zip(numbered, numbered[1:]):
        if _is_single_numbered(line) and _is_single_numbered(following):
            line.kind = following.kind = "item"
            line.level = following.level = 0

    for index, line in enumerate(lines):
        if line.kind != "heading":
            continue
        following = next((other for other in lines[index + 1:] if other.kind != "blank"), None)
        if following is not None and following.kind != "heading":
            continue
        if _SKIP_SECTION.search(normalize(line.text)) or _CRITERIA_LABEL.match(normalize(line.text)):
            continue
        is_parent = following is not None and (
            following.level > line.level
            and (not line.number or following.number.startswith(line.number + "."))
        )
        if not is_parent:
            line.kind, line.level = "item", 0
    return lines


def _is_single_numbered(line: _Line) -> bool:
    return line.kind == "heading" and bool(line.number) and "." not in line.number


# ---------- step 2: requirements ----------
class _Extractor:
    def __init__(self, skip_sections: bool):
        self.skip_sections = skip_sections
        self.requirements: list[Requirement] = []
        self.headings: list[tuple[int, str]] = []
        self.skip_level: int | None = None
        self.criteria_target: Requirement | None = None
        self.items: list[tuple[int, Requirement]] = []
        self.paragraph: list[str] = []
        self.table: list[list[str]] = []

    @property
    def epic(self) -> str:
        return self.headings[-1][1] if self.headings else DEFAULT_EPIC

    def run(self, lines: list[_Line]) -> list[Requirement]:
        for line in lines:
            if line.kind != "text":
                self._flush_paragraph()
            if line.kind != "table":
                self._flush_table()
            if line.kind == "heading":
                self._heading(line)
            elif line.kind == "item":
                self._item(line)
            elif line.kind == "table" and line.cells:
                self.table.append(line.cells)
            elif line.kind == "text":
                self.paragraph.append(line.text)
        self._flush_paragraph()
        self._flush_table()
        return [requirement for requirement in self.requirements if not requirement.is_group]

    def _heading(self, line: _Line) -> None:
        self.items.clear()
        self.criteria_target = None
        title = normalize(line.text)
        if _CRITERIA_LABEL.match(title):
            self.criteria_target = self.requirements[-1] if self.requirements else None
            return
        while self.headings and self.headings[-1][0] >= line.level:
            self.headings.pop()
        if self.skip_level is not None and line.level <= self.skip_level:
            self.skip_level = None
        if self.skip_level is None and (
            _OUT_OF_SCOPE.search(title) or (self.skip_sections and _SKIP_SECTION.search(title))
        ):
            self.skip_level = line.level
        self.headings.append((line.level, line.text[:EPIC_LIMIT]))

    def _item(self, line: _Line) -> None:
        if self.skip_level is not None:
            return
        story = _STORY.match(_strip_id(line.text))
        if self.criteria_target is not None and not story:
            self.criteria_target.criteria.append(line.text)
            return
        self.criteria_target = None

        while self.items and self.items[-1][0] >= line.level:
            self.items.pop()
        parent = self.items[-1][1] if self.items else None
        if parent is not None:
            if parent.detailed and not story:
                parent.criteria.append(line.text)
                self.items.append((line.level, parent))
                return
            parent.is_group = True
        requirement = _make(line.text, parent.title[:EPIC_LIMIT] if parent else self.epic)
        if requirement:
            self.requirements.append(requirement)
            self.items.append((line.level, requirement))

    def _flush_paragraph(self) -> None:
        paragraph, self.paragraph = " ".join(self.paragraph), []
        if not paragraph or self.skip_level is not None:
            return
        for sentence in _sentences(paragraph):
            if _STORY.match(_strip_id(sentence)) or _REQUIREMENT_VERB.search(normalize(sentence)):
                self.criteria_target = None
                self.items.clear()
                requirement = _make(sentence, self.epic)
                if requirement:
                    self.requirements.append(requirement)

    def _flush_table(self) -> None:
        rows, self.table = self.table, []
        if not rows or self.skip_level is not None:
            return
        self.criteria_target = None
        self.items.clear()
        columns = _header_columns(rows[0])
        for cells in rows[1:] if columns else rows:
            requirement = _table_requirement(cells, columns, self.epic)
            if requirement:
                self.requirements.append(requirement)


def _header_columns(cells: list[str]) -> dict[str, int]:
    columns: dict[str, int] = {}
    for index, cell in enumerate(cells):
        name = normalize(cell).strip(" :")
        for key, names in _COLUMNS.items():
            if key not in columns and any(name == candidate or name.startswith(candidate + " ") for candidate in names):
                columns[key] = index
                break
    return columns if "title" in columns or "description" in columns else {}


def _table_requirement(cells: list[str], columns: dict[str, int], epic: str) -> Requirement | None:
    def cell(key: str) -> str:
        index = columns.get(key)
        return cells[index].strip() if index is not None and index < len(cells) else ""

    if columns:
        title, description = cell("title"), cell("description")
        priority_word, points, days, epic = cell("priority"), cell("points"), cell("days"), cell("epic") or epic
        criteria = cell("criteria")
    else:
        # No header: the longest cell is the requirement, a cell may hold a priority word.
        candidates = [value for value in cells if value and not _is_metadata_cell(value)]
        if not candidates:
            return None
        title, description, points, days, criteria = max(candidates, key=len), "", "", "", ""
        priority_word = next((value for value in cells if _priority_from_word(value)[0]), "")

    main = title or description
    if not main:
        return None
    requirement = _make(main, epic[:EPIC_LIMIT] or DEFAULT_EPIC)
    if requirement is None:
        return None
    if title and description and normalize(description) != normalize(title):
        requirement.text = description
        requirement.detailed = True
    if criteria:
        parts = (part.strip(" -•") for part in re.split(r"[;\n]|\s-\s|•", criteria))
        requirement.criteria.extend(part for part in parts if part)
    priority, excluded = _priority_from_word(priority_word)
    if priority:
        requirement.priority, requirement.excluded = priority, excluded
    if points and re.fullmatch(r"\d{1,3}", points.strip()):
        requirement.points = _snap_points(int(points))
    elif days and re.fullmatch(r"\d{1,3}(?:[.,]\d+)?", days.strip()):
        requirement.points = _points_from_days(float(days.replace(",", ".")), "j")
    return requirement


def _is_metadata_cell(value: str) -> bool:
    return bool(
        re.fullmatch(r"#?\d{1,4}|[A-Z]{1,6}[-_ ]?\d+(?:\.\d+)*", value.strip()) or _priority_from_word(value)[0]
    )


def _sentences(paragraph: str) -> list[str]:
    parts = re.split(r"(?<=[.!?;])\s+(?=[A-ZÀ-ÖØ-Ý«\"“])", paragraph)
    return [part.strip() for part in parts if len(part.split()) >= 3]


def _sentence_fallback(lines: list[_Line]) -> list[Requirement]:
    requirements: list[Requirement] = []
    epic = DEFAULT_EPIC
    for line in lines:
        if line.kind == "heading":
            epic = line.text[:EPIC_LIMIT]
        elif line.kind in ("text", "item"):
            for sentence in _sentences(line.text) if line.kind == "text" else [line.text]:
                if len(sentence.split()) >= 4:
                    requirement = _make(sentence, epic)
                    if requirement:
                        requirements.append(requirement)
        if len(requirements) >= FALLBACK_LIMIT:
            break
    return requirements[:FALLBACK_LIMIT]


def _deduplicate(requirements: list[Requirement]) -> list[Requirement]:
    seen: set[str] = set()
    unique = []
    for requirement in requirements:
        key = re.sub(r"[^a-z0-9]", "", normalize(requirement.title))
        if key and key not in seen:
            seen.add(key)
            unique.append(requirement)
    return unique


# ---------- one requirement ----------
def _make(raw: str, epic: str) -> Requirement | None:
    text = _strip_id(_clean(raw))
    text, priority, excluded, points = _extract_metadata(text)
    text = text.strip(" \t-–—:;,")
    if not re.search(r"[A-Za-zÀ-ÿ]{2}", text):
        return None

    story = _STORY.match(text)
    if story:
        title, detailed = story.group("goal"), True
    else:
        title = _title_from_sentence(text)
        detailed = bool(_REQUIREMENT_VERB.search(normalize(text))) or len(text.split()) > 12
    title = _shorten(_capitalize(title.strip(" .;:,")))
    if len(title) < 3:
        return None
    return Requirement(
        title=title,
        text=text.rstrip(" ;,"),
        epic=epic or DEFAULT_EPIC,
        priority=priority,
        points=points,
        excluded=excluded,
        detailed=detailed,
    )


def _extract_metadata(text: str) -> tuple[str, str | None, bool, int | None]:
    priority, excluded, points = None, False, None
    for pattern in (_TAG, _PRIORITY_LABEL):
        match = pattern.search(text)
        if match:
            found, is_excluded = _priority_from_word(match.group(1))
            if found:
                priority, excluded = found, is_excluded
                text = text[:match.start()] + text[match.end():]
                break
    for pattern in (_POINTS, _POINTS_LABEL):
        match = pattern.search(text)
        if match:
            points = _snap_points(int(match.group(1)))
            text = text[:match.start()] + text[match.end():]
            break
    if points is None:
        for pattern in (_DAYS_LABEL, _DAYS):
            match = pattern.search(text)
            if match:
                points = _points_from_days(float(match.group(1).replace(",", ".")), match.group(2))
                text = text[:match.start()] + text[match.end():]
                break
    return re.sub(r"\s{2,}", " ", text).strip(), priority, excluded, points


def _priority_from_word(word: str) -> tuple[str | None, bool]:
    value = normalize(word).strip(" []().:").replace("’", "'")
    if not value:
        return None, False
    for priority, words in _PRIORITY_WORDS.items():
        if value in words:
            return ("LOW", True) if priority == "EXCLUDED" else (priority, False)
    return None, False


def _snap_points(value: int) -> int:
    """Nearest Fibonacci value of the backend (ties go to the larger one)."""
    return min(STORY_POINTS, key=lambda points: (abs(points - value), -points))


def _points_from_days(amount: float, unit: str) -> int:
    days = amount / 8 if unit.lower().startswith("h") else amount
    for limit, points in ((0.5, 1), (1, 2), (2, 3), (3, 5), (5, 8)):
        if days <= limit:
            return points
    return 13


def _title_from_sentence(text: str) -> str:
    match = _VERB_START.search(text)
    if not match or match.start() > 80:
        return text
    verb = match.group(1).lower()
    rest = text[match.start():] if verb.startswith(("permet", "allow", "enable")) else text[match.end():]
    rest = _ABLE.sub("", _ALLOW.sub("", _PERMETTRE.sub("", rest.strip(), count=1), count=1), count=1)
    if _STATE_VERB.match(rest) or len(rest.split()) < 2:
        return text
    return rest


def _strip_id(text: str) -> str:
    return _ID_PREFIX.sub("", text.strip(), count=1)


def _clean(text: str) -> str:
    return " ".join(_MARKDOWN.sub("", text).split()).strip(" \"'“”«»")


def _capitalize(text: str) -> str:
    return text[:1].upper() + text[1:]


def _shorten(text: str) -> str:
    if len(text) <= TITLE_LIMIT:
        return text
    cut = text[: TITLE_LIMIT - 1].rsplit(" ", 1)[0]
    return cut.rstrip(" ,;:") + "…"
