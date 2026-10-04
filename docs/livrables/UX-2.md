# Livrable — UX-2 : glisser-déposer sur le Kanban et ajout rapide

> Le tableau Kanban fonctionne comme Trello / Linear : on **fait glisser** une carte vers une autre colonne, et le manager **ajoute une tâche** directement dans « To do ». Réalisé le 4 octobre 2026. **Non commité.**

## 1. Prompts à l'origine

| # | Prompt du superviseur (cité) | Décision / effet |
|---|---|---|
| 37 | « …optimiser l'experience utilisateur… inspirer des differents plateforme deja existant… » ; référence choisie : Linear | Lots UX proposés : UX-2 = glisser-déposer (Trello / Jira / Linear) |
| 38 | « continuer vers les lots suivants » | UX-2, UX-3 et UX-4 enchaînés, chacun testé |

Le prompt de contexte demandait le glisser-déposer « seulement sur demande explicite » : c'est désormais le cas (amélioration de l'expérience demandée par le superviseur).

## 2. Ce qui a été livré

- **Glisser-déposer** des cartes (Angular CDK) pour le manager et l'assigné : pendant le déplacement, les colonnes **autorisées** sont entourées, les autres **grisées** ; une carte ne peut être lâchée que sur une transition permise (« In progress » et suivantes exigent un assigné). La carte apparaît **immédiatement** dans sa nouvelle colonne, puis le changement est enregistré et le tableau rechargé ; si le backend refuse (ou si la raison du blocage est annulée), la carte revient à sa place.
- Le menu « Move to » reste disponible (alternative clavier et accessibilité).
- **« + Add task »** en bas de la colonne To do (manager) : titre puis Entrée → tâche créée avec les valeurs par défaut (Feature, Medium, 3 points) dans le sprint affiché ou le backlog ; Échap annule ; absent pour un sprint terminé ou annulé.

## 3. Fichiers

| Fichier | Modification |
|---|---|
| `frontend/src/app/features/kanban/kanban-board/kanban-board.ts` | Glisser-déposer (`canEnter`, `drop`, déplacement optimiste `moveCard`), ajout rapide |
| `…/kanban-board.html`, `…/kanban-board.scss` | Listes déposables, cartes déplaçables, aperçu, emplacement, surlignage, formulaire d'ajout |
| `…/kanban-board.spec.ts` | 7 tests de plus (déplaçable selon le rôle, colonnes autorisées, dépôt, affichage avant la réponse puis rechargement, dépôts ignorés, ajout rapide, Échap / rôles / sprint fermé) |

## 4. Preuves

Kanban : 12 tests réussis ; frontend complet en fin de lot UX-4 : 59 fichiers, 376 tests ; lint, format, build OK. **Un vrai bug trouvé par les tests et corrigé** : le formulaire d'ajout utilisait `(ngSubmit)`, qui ne se déclenche pas sans groupe de formulaire réactif.

## 5. Limites

L'ordre des cartes dans une colonne n'est pas enregistré (le tableau trie par priorité puis ancienneté, comme le backend). Contrôle visuel du glisser-déposer dans le navigateur : à faire par le superviseur.
