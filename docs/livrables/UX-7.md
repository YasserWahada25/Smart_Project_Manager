# Livrable — UX-7 : panneau latéral de la tâche lisible

> Le panneau latéral (UX-3) reprenait la mise en page à deux colonnes de la page complète dans 640 px : colonne « Details » trop étroite (« Recommend a developer » et « Created by » coupés sur deux lignes), « History » réduit à une petite boîte à côté des commentaires. Réalisé le 4 octobre 2026. **Non commité.**

## 1. Prompts à l'origine

| # | Prompt du superviseur (cité) | Décision / effet |
|---|---|---|
| 47 | Capture du panneau latéral d'une tâche : « meme fixer l'affichage de cette partie » | La mise en page suit la largeur disponible (requête de conteneur), et non plus celle de l'écran |

## 2. Ce qui a été livré

- **Largeur disponible** : la page de la tâche réagit à la place dont elle dispose (`container-type: inline-size`) au lieu de la largeur de l'écran. Le même composant s'affiche donc bien en page complète et dans le panneau.
- **Étroit (panneau, petit écran — moins de 760 px)** :
  - une seule colonne ;
  - **Details en premier** (comme les propriétés dans Linear), en lignes compactes « libellé | valeur » ;
  - puis Description, Comments et History, l'un sous l'autre ;
  - l'indication « Assign the task to a developer before starting it. » passe sur sa propre ligne sous les boutons « Move to ».
- **Partout** :
  - « Recommend a developer » tient sur une ligne, aligné à gauche sous la liste « Assignee » ;
  - dates sans les secondes (« Oct 3, 2026, 1:29 PM »).
- **Page complète large** : inchangée (deux colonnes).

## 3. Fichiers

| Fichier | Rôle |
|---|---|
| `frontend/src/app/features/tasks/task-detail/task-detail.scss` | Requête de conteneur, mise en page étroite, bouton « Recommend » |
| `frontend/src/app/features/tasks/task-detail/task-detail.html` | Classe `details` de la carte, format des dates |

## 4. Preuves

Frontend : **59 fichiers, 378 tests** réussis ; lint et build OK (aucun dépassement du budget de styles).

## 5. Limites

Contrôle visuel : à faire par le superviseur (panneau depuis le tableau Kanban ou la liste des tâches, et page complète).
