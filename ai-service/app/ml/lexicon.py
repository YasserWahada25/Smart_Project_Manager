"""Cue-word stems per task type (French and English, accent-free, lower-case).

Used as extra features of the Naive Bayes classifier ("k:BUG" when a bug cue is present…):
with ~20 training sentences per type, the words of a new sentence are often unknown to the
model; the lexicon generalises to synonyms and to the other language. The classifier still
learns from the data how much each cue matters.
"""

import re

LEXICON: dict[str, str] = {
    "BUG": (
        r"corrig|\bbug|erreur|error|crash|plant|anomal|defaut|defect|\bfix|repar|repair|ne fonctionne pas|broken|"
        r"\bfaux\b|wrong|incorrect|\bmal\b|double|duplicat|blank|exception|fail|echou|probleme|saute|n.?affich"
    ),
    "IMPROVEMENT": (
        r"amelior|improv|optimi|perform|rapid|speed|accelere|refactor|nettoy|clean|simplif|ergonom|moderni|"
        r"upgrade|redui|reduc|cache|polish|enhance|rework|revoir|lisib|responsiv|plus clair|better|"
        r"temps de reponse|response time|latenc"
    ),
    "TESTING": r"\btest|recette|\bqa\b|couverture|coverage|non.regression|regression|scenario",
    "DOCUMENTATION": (
        r"document|redig|\bwrite the|guide|manuel|manual|readme|tutori|swagger|openapi|release notes|"
        r"dictionnaire|training material|decision record|specification"
    ),
    "DEVOPS": (
        r"deploi|deploy|docker|conteneur|container|kubernetes|\bci\b|pipeline|github actions|integration continue|"
        r"production|cloud|\baws\b|azure|monitor|supervis|\blogs?\b|sauvegard|backup|terraform|infrastructure|"
        r"staging|environnement|https|certificat|domaine"
    ),
    "SECURITY": (
        r"secur|chiffr|encrypt|hash|injection|\bxss|csrf|rgpd|gdpr|vulnerab|penetration|audit|deux facteurs|"
        r"two.factor|permission|role|access control|\bjwt\b|rate limit|tentatives|vault|secret|confidenti"
    ),
    "FEATURE": (
        r"\bpeut\b|permet|pouvoir|\bcan\b|allow|utilisateur|\buser|client|customer|ajout|\badd\b|\bcreer|create|"
        r"affich|display|\bger|manage|as a|en tant qu|page|formulaire|\bsend|envoi|envoy|export|recherche|search|"
        r"rappel|remind|notif|reserv|book"
    ),
}

PATTERNS: dict[str, re.Pattern] = {label: re.compile(pattern) for label, pattern in LEXICON.items()}

# Very frequent words that carry no information about the task type.
STOP_WORDS = frozenset(
    """le la les un une des de du d l a au aux et ou en pour par sur avec dans ce cette ces son sa ses leur leurs
    qui que quoi est sont etre doit peut the an of to and or for in on with by is are be can as at from this that it
    its""".split()
)
