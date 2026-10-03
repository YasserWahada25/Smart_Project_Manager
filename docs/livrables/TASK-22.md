# Livrable — TASK 22 : AI-01 « Plan with AI »

> Planification d'un projet depuis son cahier des charges : le manager colle le texte et/ou dépose un fichier, l'IA propose les sprints et les tâches, le manager relit, modifie puis valide la création.
> Réalisée le 3 octobre 2026 en deux sessions : agent 1 (service IA et backend, commit `a8470b0` du superviseur), agent 2 (écran Angular, vérification de bout en bout, correction, documentation — **non commité**, à valider par le superviseur).

## 1. Prompts à l'origine

| # | Heure | Prompt du superviseur (cité) | Décision / effet |
|---|---|---|---|
| 22 | 03/10 11:09 | « donc la gestion de projet se deroule correctement […] au lieu que a chaque projet en insere manuellement les sprints avec ses differents tasks je veux a l'aide d'un modele ia n'importe quel methode le manager est demander d'inserer la cahier de charge […] et depend de ces insertion il replis automatiquement ces differents partie » | 4 questions posées par l'agent. Réponses du superviseur : méthode **hybride** (LLM + analyseur local), fournisseur **OpenAI**, entrée **texte collé + fichiers** (.txt, .md, .pdf, .docx), **relecture puis validation** par le manager (rien n'est créé avant). Feuille de route réordonnée : TASK 20 FastAPI, 21 liaison, **22 = AI-01** |
| 23 | 11:38 | « j'ai une idée chat pouvons nous integrer un chat au sein de notre application […] » | Hors TASK 22 : planifié comme TASK 25 (AI-04). La TASK 22 a continué |
| 24 | 12:01 | « vous avez presq a votre weekly limite donner se qu'il faut faire avec un autre agent […] » | Arrêt au milieu de la TASK 22 ; rédaction de [handoff.md](../handoff.md) |
| 25 | ≈ 12:20 | « Tu reprends le projet SMART PROJECT MANAGER […] Termine la TASK 22 en suivant handoff.md § 3 dans l'ordre : écran Angular « Plan with AI », vérification de bout en bout, documentation, bilan. […] Ne commite pas, n'affiche pas le contenu des fichiers .env, et ne touche à aucune autre base MongoDB que smart_project_manager. » + « continuer a implementer les tasks […] a chaque fois j'ai besoins des livrables […] » | Reprise par un nouvel agent ; fin de la TASK 22 ; création de ce dossier `livrables/` ; arrêt avant la TASK 23 |
| 26 | ≈ 12:38 | « attend je vus ajoute les env » | L'agent ne crée pas les `.env` et attend ceux du superviseur (seuls les noms des variables sont vérifiés) |
| 27 | ≈ 12:50 | Copie de terminal : `ng serve` → « The Angular CLI requires a minimum of v22.22.3 » | Node 22.21.1 trop ancien pour Angular 22 : outils Angular exécutés avec un Node 24 portable ; installation de Node 24 LTS recommandée |

## 2. Ce qui a été livré

- **Écran « Plan with AI »** (onglet Sprints d'un projet → bouton *Plan with AI*, réservé au manager d'un projet non archivé) :
  - étape 1 : cahier des charges collé et/ou fichier (5 Mo max), date du premier sprint, durée des sprints, capacité en story points ; l'écran indique l'analyseur utilisé (« local » : le document reste sur nos serveurs, ou « OpenAI <modèle> » : le document est envoyé à OpenAI) ;
  - étape 2 : relecture — un bloc par sprint (nom, dates, objectif modifiables ; points / capacité), puis le backlog ; chaque tâche peut être modifiée (titre, description, type, priorité, points, compétences), déplacée vers un autre sprint ou le backlog, ou supprimée ; ajout / retrait de sprints ; *Apply the plan* crée tout d'un coup.
- **Service IA** : OpenAI (sorties structurées) ou, sans clé ou en cas d'échec, l'**analyseur local** (règles + classifieur Naive Bayes, accuracy 0,916 en validation croisée sur un jeu synthétique — chiffre optimiste) ; découpage en sprints selon la priorité et la capacité.
- **Backend** : deux routes (`POST /projects/:id/ai/plan`, `POST /projects/:id/ai/plan/apply`), validation stricte de la réponse de l'IA, création tout ou rien, entrée d'historique `AI_PLAN_APPLIED`.

## 3. Nouveaux fichiers (insertions)

### Agent 1 — service IA et backend (commit `a8470b0`)

| Fichier | Lignes | Rôle |
|---|---|---|
| `ai-service/app/ml/data/task_types.csv` | 156 | Jeu de données : 155 phrases FR/EN étiquetées avec les 7 types de tâche |
| `ai-service/app/ml/lexicon.py` | 49 | Racines de mots-indices par type, mots vides |
| `ai-service/app/ml/text_classifier.py` | 146 | Naive Bayes multinomial en Python pur + validation croisée |
| `ai-service/app/ml/task_type_model.py` | 84 | Entraînement, métriques, sauvegarde / chargement du modèle |
| `ai-service/app/prompts/project_plan.py` | 96 | Prompt système, prompt utilisateur, schéma JSON d'OpenAI |
| `ai-service/app/routes/planning.py` | 39 | `POST /api/v1/ai/documents/extract`, `POST /api/v1/ai/projects/plan` |
| `ai-service/app/schemas/common.py`, `documents.py`, `llm.py`, `planning.py` | 21 + 9 + 34 + 98 | Modèles Pydantic (énumérations, limites, requête / réponse, réponse du LLM) |
| `ai-service/app/services/text_extraction.py` | 125 | Texte des fichiers .txt / .md / .pdf / .docx |
| `ai-service/app/services/requirement_parser.py` | 603 | Analyseur local 1 : exigences, épopées, MoSCoW, points, jours |
| `ai-service/app/services/task_enricher.py` | 212 | Analyseur local 2 : type (ML), priorité, points, compétences |
| `ai-service/app/services/sprint_planner.py` | 97 | Répartition en sprints (priorité, capacité, 20 sprints max) |
| `ai-service/app/services/llm_client.py` | 113 | Client OpenAI, erreurs → repli sur l'analyseur local |
| `ai-service/app/services/planning_service.py` | 141 | Orchestration hybride |
| `ai-service/tests/` (8 fichiers) | 804 | Tests pytest (documents en mémoire, OpenAI simulé) |
| `backend/src/middleware/upload.js` | 55 | multer : un fichier en mémoire, 5 Mo, extensions autorisées |
| `backend/src/validators/aiPlan.validator.js` | 89 | Règles de validation et `PLAN_LIMITS` |
| `backend/src/services/aiPlan.service.js` | 290 | Génération (extraction + plan + validation) et application tout ou rien |
| `backend/src/controllers/aiPlan.controller.js` | 25 | Contrôleur des deux routes |
| `backend/tests/aiPlan.test.js` | 343 | Tests Jest / Supertest |
| `docs/handoff.md` | 87 | Passation vers l'agent 2 |

### Agent 2 — interface Angular et livrables (non commité)

| Fichier | Lignes | Rôle |
|---|---|---|
| `frontend/src/app/core/models/ai-plan.ts` | 81 | Interfaces du plan, `PLAN_LIMITS` partagées avec le backend |
| `frontend/src/app/features/ai-plan/ai-plan.service.ts` | 41 | `AiPlanService` : `generate` (FormData), `apply` (JSON) |
| `frontend/src/app/features/ai-plan/ai-plan-page/ai-plan-page.ts` | 452 | Page en deux étapes : formulaire, relecture (FormArray par sprint / backlog), déplacement, application |
| `frontend/src/app/features/ai-plan/ai-plan-page/ai-plan-page.html` | 376 | Gabarit (Material 3, accessible) |
| `frontend/src/app/features/ai-plan/ai-plan-page/ai-plan-page.scss` | 167 | Styles |
| `frontend/src/app/features/ai-plan/ai-plan.service.spec.ts` | 111 | 4 tests du service |
| `frontend/src/app/features/ai-plan/ai-plan-page/ai-plan-page.spec.ts` | 307 | 15 tests de la page |
| `docs/livrables/README.md`, `docs/livrables/TASK-22.md` | — | Index des livrables et ce fichier |

## 4. Fichiers modifiés

### Agent 1 (commit `a8470b0`)

| Fichier | Modification |
|---|---|
| `ai-service/app/main.py` | Ajout du routeur de planification (version 0.2.0) |
| `ai-service/requirements.txt` | scikit-learn, numpy et joblib retirés (DLL bloquées par Windows : classifieur écrit en Python pur) |
| `backend/package.json`, `package-lock.json` | Dépendance multer 2.4.0 |
| `backend/src/routes/project.routes.js` | Les deux routes AI-01 |
| `backend/src/models/activity.model.js` | Type d'activité `AI_PLAN_APPLIED` |
| `.gitignore` | `ai-service/app/ml/models/` (modèle généré) |
| `README.md`, `docs/bilan.md`, `docs/prompts.md` | État intermédiaire |

### Agent 2 (non commité)

| Fichier | Modification |
|---|---|
| `frontend/src/app/app.routes.ts` | Route enfant `projects/:id/ai-plan` (chargée à la demande) |
| `frontend/src/app/features/sprints/sprint-list/sprint-list.html`, `.scss`, `.spec.ts` | Bouton « Plan with AI » (manager), texte de la liste vide, tests |
| `frontend/src/app/core/models/activity.ts`, `activity.spec.ts` | `AI_PLAN_APPLIED` : libellé, texte « created 12 tasks in 3 sprints with the AI planner », 3 tests |
| `frontend/src/app/features/activity/activity-list/activity-list.ts` | Icône `auto_awesome` |
| `frontend/src/app/testing/test-data.ts` | `testPlan()`, `testPlanTask()` |
| `frontend/src/app/core/services/health.service.spec.ts`, `features/home/home.ts` | Formatage Prettier seulement (fichiers de la TASK 21 qui faisaient échouer `format:check`) |
| `ai-service/app/services/requirement_parser.py` | **Correction** : plusieurs marqueurs dans une même parenthèse (`(Must, 5 pts)`) — trouvée par la vérification de bout en bout |
| `ai-service/tests/test_requirement_parser.py` | Test de cette correction |
| `docs/ai.md` | Section AI-01 complète (approche, analyseur, jeu de données, modèle, métriques et réserve, planificateur, validation, limites) |
| `docs/prompts.md` | Partie B (prompt OpenAI exact, schéma, validation, erreurs, sécurité) ; partie A : prompts #25 à #27 |
| `docs/api.md` | `GET /ai/status`, les 2 routes AI-01, `AI_PLAN_APPLIED`, API du service IA (santé, extraction, plan) |
| `docs/architecture.md`, `deployment.md`, `testing.md`, `requirements.md`, `demo.md`, `database.md`, `README.md` | Structure du service IA, variables d'environnement, commandes, inventaire des tests, FR-15, étape 7 de la démo, type d'activité |
| `docs/bilan.md`, `docs/handoff.md` | Bilan mis à jour, passation vers la TASK 23 |

## 5. Preuves

| Vérification | Résultat |
|---|---|
| Frontend `npm run test:ci` | 52 fichiers, **329 tests** réussis (307 avant, +22) |
| Frontend lint / format / build | OK / OK / OK — bundle initial 344,7 kB (< 500 kB), page IA chargée à la demande |
| Backend `npm test` / lint / audit | **325 tests** réussis / 0 erreur / 0 vulnérabilité |
| Service IA `pytest` / flake8 | **103 tests** réussis / propre |
| Modèle (réentraîné) | accuracy 0,916, F1 macro 0,921 (validation croisée 5 plis) |
| Bout en bout (vrais services, analyseur local) | **17/17** — texte, .docx (nom accentué), .pdf, refus (texte court, .exe, options), développeur refusé, application refusée si invalide, application d'un plan modifié, sprints / tâches / historique vérifiés, numérotation et dates du plan suivant ; données de test supprimées |

## 6. Limites et suite

- Chemin OpenAI vérifié seulement par des tests simulés (aucune clé disponible) ; à essayer quand la clé sera dans `ai-service/.env`.
- Écran non encore parcouru par le superviseur dans un navigateur (tests de composants seulement) : nécessite Node 22.22.3+ ou 24 pour `ng serve`.
- L'analyseur local dépend de la structure du document ; ses métriques sont optimistes (données synthétiques).
- **Suite : TASK 23 — AI-02 recommandation de développeur**, au prochain « continuer ».
