# Livrable — TASK 23 : AI-02 recommandation de développeur

> Le manager ouvre une tâche, clique sur « Recommend a developer » : les membres actifs du projet sont classés selon leurs compétences, leur charge et leur expérience, avec un score sur 100 et une explication ; un clic sur « Assign » attribue la tâche.
> Réalisée le 3 octobre 2026 (13 h 13 → 13 h 25). Code commité par le superviseur dans `e822517` (« first steps for 23-24 tasks »).

## 1. Prompts à l'origine

| # | Heure | Prompt du superviseur (cité) | Décision / effet |
|---|---|---|---|
| 1 | 02/10 11:20 | Prompt de contexte : « AI-02 Developer recommendation — input: task required skills, developer skills, current workload, previous experience, availability (if implemented); output: recommended developer, compatibility score, matching skills, optional explanation » | Exigence de départ ; les compétences (nom, niveau, années) sont saisies depuis la TASK 05 pour cette fonction |
| 22 | 03/10 11:09 | (feuille de route réordonnée après l'idée d'AI-01) | TASK 23 = AI-02 |
| 28 | 03/10 13:13 | « continuer vers Tasks 23-24-25 une fois pour toutes » | Les trois tâches IA enchaînées ; TASK 23 en premier |

## 2. Ce qui a été livré

- **Page tâche** (manager) : bouton « Recommend a developer » → boîte de dialogue : rang, nom, poste, score /100 (barre), compétences présentes et manquantes, explication, avertissements, formule rappelée ; « Assign » (sauf pour l'assigné actuel) → tâche mise à jour, historique et notification comme une assignation manuelle.
- **Approche** : score transparent `100 × (0,60 compétences + 0,25 charge + 0,15 expérience)` — pas de modèle entraîné, faute d'historique d'assignations « réussies », et pour que le manager comprenne chaque score. Détail et exemple chiffré : [ai.md](../ai.md) § 4.2.

## 3. Nouveaux fichiers (insertions)

| Fichier | Lignes | Rôle |
|---|---|---|
| `ai-service/app/schemas/recommendation.py` | 80 | Requête / réponse (niveaux, candidats, options) |
| `ai-service/app/services/developer_scoring.py` | 176 | Score, comparaison des compétences (casse, accents, ponctuation, alias), compétences déduites du texte, explication, avertissements |
| `ai-service/app/routes/recommendation.py` | 15 | `POST /api/v1/ai/developers/recommend` |
| `ai-service/tests/test_recommendation.py` | 137 | 14 tests pytest |
| `backend/src/services/aiRecommendation.service.js` | 177 | Membres actifs, charge et expérience (agrégations MongoDB), appel IA, validation stricte de la réponse |
| `backend/tests/aiRecommendation.test.js` | 169 | 10 tests Jest |
| `frontend/src/app/core/models/ai-recommendation.ts` | 26 | Interfaces |
| `frontend/src/app/features/ai-recommendation/ai-recommendation.service.ts` | 21 | `AiRecommendationService` |
| `frontend/src/app/features/ai-recommendation/recommend-dialog/recommend-dialog.ts` (+ `.spec.ts`) | 249 + 181 | Boîte de dialogue et 5 tests |

## 4. Fichiers modifiés

| Fichier | Modification |
|---|---|
| `ai-service/app/main.py` | Routeur de recommandation |
| `backend/src/controllers/ai.controller.js`, `routes/task.routes.js` | `GET /api/v1/tasks/:id/ai/recommendations` |
| `backend/src/services/task.service.js` | Export de `findManagedTask` |
| `frontend/src/app/features/tasks/task-detail/task-detail.ts`, `.html`, `.spec.ts` | Bouton, ouverture de la boîte de dialogue, test |
| `docs/ai.md` (§ 4.2), `api.md`, `architecture.md`, `requirements.md`, `demo.md` (étape 8), `testing.md`, `README.md` | Documentation |

## 5. Preuves

| Vérification | Résultat |
|---|---|
| pytest / Jest / Vitest | IA 117 (+14), backend 335 (+10), frontend 335 (+6) — tous réussis |
| Lint, format, build | OK ; bundle initial 344,7 kB |
| Bout en bout (instance backend séparée sur le port 3001, votre backend 3000 intact) | **10/10** : classement Bob 54 > Alice 39 > Carol 25 conforme à la formule, `NodeJS` = `Node.js`, assignation puis `isAssignee`, Docker déduit du titre, 403 / 404, projet sans développeur ; données supprimées |

## 6. Limites et suite

- Poids (60/25/15) et niveaux choisis à dire d'expert, non validés sur des données réelles ; disponibilité (congés) non modélisée.
- Suite : TASK 24.
