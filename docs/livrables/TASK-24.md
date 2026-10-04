# Livrable — TASK 24 : AI-03 prédiction du risque de retard d'un sprint

> Sur chaque sprint actif (onglet Sprints, tableau de bord du projet, tableau de bord général) : « Delay risk (AI): High (82 %) » et jusqu'à trois raisons chiffrées. Modèle de Machine Learning : régression logistique entraînée sur des sprints simulés.
> Réalisée le 3 octobre 2026 (13 h 25 → 13 h 40). Code commité par le superviseur dans `e822517`.

## 1. Prompts à l'origine

| # | Heure | Prompt du superviseur (cité) | Décision / effet |
|---|---|---|---|
| 1 | 02/10 11:20 | Prompt de contexte : « AI-03 Sprint delay risk prediction — input: total/completed/remaining/blocked tasks, high-complexity tasks, days remaining, team size, team velocity; output: risk level (LOW/MEDIUM/HIGH), probability, main contributing factors » ; « for a Machine Learning feature: dataset, features, model, training, evaluation metrics, persistence, endpoint » | Exigence de départ et plan de documentation (livrable 3) |
| 28 | 03/10 13:13 | « continuer vers Tasks 23-24-25 une fois pour toutes » | TASK 24 réalisée après la 23 |

## 2. Ce qui a été livré

- **Jeu de données** : 2 000 sprints **simulés** (aucun historique réel n'existe encore), générateur déterministe documenté (vélocité cachée, engagement 50–125 %, frictions dues aux tâches bloquées / complexes / non assignées, bruit aléatoire). Premier essai à 70 % de sprints en retard → engagement ramené à 50–125 % → 49,5 %.
- **Modèle** : régression logistique (7 variables, méthode de Newton) en Python pur ; **jeu de test (500 sprints) : accuracy 0,864, précision 0,875, rappel 0,847, F1 0,861, ROC AUC 0,934**, contre accuracy 0,696 / F1 0,573 pour une règle simple. Les facteurs affichés sont les contributions `w × z` du modèle. Réserve : ces chiffres mesurent l'apprentissage du simulateur, pas des projets réels. Détail : [ai.md](../ai.md) § 4.3.
- **Cas évidents par règle** : sprint vide → LOW ; tout fini → LOW ; date de fin dépassée avec des points restants → HIGH.

## 3. Nouveaux fichiers (insertions)

| Fichier | Lignes | Rôle |
|---|---|---|
| `ai-service/app/ml/sprint_features.py` | 85 | Les 7 variables (partagées par le simulateur et la prédiction) |
| `ai-service/app/ml/sprint_risk_data.py` | 128 | Simulateur / générateur du jeu de données (graine 2026) |
| `ai-service/app/ml/data/sprint_risk.csv` | 2 001 | Jeu de données (2 000 sprints) |
| `ai-service/app/ml/logistic_regression.py` | 140 | Régression logistique (IRLS), ROC AUC, métriques, découpage stratifié |
| `ai-service/app/ml/sprint_risk_model.py` | 96 | Entraînement, évaluation, comparaison à la règle, sauvegarde JSON |
| `ai-service/app/schemas/risk.py`, `services/sprint_risk.py`, `routes/risk.py` | 68 + 128 + 15 | Contrat, prédiction (niveau, facteurs, règles), `POST /api/v1/ai/sprints/predict-risk` |
| `ai-service/tests/test_sprint_risk.py` | 157 | 18 tests pytest |
| `backend/src/services/aiRisk.service.js` | 124 | Mesures du sprint, vélocité des 3 derniers sprints terminés, validation de la réponse |
| `backend/tests/aiRisk.test.js` | 144 | 10 tests Jest |
| `frontend/src/app/core/models/ai-risk.ts`, `features/ai-risk/ai-risk.service.ts` | 40 + 21 | Interfaces, service |
| `frontend/src/app/features/ai-risk/sprint-risk/sprint-risk.ts` (+ `.spec.ts`) | 118 + 101 | Indicateur `app-sprint-risk` et 5 tests |

## 4. Fichiers modifiés

| Fichier | Modification |
|---|---|
| `ai-service/app/main.py` | Routeur du risque |
| `backend/src/controllers/ai.controller.js`, `routes/sprint.routes.js` | `GET /api/v1/sprints/:id/ai/risk` |
| `frontend/.../dashboard/active-sprint-card/active-sprint-card.ts` | Indicateur sur les sprints actifs des deux tableaux de bord |
| `frontend/.../sprints/sprint-list/sprint-list.ts`, `.html` | Indicateur sur le sprint actif de l'onglet Sprints |
| `frontend/.../dashboard-pages.spec.ts`, `dashboard-widgets.spec.ts`, `sprint-list.spec.ts`, `testing/test-data.ts` | Faux service de risque, `testRisk()`, assertions |
| `docs/ai.md` (§ 4.3), `api.md`, `architecture.md`, `requirements.md` (FR-13, FR-15), `demo.md` (étape 9), `deployment.md`, `testing.md`, `README.md` | Documentation |

## 5. Preuves

| Vérification | Résultat |
|---|---|
| pytest | 135 tests (+18) ; modèle réentraîné, métriques ci-dessus |
| Jest / Vitest | backend +10 (aiRisk) ; frontend : indicateur, tableaux de bord, Sprints — tous réussis |
| Bout en bout | **11/11** : sprint en retard → HIGH avec mesures exactes et 3 raisons lisibles ; sprint dans les temps → LOW ; règles (vide, en retard sur la date) ; sprint planifié → modèle ; 409 / 404 ; données supprimées (mongosh, base `smart_project_manager` uniquement) |

## 6. Limites et suite

- Données synthétiques : remplacer par l'historique réel des sprints dès qu'il existe (mêmes variables) et réentraîner.
- Jours calendaires (week-ends non modélisés) ; seuils 0,35 / 0,65 conventionnels.
- Suite : TASK 25.
