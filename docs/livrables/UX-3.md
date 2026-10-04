# Livrable — UX-3 : palette de commandes Ctrl+K et tâche en panneau latéral

> Deux réflexes de Linear : **Ctrl+K** pour tout trouver et tout lancer, et la **tâche ouverte à droite** sans quitter le tableau ou la liste. Réalisé le 4 octobre 2026. **Non commité.**

## 1. Prompts à l'origine

| # | Prompt du superviseur (cité) | Décision / effet |
|---|---|---|
| 37 | Référence choisie : « Linear (Recommended) » | Lot UX-3 proposé : palette Ctrl+K et panneau latéral |
| 38 | « continuer vers les lots suivants » | Réalisé après UX-2 |

## 2. Ce qui a été livré

- **Palette de commandes** : **Ctrl+K** (⌘K sur Mac), **/** ou le champ de recherche de la barre latérale.
  - Actions selon le rôle (aller à…, créer un projet, profil, utilisateurs) et changement de thème ;
  - **projets** (carré coloré) ; **tâches** trouvées par la recherche globale dès 2 caractères ;
  - dans un projet : ouvrir son tableau, ses sprints et, pour le manager, **Plan with AI** et **l'assistant** ;
  - « Search everywhere for "…" » ; clavier ↑ ↓ Entrée Échap ; rôles ARIA combobox / listbox.
- **Panneau latéral** : un clic sur le titre d'une tâche (tableau Kanban, liste des tâches) ouvre la page de la tâche à droite — détails, déplacement, assignation, recommandation IA, commentaires, historique — avec « Open full page » ; **Ctrl+clic** ouvre la page complète dans un nouvel onglet ; la vue se met à jour à la fermeture.

## 3. Fichiers

| Fichier | Rôle |
|---|---|
| `frontend/src/app/features/command-palette/command-palette.ts` (+ `.spec.ts`), `command-palette.service.ts` | Palette (chargée à la demande) et 5 tests |
| `frontend/src/app/features/tasks/task-panel/task-panel.ts` | Panneau latéral et service d'ouverture |
| `frontend/src/app/features/tasks/task-detail/task-detail.ts`, `.html` | Mode « embarqué » (sans lien « All tasks ») |
| `frontend/src/app/layouts/main-layout/*` | Raccourcis Ctrl+K / ⌘K / « / », champ de recherche ouvrant la palette ; test mis à jour |
| `features/kanban/kanban-board.*`, `features/tasks/task-list/task-list.*` | Titre des tâches → panneau ; test du panneau sur le Kanban |
| `frontend/src/styles.scss` | Styles du panneau (pleine hauteur, entrée animée, mouvement réduit respecté) et de la palette |

## 4. Preuves

Frontend : 58 fichiers, 371 tests en fin de lot ; build OK. **Un vrai bug trouvé par les tests et corrigé** : `routerLink` naviguait même quand le clic ouvrait le panneau (panneau **et** page complète) ; ces liens utilisent maintenant un `href` simple.

## 5. Limites

La palette ne crée pas encore de tâche elle-même (elle mène aux écrans existants). Contrôle visuel : à faire par le superviseur.
