# Livrable — UX-1 : identité visuelle et nouvelle interface (inspirée de Linear)

> Premier lot d'amélioration de l'expérience utilisateur : l'application devient **« Smart Manager »**, aux couleurs de son logo, avec une barre latérale à la Linear, un thème clair / sombre / système et des avatars.
> Réalisé le 4 octobre 2026. Commit `abda49f`.

## 1. Prompts à l'origine

| # | Prompt du superviseur (cité) | Décision / effet |
|---|---|---|
| 37 | « maintenant je veux se concentrer sur la partie UI pour optimiser l'experience utilisateur avec notre plateforme inspirer des differents plateforme deja existant et application l'un pour notre application » | Audit de l'interface comparé à Linear, Jira, Trello, Asana / ClickUp et Notion AI ; deux questions posées |
| 37 (réponses) | Référence : **« Linear (Recommended) »** ; priorité : **« Shell and visual identity »** | Lot UX-1 ; les lots suivants (glisser-déposer, palette Ctrl+K et panneau latéral, accueil « Mon travail » et IA globale) restent à décider |
| 37 (suite) | « logo de notre appliation est C:\…\frontend\public\logo.png Intitulé "Smart Manager" » | Couleurs du thème tirées du logo (bleu, accent cyan) ; symbole « S » extrait pour la barre latérale et l'onglet du navigateur ; nom affiché « Smart Manager » |

## 2. Ce qui a été livré

| Avant | Après |
|---|---|
| Barre bleue en haut, menu fixe avec un titre « Menu » | **Barre latérale à la Linear** : logo et nom, champ de recherche (raccourci **/**), navigation (Accueil, **Inbox** avec le nombre de notifications non lues, Mes tâches, Dashboard, Projects, Users), **liste de vos projets** (carré coloré avec l'initiale, « + » pour en créer un, « All projects (N) »), compte en bas (profil, thème, déconnexion) |
| Menu toujours large | **Réductible en icônes** (bouton en haut, choix mémorisé), infobulles sur les icônes ; sur mobile : tiroir ouvert depuis une barre fine |
| Thème Material bleu par défaut, Roboto, marges larges | Couleurs du **logo** (bleu, cyan), police **Inter**, densité compacte, surfaces neutres et bordures fines |
| Thème clair uniquement | **Clair / sombre / système**, choisi dans le menu du compte, mémorisé, appliqué dès le premier affichage ; les graphiques changent aussi de palette |
| Icône générique pour les personnes | **Avatars à initiales**, une couleur stable par personne : tableau Kanban, liste des tâches, page tâche, équipe du projet, commentaires, historique, charge de travail, recommandation de développeur |
| « Smart Project Manager », icône Angular | **« Smart Manager »** : titre des onglets, page de connexion (symbole, nom aux couleurs du logo, devise « Plan · Organize · Collaborate · Achieve »), favicon tiré du logo |

## 3. Nouveaux fichiers (insertions)

| Fichier | Rôle |
|---|---|
| `frontend/src/app/core/services/theme.service.ts` (+ `.spec.ts`) | Thème clair / sombre / système, classe sur `<html>`, choix mémorisé (3 tests) |
| `frontend/src/app/shared/colors.ts` | Couleurs d'identité (8 couleurs lisibles en blanc) et initiales |
| `frontend/src/app/shared/components/avatar/avatar.ts` (+ `.spec.ts`) | Avatar à initiales, dessinées en CSS pour ne pas polluer le texte lu par les lecteurs d'écran (4 tests) |
| `frontend/public/logo-mark.png`, `favicon.ico` (remplacé) | Symbole « S » extrait du logo (128 px, 26 Ko) et favicon |
| `frontend/public/logo.png` | Logo fourni par le superviseur (original, non utilisé directement : 700 Ko et texte illisible en petit ou en thème sombre) |

## 4. Fichiers modifiés

| Fichier | Modification |
|---|---|
| `frontend/src/app/layouts/main-layout/*` | Nouvelle coquille (barre latérale, projets, compte, réduction, raccourci « / », mobile) ; tests réécrits (8 tests) |
| `frontend/src/app/layouts/auth-layout/auth-layout.ts` | Logo et devise sur les pages de connexion et d'inscription |
| `frontend/src/styles.scss`, `src/index.html`, `src/app/app.ts` | Thème (couleurs du logo, Inter, densité, jetons clair / sombre), script d'application du thème avant affichage, police Inter |
| `frontend/src/app/core/app.constants.ts`, `routing/app-title.strategy.ts`, `features/auth/register/register.html`, `app.spec.ts` | Nom « Smart Manager » |
| `features/kanban`, `tasks/task-list`, `tasks/task-detail`, `projects/project-overview`, `comments/task-comments`, `activity/activity-list`, `dashboard/workload-table`, `ai-recommendation/recommend-dialog` | Avatars |
| `features/dashboard/task-charts/task-charts.ts` | Palette des graphiques selon le thème |
| `docs/architecture.md`, `docs/prompts.md` (#29 à #37), `docs/bilan.md`, `docs/livrables/README.md` | Documentation |

## 5. Preuves

| Vérification | Résultat |
|---|---|
| `npm run test:ci` | 57 fichiers, **358 tests** réussis (+9) |
| `npm run lint` / `format:check` / `build` | OK / OK / OK — bundle initial 353,7 kB (< 500 kB), aucun dépassement de budget de style |
| Contrôle visuel dans le navigateur | **À faire par le superviseur** (aucun navigateur piloté disponible pour l'agent) : thème clair et sombre, barre réduite, mobile |

## 6. Limites et suite

- Les écrans eux-mêmes (listes, formulaires, tableaux de bord) gardent leur mise en page : seul le cadre, le thème et les avatars changent dans ce lot.
- Lots suivants proposés, dans l'ordre : **UX-2** glisser-déposer sur le Kanban et « + Ajouter une carte » ; **UX-3** palette **Ctrl+K** et tâche ouverte dans un panneau latéral ; **UX-4** accueil « Mon travail » et bouton « Ask AI » accessible partout.
