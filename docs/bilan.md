# Bilan du projet — Smart Project Manager

> **Point d'étape au 3 octobre 2026, fin de la TASK 22** : 22 tâches terminées sur 29. La première fonction IA, **AI-01 « Plan with AI »**, fonctionne de bout en bout : le manager colle ou dépose le cahier des charges, l'IA propose les sprints et les tâches, le manager relit, modifie puis valide la création.
> Ce document est mis à jour à la fin de chaque tâche. L'état de référence reste dans le [README](../README.md#development-progress) et les autres fichiers de `docs/`. Les prompts sont dans [prompts.md](prompts.md) (partie A) ; **le détail de chaque tâche (fichiers ajoutés / modifiés, prompts à l'origine) est dans [livrables/](livrables/README.md)**.
>
> Sources : le dépôt, les rapports rendus à la fin de chaque tâche et l'historique des échanges entre le superviseur humain et les agents IA (Claude Code).

## 1. En bref

| Élément | État |
|---|---|
| Avancement | 22 tâches sur 29 : **phases 1 à 3 terminées**, phase 4 (IA) commencée : TASK 20, 21 et 22 terminées |
| Backend Express | 52 endpoints REST, 7 collections MongoDB ; **325 tests automatisés** |
| Frontend Angular | Tous les écrans hors IA + l'écran **« Plan with AI »** ; **329 tests automatisés** |
| Service IA (Python / FastAPI) | Santé, jeton de service, AI-01 (OpenAI ou analyseur local avec un classifieur Naive Bayes) ; **103 tests automatisés** |
| Vérifications de bout en bout | Sur la vraie base : 22/22 (backend), 21/21 (TASK 14), 26/26 (TASK 15), 35/35 (TASK 16–19), **17/17 (TASK 22)** ; données de test supprimées à chaque fois |
| Docker / Compose | Pas commencé (TASK 26) |
| Git | Dépôt sur `main`. Le superviseur a commité jusqu'à `a8470b0` (« limit conversation ») ; **la fin de la TASK 22 n'est pas commitée** (à faire par le superviseur) |

## 2. Le but : les 4 livrables attendus

| Livrable | Ce qui est demandé | État au 3 octobre | Reste à faire |
|---|---|---|---|
| **1. Code source versionné** | Dépôt Git avec frontend, backend, MongoDB, service FastAPI, tests, documentation, Docker ; commits significatifs ; aucun secret | Frontend, backend, service IA, tests et docs présents ; 4 commits du superviseur ; aucun secret détecté | Commit de la fin de la TASK 22, IA (TASK 23–25), Docker (TASK 26), publication sur GitHub |
| **2. Démonstration web** | Scénario en 10 étapes dans le navigateur, avec des fonctions réelles | **Étapes 1 à 7 et 10 utilisables** ; étapes 8 et 9 (IA) pas commencées | TASK 23–24, données et scénario de démo (TASK 27) |
| **3. Prompts et modèles IA** | `ai.md` et `prompts.md` : prompts, modèles, données, métriques | `prompts.md` partie A (développement) et **partie B (prompt OpenAI d'AI-01)** ; `ai.md` : **AI-01 complet** (analyseur local, jeu de données, Naive Bayes, métriques avec réserve) | AI-02, AI-03 (modèle ML avec métriques), AI-04 |
| **4. Rapport technique** (24 chapitres) | Toutes les informations du rapport tenues à jour | `docs/` à jour à chaque tâche ; correspondance chapitre → fichier dans le README ; un livrable par tâche depuis la TASK 22 | Rédaction finale (TASK 29) |

### Scénario de démonstration (livrable 2)

| # | Étape | API | Interface |
|---|---|---|---|
| 1 | Connexion | ✅ | ✅ |
| 2 | Créer un projet | ✅ | ✅ |
| 3 | Ajouter des développeurs | ✅ | ✅ |
| 4 | Créer un sprint | ✅ | ✅ (onglet Sprints) |
| 5 | Créer et gérer des tâches | ✅ | ✅ (onglet Tasks, page tâche) |
| 6 | Utiliser le tableau Kanban | ✅ | ✅ (onglet Board) |
| 7 | Générer des tâches avec l'IA (AI-01) | ✅ | ✅ (Sprints → **Plan with AI**) |
| 8 | Recommandation d'un développeur (AI-02) | TASK 23 | TASK 23 |
| 9 | Prédire le risque de retard d'un sprint (AI-03) | TASK 24 | TASK 24 |
| 10 | Tableau de bord | ✅ | ✅ (page Dashboard, onglet Dashboard) |

## 3. Méthode de travail

- **Un prompt de contexte unique** fixe la stack, les règles, les livrables, la méthode tâche par tâche et le format de rapport (résumé dans [prompts.md](prompts.md), § A.2).
- **Rôles :** le superviseur valide chaque étape, fournit les informations et les fichiers de son environnement (`.env`) et vérifie le résultat ; l'agent inspecte, implémente, teste, documente, rapporte et s'arrête.
- **Boucle par tâche :** inspecter → implémenter → tests → vérification de bout en bout → `docs/`, ce bilan et le livrable de la tâche → tests, build, lint, audit → recherche de secrets → rapport → arrêt.
- **Conventions ajoutées en cours de route :**
  - « continuer » lance la tâche suivante ; une consigne de groupe enchaîne les tâches jusqu'au point d'arrêt.
  - Le bilan est mis à jour après chaque tâche ; `prompts.md` (partie A) garde tous les prompts ; **depuis la TASK 22, un fichier par tâche dans [livrables/](livrables/README.md)** (prompt #25).
  - Base MongoDB partagée : base dédiée `smart_project_manager`, comptes de test `@smoke.test` supprimés après chaque vérification, autres bases jamais touchées.
  - Changement d'agent : [handoff.md](handoff.md) donne les règles, l'état exact et la suite (utilisé avec succès entre les prompts #24 et #25).
- **Rien n'est fait à la place du superviseur :** aucun commit (le superviseur commite lui-même), aucun `.env` créé ni affiché, aucun compte administrateur réel, aucun outil hors de la stack imposée.

## 4. Historique des échanges (résumé)

27 prompts du 2 au 3 octobre 2026. La liste complète, citée mot pour mot avec les heures, est dans [prompts.md](prompts.md) (§ A.3).

| Période | Prompts | Résultat |
|---|---|---|
| 02/10 11:20 | Prompt de contexte | « PROJECT CONTEXT UNDERSTOOD » |
| 02/10 11:21 → 12:21 | « continuer », « continuer vers task 02 », capture de MongoDB Compass, « task 03 », « task 040 », « task 05 », puis « toute la partie backend » | Phases 1 et 2 : TASK 01 à 11, 295 tests, 22/22 vérifications |
| 02/10 12:58 → 15:55 | « continuer », « pouvez vous continuer » (après la limite de session), « continuer et bien lister les tasks restants » | TASK 12 et 13 : socle Angular et authentification |
| 02/10 15:57 → 16:10 | « à quelle étape… », captures du navigateur, « bilan complet… » | Guide de test, première validation dans le navigateur, création de ce bilan |
| 02/10 16:37 → 17:07 | « python est bien installé… bilan à chaque fois », « oui continuer » | TASK 14 et 15 : profil, administration, projets et équipes |
| 02/10 17:26 → 03/10 10:37 | « continuer les tasks… sans IA », « arrête à la partie IA… bilan », « remplir prompts.md » | TASK 16 à 19 ; arrêt avant l'IA ; `prompts.md` |
| 03/10 11:09 → 12:01 | Idée d'AI-01 (cahier des charges → sprints), idée du chat (AI-04), limite hebdomadaire de l'agent | Choix du superviseur : hybride, OpenAI, texte + fichiers, relecture puis validation ; TASK 20 et 21 ; TASK 22 côté service IA et backend ; [handoff.md](handoff.md) |
| 03/10 ≈ 12:20 → 12:50 | Reprise par un nouvel agent (« Tu reprends le projet… »), demande de livrables par tâche, « attend je vus ajoute les env », erreur `ng serve` (version de Node) | Fin de la TASK 22 : écran Angular, 17/17 de bout en bout, correction de l'analyseur, documentation, [livrables/](livrables/README.md) |

### Ce que montre cet échange

- **Des prompts très courts suffisent après le contexte** : chaque rapport indique la tâche suivante.
- **Le superviseur pilote la méthode et le produit** : phases entières, bilan après chaque tâche, arrêt avant l'IA, puis de nouvelles fonctions IA proposées par lui-même (AI-01 depuis le cahier des charges, AI-04 chat).
- **Les décisions qui engagent le produit sont posées en questions** : pour AI-01, quatre questions (méthode, fournisseur, format, validation) avant d'écrire le code.
- **La passation entre agents fonctionne** : le second agent a repris exactement là où le premier s'était arrêté, grâce à `handoff.md`.
- **L'agent n'interprète pas une réponse vague comme une autorisation** : « oui continuer » n'est pas un accord de commit ; « attend je vus ajoute les env » a été respecté.
- **Les vérifications automatiques trouvent de vrais problèmes avant le superviseur :**
  - boucle de redirection infinie (TASK 13) ;
  - erreurs affichées sur un formulaire vidé après un succès (TASK 14) ;
  - bundle initial au-delà de 500 kB, réduit à 342 kB (TASK 15) ;
  - notifications d'un projet supprimé conservées (relevé en TASK 15, corrigé en TASK 18) ;
  - **`(Must, 5 pts)` mal lu par l'analyseur local** (« (Must » restait dans le titre, priorité MEDIUM au lieu de HIGH) : trouvé par la vérification de bout en bout de la TASK 22 et corrigé.

## 5. Bilan des tâches réalisées

### Phases 1 et 2 — Backend (TASK 01 à 11)

| Tâches | Contenu | Preuves |
|---|---|---|
| 01–05 | Dépôt et documentation ; Express en couches, MongoDB, santé, erreurs ; authentification JWT ; administration des utilisateurs ; profil, mot de passe, compétences | 24 → 148 tests |
| 06–11 | Projets et équipes, annuaire des développeurs ; sprints (un seul actif) ; tâches, workflow, Kanban ; commentaires et historique (16 types) ; notifications (90 jours) ; tableaux de bord et recherche | 295 tests, couverture 99 % des lignes, 22/22 vérifications |

### Phase 3 — Interface Angular (TASK 12 à 19)

| Tâche | Contenu | Preuves | Point notable |
|---|---|---|---|
| 12 | Socle Angular 22, Material 3, proxy, erreurs HTTP, mise en page, état du système | 23 tests | Session interrompue puis reprise sans perte |
| 13 | Connexion, inscription, gardes, expiration de session | 90 tests ; validé dans le navigateur | Boucle de redirection corrigée |
| 14 | Mon profil (infos, compétences, mot de passe) ; administration des utilisateurs | 143 tests ; 21/21 | Changement de mot de passe : l'onglet courant reste connecté |
| 15 | Projets (liste, formulaire, page, statuts, suppression) ; équipe et annuaire filtré par compétence | 194 tests ; 26/26 | Bundle initial 500,8 → 341,6 kB |
| 16 | Page projet à onglets ; sprints ; tâches ; « Mes tâches » | 240 tests | Règles du workflow partagées (`TaskWorkflow`) |
| 17 | Tableau Kanban : 6 colonnes, déplacement par menu | 245 tests | Pas de glisser-déposer (non demandé) |
| 18 | Commentaires, historique, notifications ; **correction backend** (notifications d'un projet supprimé) | 283 tests ; backend 296 | Badge rafraîchi toutes les 60 s |
| 19 | Tableau de bord par rôle, tableau de bord du projet (Chart.js), recherche globale | 307 tests ; 35/35 (TASK 16–19) | Graphiques validés avec le vérificateur de palette |

### Phase 4 — Service IA (TASK 20 à 22)

| Tâche | Contenu | Preuves | Point notable |
|---|---|---|---|
| 20 | Service FastAPI : configuration validée, jeton `X-AI-Service-Token` (comparaison à temps constant), format d'erreur identique au backend, `GET /api/v1/health` | 6 tests pytest | Ne lit jamais MongoDB |
| 21 | Client IA du backend (délais, erreurs 503 / 504 / 400 / 502), `GET /api/v1/ai/status`, ligne « AI service » sur la page d'accueil | backend 306 tests | Le navigateur n'appelle jamais le service IA |
| **22** | **AI-01 « Plan with AI »** : texte collé et/ou fichier (.txt, .md, .pdf, .docx) → OpenAI (sorties structurées) ou analyseur local (règles + Naive Bayes) → sprints selon la priorité et la capacité → relecture et modification par le manager → création tout ou rien + historique | IA 103, backend 325, frontend 329 tests ; **17/17** de bout en bout | Deux agents (passation par `handoff.md`) ; bug de l'analyseur trouvé et corrigé ; [livrable](livrables/TASK-22.md) |

**Modèle ML d'AI-01** (détail dans [ai.md](ai.md) § 4.1) : classifieur du type de tâche (7 classes), 155 phrases FR/EN écrites à la main (jeu synthétique), mots + indices lexicaux, Naive Bayes multinomial écrit en Python pur (scikit-learn bloqué par Windows sur le premier poste). Validation croisée stratifiée à 5 plis : **accuracy 0,916, F1 macro 0,921** — chiffres **optimistes** (données synthétiques, lexique écrit en les regardant ; avec les mots seuls, environ 0,48). Le manager relit chaque type avant la création.

### Évolution du nombre de tests automatisés

| Après | 02 | 05 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 21 | 22 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Backend | 24 | 148 | 295 | 295 | 295 | 295 | 295 | 295 | 295 | 296 | 296 | 306 | 325 |
| Frontend | — | — | — | 23 | 90 | 143 | 194 | 240 | 245 | 283 | 307 | 307 | 329 |
| Service IA | — | — | — | — | — | — | — | — | — | — | — | 6 | 103 |

À chaque tâche : lint, formatage, build de production et `npm audit --omit=dev` (0 vulnérabilité) ; flake8 pour le service IA.

## 6. Exigences fonctionnelles

| Exigence | Module | API | Interface |
|---|---|---|---|
| FR-01 à FR-04 | Authentification, utilisateurs, profils, compétences | ✅ | ✅ |
| FR-05, FR-06 | Projets, équipes | ✅ | ✅ |
| FR-07, FR-08 | Sprints, tâches | ✅ | ✅ (+ création par l'IA) |
| FR-09 | Kanban | ✅ | ✅ |
| FR-10 à FR-12 | Commentaires, historique, notifications | ✅ | ✅ |
| FR-13 | Tableau de bord | ✅ | ✅ (indicateurs de risque IA avec AI-03) |
| FR-14 | Recherche et filtres | ✅ | ✅ |
| FR-15 | Fonctions IA | AI-01 ✅ ; AI-02 à AI-04 : TASK 23–25 | AI-01 ✅ ; TASK 23–25 |

## 7. Ce qu'il reste à faire : 7 tâches

### Phase 4 — Service IA (suite)

| Tâche | Contenu | État |
|---|---|---|
| 20 | Mise en place de FastAPI | Terminée |
| 21 | Liaison backend ↔ service IA | Terminée |
| 22 | AI-01 : planification depuis le cahier des charges | **Terminée** |
| **23** | **AI-02 : recommandation de développeur** selon les compétences demandées par la tâche, le niveau, la charge actuelle et l'expérience ; score de compatibilité et explication ; bouton sur la page tâche | **Prochaine** |
| 24 | AI-03 : prédiction du risque de retard d'un sprint (jeu de données, modèle ML, métriques, écran, indicateur sur les tableaux de bord) | Prévue |
| 25 | **AI-04 : assistant du manager (chat)**, voir ci-dessous | Prévue |

#### TASK 25 — Assistant du manager (chat), plan

Idée du superviseur (prompt #23) : un chat dans l'application qui discute avec le manager et modifie la plateforme à sa demande (ajouter, modifier, corriger).

- **Ce qu'il pourra faire :** répondre sur le projet (avancement, tâches en retard ou bloquées, charge, résumé d'un sprint) ; **proposer des modifications** (créer, modifier ou déplacer des tâches et des sprints, assigner, changer une priorité ou une estimation) ; utiliser les autres fonctions IA (AI-01, AI-02, AI-03).
- **Fonctionnement :** Angular (panneau de chat) → Express → service IA, qui appelle OpenAI avec une liste d'**outils** (function calling). Le service IA ne touche jamais MongoDB : le backend exécute l'outil avec **les droits du manager connecté** et la validation existante. Les lectures sont immédiates ; **chaque modification est d'abord présentée au manager** et n'est appliquée qu'après « Confirmer ». Chaque action appliquée est inscrite dans l'historique.
- **Sécurité :** aucune suppression sans confirmation ; nombre d'appels d'outils limité ; le texte des tâches et des commentaires est traité comme des données (protection contre l'injection de prompt) ; la clé OpenAI reste dans `ai-service/.env`.
- **Limites assumées :** le chat agit sur les **données** de la plateforme, **pas sur le code source** ; il exige une clé OpenAI (sans clé, le panneau indique que l'assistant est indisponible).

### Phase 5 — Livraison

| Tâche | Contenu |
|---|---|
| 26 | Docker et Docker Compose (Docker Desktop doit être démarré) |
| 27 | Données de démonstration et scénario de démo détaillé |
| 28 | Sécurité (limitation des tentatives de connexion…) et intégration continue GitHub Actions |
| 29 | Documentation finale et rapport technique |

## 8. Points ouverts

### Décisions prises par l'agent, à confirmer ou changer

| Décision | Raison | Alternative possible |
|---|---|---|
| Inscription libre en développeur ou chef de projet ; admin créé par commande | La démo fonctionne tout de suite | Inscription en développeur seulement |
| Interface et documentation en anglais (bilan, prompts et livrables en français) | Le prompt de contexte est en anglais | Traduire l'interface |
| Token de session dans `localStorage` | Session conservée au rechargement ; risque XSS atténué et documenté | Cookie httpOnly + protection CSRF |
| Complexité en story points (1, 2, 3, 5, 8, 13) | Pratique Scrum ; utile pour AI-01 et AI-03 | Échelle libre |
| Kanban sans glisser-déposer (menu « Move to ») | Le glisser-déposer seulement sur demande explicite | CDK drag-drop |
| « Plan with AI » : page dédiée ouverte depuis l'onglet Sprints (pas d'onglet en plus) | Réservée au manager ; garde les six onglets communs à tous | Onglet « AI plan » |
| L'épopée d'une tâche sert à la relecture et à l'objectif du sprint, sans être stockée | Pas de champ « epic » dans le modèle de tâche | Ajouter un champ ou des étiquettes |
| Sprints créés par l'IA en PLANNED, tâches en TODO non assignées | Le manager garde la main ; l'assignation viendra avec AI-02 | Assignation automatique |

### À fournir par le superviseur

- **Commiter la fin de la TASK 22** (fichiers listés dans [livrables/TASK-22.md](livrables/TASK-22.md)), ou me le demander explicitement.
- **Installer Node.js 24 LTS** (ou ≥ 22.22.3) : Angular 22 refuse le Node 22.21.1 de ce poste, donc `ng serve` ne démarre pas.
- **Une clé OpenAI** dans `ai-service/.env` (`OPENAI_API_KEY`) pour essayer le chemin LLM d'AI-01 (et pour AI-04) ; sans clé, l'analyseur local fonctionne.
- **Docker Desktop** démarré avant la TASK 26 ; **le dépôt GitHub** ; `ADMIN_EMAIL` / `ADMIN_PASSWORD` pour `npm run create-admin`.

### Limites connues

- Les écrans des TASK 14 à 22 ont été vérifiés par les tests automatiques et par des appels HTTP, **pas encore parcourus par le superviseur dans le navigateur**.
- Le chemin OpenAI d'AI-01 n'est couvert que par des tests simulés (aucune clé disponible).
- L'analyseur local dépend de la structure du document ; les métriques du classifieur sont optimistes (données synthétiques).
- Pas de limitation des tentatives de connexion (TASK 28) ; arrêt propre du serveur non testé sous Windows (TASK 26).
- Les dates d'un sprint ne sont pas contrôlées par rapport à celles du projet ; pas de « mot de passe oublié » ; couverture de code du frontend non mesurée.

## 9. Prochaines étapes recommandées

1. **Commiter** la fin de la TASK 22.
2. **Installer Node 24 LTS**, puis parcourir dans le navigateur : projet → Sprints → **Plan with AI** → coller l'exemple de [demo.md](demo.md) (étape 7) → relire → appliquer.
3. Quand vous le déciderez : **TASK 23 — AI-02 recommandation de développeur** (« continuer »).
