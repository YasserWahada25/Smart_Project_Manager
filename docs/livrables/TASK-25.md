# Livrable — TASK 25 : AI-04 assistant du manager (chat)

> Un onglet « Assistant » (réservé au manager) : on pose des questions sur le projet ou on demande des modifications ; l'assistant lit les données par des outils exécutés par le backend, et **chaque modification est présentée avec « Confirm » / « Dismiss »** — rien n'est appliqué sans le clic du manager. Aucune suppression possible.
> Réalisée le 3 octobre 2026 (13 h 40 → 14 h 10). Code commité en partie par le superviseur : service IA dans `e822517`, backend et écran dans `3c420cb` (« fix angular UI ») ; **la correction de typage de `assistant-page.ts` et la documentation ne sont pas commitées**.

## 1. Prompts à l'origine

| # | Heure | Prompt du superviseur (cité) | Décision / effet |
|---|---|---|---|
| 23 | 03/10 11:38 | « j'ai une idée chat pouvons nous integrer un chat au sein de notre application qui prend la discussion avec le manager et a l'acces de modifier sur notre plateforme fixer , ajouter , modifier selon besoins demandé depuis manager ? si oui la plannifier […] » | Faisable : planifié comme TASK 25 (plan dans le bilan § 7) — OpenAI avec outils, droits du manager, **confirmation avant toute modification**, données et non code de l'application |
| 28 | 03/10 13:13 | « continuer vers Tasks 23-24-25 une fois pour toutes » | Réalisée en dernier ; sans clé OpenAI, vérifiée avec des tests simulés et un serveur OpenAI simulé |

## 2. Ce qui a été livré

- **9 outils** : 4 de lecture (vue d'ensemble, liste filtrée des tâches, risque d'un sprint = AI-03, recommandation = AI-02) exécutés tout de suite ; 5 d'écriture (créer / modifier une tâche, assigner, changer un statut, créer un sprint) transformés en **propositions** au texte clair (« Assign «Login page» to Bob Martin »).
- **Confirmation** : `POST /projects/:id/ai/assistant/actions` applique la proposition avec **les mêmes règles de validation et services que l'API** (historique, notifications).
- **Garde-fous** : manager d'un projet non archivé ; pas d'outil de suppression ; arguments validés par Pydantic puis chaque identifiant vérifié dans le projet ; 6 appels au modèle et 12 outils maximum par message ; messages `system` venant du navigateur refusés ; données des utilisateurs déclarées non fiables dans le prompt (injection) ; conversation non stockée.
- **Sans clé OpenAI** : 503 `LLM_NOT_CONFIGURED` et message explicatif dans l'onglet (les autres fonctions IA restent disponibles).
- Prompt système exact, schémas des outils, validation, sécurité : [prompts.md](../prompts.md) partie B ; approche : [ai.md](../ai.md) § 4.4.

## 3. Nouveaux fichiers (insertions)

| Fichier | Lignes | Rôle |
|---|---|---|
| `ai-service/app/prompts/assistant.py` | 143 | Prompt système, 9 outils (schémas stricts) |
| `ai-service/app/schemas/assistant.py` | 130 | Messages, réponse, arguments de chaque outil (Pydantic) |
| `ai-service/app/services/assistant.py`, `routes/assistant.py` | 84 + 23 | Un tour de conversation, validation des appels d'outils, `POST /api/v1/ai/assistant/chat` |
| `ai-service/tests/test_assistant.py` | 137 | 11 tests pytest (OpenAI simulé) |
| `backend/src/services/aiAssistant.service.js` | 441 | Boucle (outils de lecture exécutés, écritures → propositions), actions confirmées |
| `backend/src/validators/aiAssistant.validator.js` | 35 | Règles de la conversation et des actions |
| `backend/tests/aiAssistant.test.js` | 269 | 12 tests Jest |
| `frontend/src/app/core/models/ai-assistant.ts`, `features/ai-assistant/ai-assistant.service.ts` | 33 + 35 | Interfaces, service |
| `frontend/src/app/features/ai-assistant/assistant-page/` (`.ts`, `.html`, `.scss`, `.spec.ts`) | 227 + 128 + 133 + 248 | Onglet « Assistant » et 9 tests |

## 4. Fichiers modifiés

| Fichier | Modification |
|---|---|
| `ai-service/app/main.py`, `services/llm_client.py` | Routeur ; méthode `chat` (appel avec outils), contrôle des statuts HTTP factorisé |
| `backend/src/controllers/ai.controller.js`, `routes/project.routes.js` | Routes `…/ai/assistant/chat` et `…/ai/assistant/actions` |
| `frontend/src/app/app.routes.ts` | Route enfant `assistant` |
| `frontend/.../project-shell/project-shell.ts`, `.html`, `.spec.ts` | Onglet « Assistant » visible pour le manager seulement |
| `docs/ai.md` (§ 4.4), `prompts.md` (partie B AI-04, prompt #28), `api.md`, `architecture.md`, `requirements.md`, `demo.md`, `testing.md`, `README.md`, `bilan.md`, `handoff.md`, `livrables/` | Documentation |

## 5. Preuves

| Vérification | Résultat |
|---|---|
| pytest / Jest / Vitest | IA **146**, backend **357**, frontend **349** — tous réussis ; flake8, ESLint, Prettier OK ; build OK (348,6 kB) ; 0 vulnérabilité |
| Bout en bout | **12/12** sur deux chaînes : configuration réelle sans clé (503 expliqué ; actions confirmées fonctionnelles, validation, historique) et chaîne vers un **serveur OpenAI simulé** (questions → outils exécutés sur les vraies données ; proposition sans modification ; confirmation → assignation + notification ; arguments invalides refusés ; 403 / 400) ; données supprimées |

## 6. Limites et suite

- **Non mesuré** : le comportement d'un vrai modèle OpenAI (qualité des réponses, choix des outils, résistance à l'injection) — à essayer quand la clé sera dans `ai-service/.env`.
- Conversation perdue en quittant la page ; cinq types de modification seulement.
- Suite : **TASK 26 — Docker et Docker Compose** (Docker Desktop doit être démarré).
