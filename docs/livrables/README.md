# Livrables par tâche

Consigne du superviseur (prompt #25 de [prompts.md](../prompts.md)) : « a chaque fois j'ai besoins des livrables ces livreable est composer des differents nouveau insertion ou modif et bien sur les propts discours entre nous qui nous amene a ces nouveau features et chaqu'un a son place ».

Chaque tâche terminée a donc **son propre fichier**, toujours avec les mêmes sections, chacune à sa place :

| Section | Contenu |
|---|---|
| 1. Prompts à l'origine | Les messages du superviseur qui ont conduit à la fonctionnalité, cités mot pour mot (heure de Tunis), et la décision prise pour chacun |
| 2. Ce qui a été livré | La fonctionnalité du point de vue de l'utilisateur |
| 3. Nouveaux fichiers (insertions) | Chaque fichier ajouté, avec son rôle et sa taille |
| 4. Fichiers modifiés | Chaque fichier existant changé, avec la nature de la modification |
| 5. Preuves | Tests, lint, build, vérification de bout en bout, réellement exécutés |
| 6. Limites et suite | Ce qui n'est pas couvert et la tâche suivante |

Les fichiers ne contiennent jamais de secret (aucune valeur des `.env`).

## Index

| Tâche | Fonctionnalité | Livrable | État |
|---|---|---|---|
| TASK 01–21 | Backend, interface hors IA, service FastAPI, liaison backend ↔ IA | Résumés dans [bilan.md](../bilan.md) § 5 et prompts dans [prompts.md](../prompts.md) § A.3 (antérieurs à cette consigne) | Terminées |
| TASK 22 | AI-01 « Plan with AI » : sprints et tâches générés depuis le cahier des charges | [TASK-22.md](TASK-22.md) | Terminée |
| TASK 23 | AI-02 recommandation de développeur (score transparent compétences / charge / expérience) | [TASK-23.md](TASK-23.md) | Terminée |
| TASK 24 | AI-03 risque de retard d'un sprint (régression logistique, jeu de données simulé) | [TASK-24.md](TASK-24.md) | Terminée |
| TASK 25 | AI-04 assistant du manager (chat OpenAI avec outils, confirmation avant modification) | [TASK-25.md](TASK-25.md) | Terminée |
| UX-1 | Identité visuelle « Smart Manager » (couleurs du logo), barre latérale à la Linear, thème clair / sombre / système, avatars | [UX-1.md](UX-1.md) | Terminé |
| UX-2 | Glisser-déposer sur le Kanban et « + Add task » | [UX-2.md](UX-2.md) | Terminé |
| UX-3 | Palette de commandes Ctrl+K et tâche en panneau latéral | [UX-3.md](UX-3.md) | Terminé |
| UX-4 | Accueil « Mon travail » et bouton « Ask AI » global | [UX-4.md](UX-4.md) | Terminé |
| UX-5 | Bouton « Ask AI » rond et flottant (style Gemini) | [UX-5.md](UX-5.md) | Terminé |
| FIX-1 | Conversation de l'assistant enregistrée (ne disparaît plus au changement de page) | [FIX-1.md](FIX-1.md) | Terminé |
| TASK 26 | Docker et Docker Compose | — | Prévue |
