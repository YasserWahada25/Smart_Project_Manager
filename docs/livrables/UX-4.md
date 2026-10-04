# Livrable — UX-4 : accueil « Mon travail » et bouton « Ask AI » global

> L'accueil n'affiche plus seulement l'état technique : il montre **le travail de la personne** (Asana / ClickUp, « My issues » de Linear) ; les managers ont un bouton **Ask AI** partout (Notion AI, ClickUp Brain). Réalisé le 4 octobre 2026. **Non commité.**

## 1. Prompts à l'origine

| # | Prompt du superviseur (cité) | Décision / effet |
|---|---|---|
| 37 | « …inspirer des differents plateforme deja existant… » | Lot UX-4 proposé : accueil « Mon travail » et IA accessible partout |
| 38 | « continuer vers les lots suivants » | Réalisé après UX-3 |

## 2. Ce qui a été livré

- **Accueil** : salutation selon l'heure (« Good morning, Sara ») et date ; **actions rapides** (recherche Ctrl+K, nouveau projet pour le manager, toutes mes tâches pour le développeur, tableau de bord) ; **chiffres clés** (tâches ouvertes, en retard, bloquées, sprints actifs — en rouge quand il y a un problème) ;
  - développeur : **« Assigned to me »**, ses tâches ouvertes, échéance la plus proche d'abord, retards en rouge ;
  - manager / administrateur : **sprints actifs** avec leur **risque de retard IA** ;
  - l'état du système (frontend, backend, base, service IA et son LLM) passe dans une colonne à droite.
- **Ask AI** (manager) : bouton flottant en bas à droite, qui propose ses projets actifs (le projet courant d'abord) et ouvre leur assistant ; masqué sur la page de l'assistant.

## 3. Fichiers

| Fichier | Rôle |
|---|---|
| `frontend/src/app/features/home/my-work/my-work.ts` (+ `.spec.ts`) | Bloc « Mon travail » (4 tests) |
| `frontend/src/app/features/home/home.ts`, `.html`, `.scss`, `home.spec.ts` | Salutation, mise en page à deux colonnes |
| `frontend/src/app/layouts/main-layout/main-layout.ts`, `.html`, `.spec.ts` | Bouton « Ask AI » et son menu (1 test) |
| `frontend/src/styles.scss`, `frontend/src/app/app.spec.ts` | Position du bouton ; salutation |

## 4. Preuves

Frontend complet : **59 fichiers, 376 tests** réussis ; lint, format, build OK (bundle initial 354,3 kB, aucun dépassement de budget).

## 5. Limites

Aucune nouvelle API : l'accueil réutilise `/dashboard` et `/tasks/assigned`. Contrôle visuel : à faire par le superviseur.
