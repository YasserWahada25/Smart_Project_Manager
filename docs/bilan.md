# Bilan du projet — Smart Project Manager

> **Point d'étape au 3 octobre 2026, 12 h, au milieu de la TASK 22** : 21 tâches terminées sur 29 (TASK 20 et 21 : service FastAPI et liaison avec le backend). La TASK 22 (AI-01, planification des sprints et des tâches depuis le cahier des charges) est faite côté service IA (102 tests) et backend (325 tests au total) ; restent l'écran Angular, la vérification de bout en bout et la documentation. Le travail s'est arrêté à cause de la limite d'utilisation de l'agent : **la reprise est décrite dans [handoff.md](handoff.md)**.
>
> Les sections ci-dessous datent de la TASK 19, sauf le § 7 (plan revu). Elles seront mises à jour à la fin de la TASK 22.
> Ce document est mis à jour à la fin de chaque tâche. L'état de référence reste dans le [README](../README.md#development-progress) et les autres fichiers de `docs/`. La liste détaillée des prompts est dans [prompts.md](prompts.md) (partie A).
>
> Sources : le dépôt, les rapports rendus à la fin de chaque tâche et l'historique des échanges entre le superviseur humain et l'agent IA (Claude Code).

## 1. En bref

| Élément | État |
|---|---|
| Avancement | 19 tâches sur 29 : **phases 1, 2 et 3 terminées** (backend et interface de toutes les fonctionnalités hors IA) |
| Backend Express | 49 endpoints REST, 7 collections MongoDB ; **296 tests automatisés** |
| Frontend Angular | Tous les écrans hors IA : authentification, profil, administration, projets et équipes, sprints, tâches, Kanban, commentaires, historique, notifications, tableaux de bord avec graphiques, recherche ; **307 tests automatisés** |
| Vérifications de bout en bout | Sur la vraie base via le proxy : 22/22 (backend), 21/21 (TASK 14), 26/26 (TASK 15), 35/35 (TASK 16–19) ; données de test supprimées à chaque fois |
| Service IA (Python / FastAPI) | Pas commencé (phase 4). Python 3.14.8 est installé |
| Docker / Compose | Pas commencé : Docker Desktop n'est pas démarré |
| Git | Dépôt sur `main`, **toujours aucun commit** |

## 2. Le but : les 4 livrables attendus

| Livrable | Ce qui est demandé | État au 3 octobre | Reste à faire |
|---|---|---|---|
| **1. Code source versionné** | Dépôt Git avec frontend, backend, MongoDB, service FastAPI, tests, documentation, Docker ; commits significatifs ; aucun secret | Frontend, backend, tests et docs présents ; aucun secret détecté. **Aucun commit.** | Commits (urgent), service IA (TASK 20–25), Docker (TASK 26), publication sur GitHub |
| **2. Démonstration web** | Scénario en 10 étapes dans le navigateur, avec des fonctions réelles | **Étapes 1 à 6 et 10 utilisables dans l'interface** ; étapes 7 à 9 (IA) pas commencées | IA (TASK 22–24), données et scénario de démo (TASK 27) |
| **3. Prompts et modèles IA** | `ai.md` et `prompts.md` : prompts, modèles, données, métriques | `prompts.md` partie A rédigée (prompts de développement) ; partie B (prompts LLM) et `ai.md` (modèles) attendent les fonctions IA | TASK 22–24 |
| **4. Rapport technique** (24 chapitres) | Toutes les informations du rapport tenues à jour | `docs/` à jour à chaque tâche ; correspondance chapitre → fichier dans le README | Rédaction finale (TASK 29) |

### Scénario de démonstration (livrable 2)

| # | Étape | API | Interface |
|---|---|---|---|
| 1 | Connexion | ✅ | ✅ |
| 2 | Créer un projet | ✅ | ✅ |
| 3 | Ajouter des développeurs | ✅ | ✅ |
| 4 | Créer un sprint | ✅ | ✅ (onglet Sprints) |
| 5 | Créer et gérer des tâches | ✅ | ✅ (onglet Tasks, page tâche) |
| 6 | Utiliser le tableau Kanban | ✅ | ✅ (onglet Board) |
| 7 | Générer des tâches avec l'IA (AI-01) | TASK 24 | TASK 24 |
| 8 | Recommandation d'un développeur (AI-02) | TASK 23 | TASK 23 |
| 9 | Prédire le risque de retard d'un sprint (AI-03) | TASK 22 | TASK 22 |
| 10 | Tableau de bord | ✅ | ✅ (page Dashboard, onglet Dashboard) |

## 3. Méthode de travail

- **Un prompt de contexte unique** fixe la stack, les règles, les livrables, la méthode tâche par tâche et le format de rapport (résumé dans [prompts.md](prompts.md), § A.2).
- **Rôles :** le superviseur valide chaque étape, fournit les informations sur son environnement et vérifie le résultat ; l'agent inspecte, implémente, teste, documente, rapporte et s'arrête.
- **Boucle par tâche :** inspecter → implémenter → tests → `docs/` et ce bilan → tests, build, lint, audit → recherche de secrets → rapport → arrêt.
- **Conventions ajoutées en cours de route :**
  - « continuer » lance la tâche suivante ; une consigne de groupe (« toute la phase backend », « tous les tasks hors IA ») enchaîne les tâches jusqu'au point d'arrêt.
  - Le bilan est mis à jour après chaque tâche ; `prompts.md` (partie A) résume les prompts au point d'arrêt.
  - Base MongoDB partagée : base dédiée `smart_project_manager`, comptes de test `@smoke.test` supprimés après chaque vérification, autres bases jamais touchées.
- **Rien n'est fait à la place du superviseur :** aucun commit (à demander explicitement), aucun compte administrateur réel, aucun outil hors de la stack imposée (Chart.js était autorisé par le prompt de contexte).

## 4. Historique des échanges (résumé)

21 prompts du 2 au 3 octobre 2026. La liste complète, citée mot pour mot avec les heures, est dans [prompts.md](prompts.md) (§ A.3).

| Période | Prompts | Résultat |
|---|---|---|
| 02/10 11:20 | Prompt de contexte | « PROJECT CONTEXT UNDERSTOOD » |
| 02/10 11:21 → 12:21 | « continuer », « continuer vers task 02 », capture de MongoDB Compass, « task 03 », « task 040 », « task 05 », puis « toute la partie backend » | Phases 1 et 2 : TASK 01 à 11, 295 tests, 22/22 vérifications |
| 02/10 12:58 → 15:55 | « continuer », « pouvez vous continuer » (après la limite de session), « continuer et bien lister les tasks restants » | TASK 12 et 13 : socle Angular et authentification |
| 02/10 15:57 → 16:10 | « à quelle étape… », captures du navigateur, « bilan complet… » | Guide de test, première validation dans le navigateur, création de ce bilan |
| 02/10 16:37 → 17:07 | « python est bien installé… bilan à chaque fois », « oui continuer » | TASK 14 et 15 : profil, administration, projets et équipes |
| 02/10 17:26 → 03/10 10:37 | « continuer les tasks… sans IA », « arrête à la partie IA… bilan », « remplir prompts.md » | TASK 16 à 19 : sprints, tâches, Kanban, commentaires, historique, notifications, tableaux de bord, recherche ; arrêt avant l'IA ; `prompts.md` |

### Ce que montre cet échange

- **Des prompts très courts suffisent après le contexte** : chaque rapport indique la tâche suivante, donc « continuer » est sans ambiguïté.
- **Le superviseur pilote la méthode** : il a demandé des phases entières, un bilan après chaque tâche, un arrêt avant l'IA et le résumé des prompts.
- **L'agent n'interprète pas une réponse vague comme une autorisation** : « oui continuer » a lancé la tâche suivante, pas le commit proposé.
- **Les vérifications automatiques ont trouvé de vrais problèmes avant le superviseur :**
  - boucle de redirection infinie (TASK 13) ;
  - erreurs affichées sur un formulaire vidé après un succès (TASK 14) ;
  - bundle initial au-delà de 500 kB, réduit à 342 kB (TASK 15) ;
  - notifications d'un projet supprimé conservées (relevé en TASK 15, corrigé en TASK 18).

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
| 16 | Page projet à onglets ; sprints (cycle de vie, progression) ; tâches (filtres, formulaire, page tâche, assignation, workflow) ; « Mes tâches » | 240 tests | Règles du workflow partagées (`TaskWorkflow`) |
| 17 | Tableau Kanban : 6 colonnes, déplacement par menu (transitions autorisées), sprint actif par défaut | 245 tests | Pas de glisser-déposer (non demandé) |
| 18 | Commentaires, historique (tâche et projet), notifications (badge, page) ; **correction backend** : un projet supprimé emporte ses notifications | 283 tests ; backend 296 | Badge rafraîchi toutes les 60 s |
| 19 | Tableau de bord par rôle, tableau de bord du projet (Chart.js), recherche globale | 307 tests ; 35/35 (TASK 16–19) | Graphiques validés avec le vérificateur de palette (contraste, une seule teinte) |

### Évolution du nombre de tests automatisés

| Après | 02 | 05 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Backend | 24 | 148 | 295 | 295 | 295 | 295 | 295 | 295 | 295 | 296 | 296 |
| Frontend | — | — | — | 23 | 90 | 143 | 194 | 240 | 245 | 283 | 307 |

À chaque tâche : lint, formatage, build de production et `npm audit --omit=dev` (0 vulnérabilité).

## 6. Exigences fonctionnelles

| Exigence | Module | API | Interface |
|---|---|---|---|
| FR-01 à FR-04 | Authentification, utilisateurs, profils, compétences | ✅ | ✅ |
| FR-05, FR-06 | Projets, équipes | ✅ | ✅ |
| FR-07, FR-08 | Sprints, tâches | ✅ | ✅ |
| FR-09 | Kanban | ✅ | ✅ |
| FR-10 à FR-12 | Commentaires, historique, notifications | ✅ | ✅ |
| FR-13 | Tableau de bord | ✅ | ✅ (indicateurs de risque IA avec AI-03) |
| FR-14 | Recherche et filtres | ✅ | ✅ |
| FR-15 | Fonctions IA | TASK 20–24 | TASK 22–24 |

## 7. Ce qu'il reste à faire : 10 tâches

### Phase 4 — Service IA (Python + FastAPI) — point d'arrêt actuel

| Tâche | Contenu |
|---|---|
Ordre revu le 3 octobre (prompts #22 et #23 de [prompts.md](prompts.md)).

| Tâche | Contenu | État |
|---|---|---|
| 20 | Mise en place de FastAPI : structure, endpoint de santé, jeton de service, Pydantic, tests pytest | Terminée |
| 21 | Liaison backend ↔ service IA : client HTTP, délais d'attente, gestion des erreurs, état de l'IA dans l'interface | Terminée |
| **22** | **AI-01 : planification depuis le cahier des charges.** Le manager colle le texte ou dépose un fichier (.txt, .md, .pdf, .docx) ; OpenAI (ou, sans clé ou en cas d'échec, l'analyseur local : règles + classifieur Naive Bayes) en tire les tâches (type, priorité, story points, compétences) ; le service répartit les tâches en sprints selon la capacité ; le manager relit, modifie, puis valide la création | En cours : service IA et API backend terminés et testés ; reste l'écran Angular, la vérification de bout en bout et la documentation ([handoff.md](handoff.md) § 3) |
| 23 | AI-02 : recommandation de développeur selon les compétences et la charge | Prévue |
| 24 | AI-03 : prédiction du risque de retard d'un sprint (dataset, modèle ML, métriques, écran) | Prévue |
| 25 | **AI-04 : assistant du manager (chat)**, voir ci-dessous | Prévue |

#### TASK 25 — Assistant du manager (chat), plan

Idée du superviseur (prompt #23) : un chat dans l'application qui discute avec le manager et modifie la plateforme à sa demande (ajouter, modifier, corriger).

- **Ce qu'il pourra faire :**
  - répondre sur le projet (avancement, tâches en retard ou bloquées, charge de l'équipe, résumé d'un sprint) ;
  - **proposer des modifications** : créer, modifier ou déplacer des tâches et des sprints, assigner un développeur, changer une priorité ou une estimation ;
  - utiliser les autres fonctions IA (planification AI-01, recommandation AI-02, risque AI-03).
- **Fonctionnement :**
  1. Angular (panneau de chat) envoie le message au backend Express.
  2. Express le transmet au service IA, qui appelle OpenAI avec une liste d'**outils** (function calling).
  3. Le modèle choisit un outil. Le service IA ne touche jamais MongoDB : c'est le backend qui exécute l'outil, avec **les droits du manager connecté** (seulement ses projets) et la validation existante.
  4. Les lectures sont exécutées tout de suite. **Chaque modification est d'abord présentée au manager** (« créer la tâche X dans le sprint 2 ? ») et n'est appliquée qu'après son clic sur « Confirmer ».
  5. Chaque action appliquée est inscrite dans l'historique du projet.
- **Sécurité :**
  - aucune suppression sans confirmation ;
  - nombre d'appels d'outils limité par message ;
  - le texte des tâches et des commentaires est traité comme des données, jamais comme des instructions (protection contre l'injection de prompt) ;
  - la clé OpenAI reste dans `ai-service/.env`.
- **Limites assumées :**
  - le chat agit sur les **données** de la plateforme (projets, sprints, tâches, assignations), **pas sur le code source** de l'application : modifier le code en production serait dangereux et hors du périmètre du projet ;
  - il exige une clé OpenAI : sans clé, le panneau indique que l'assistant est indisponible (les autres fonctions IA gardent leur analyseur local).

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
| Interface et documentation en anglais (bilan et prompts en français) | Le prompt de contexte est en anglais | Traduire l'interface |
| Token de session dans `localStorage` | Session conservée au rechargement ; risque XSS atténué et documenté | Cookie httpOnly + protection CSRF |
| Complexité en story points (1, 2, 3, 5, 8, 13) | Pratique Scrum ; utile pour AI-03 | Échelle libre |
| Page projet à onglets (vue d'ensemble, sprints, tâches, tableau, activité, tableau de bord) | Une URL par vue, permissions calculées une seule fois | Une seule longue page |
| Kanban sans glisser-déposer (menu « Move to ») | Le prompt de contexte demande le glisser-déposer seulement sur demande explicite | Ajouter le glisser-déposer (CDK drag-drop) |
| Badge des notifications rafraîchi toutes les 60 s | Simple et suffisant pour la démo | Temps réel (WebSocket / SSE) |
| Graphiques en barres d'une seule teinte, valeurs aussi affichées en texte | Comparaison de quantités ; accessibilité ; teinte validée (contraste ≥ 3:1) | Graphiques multicolores (palette catégorielle) |

### À fournir par le superviseur

- **Faire (ou demander) le premier commit.**
- **Docker Desktop** démarré, avant la TASK 26.
- **Un fournisseur LLM et une clé API** pour AI-01 (TASK 24), placée uniquement dans `.env`.
- **Le dépôt GitHub** (et éventuellement renommer le dossier en `smart-project-manager`).
- **`ADMIN_EMAIL` et `ADMIN_PASSWORD`** dans `backend/.env` pour créer l'administrateur (`npm run create-admin`).

### Limites connues

- **Aucun commit** : le travail n'est pas sauvegardé dans l'historique Git, et le livrable 1 exige des commits significatifs.
- Les écrans des TASK 14 à 19 ont été vérifiés par les tests automatiques et par des appels HTTP via le proxy, **pas encore parcourus par le superviseur dans le navigateur**.
- Pas de limitation des tentatives de connexion (TASK 28) ; arrêt propre du serveur non testé sous Windows (TASK 26).
- Les dates d'un sprint ne sont pas contrôlées par rapport à celles du projet.
- Pas de « mot de passe oublié » (nécessiterait un service d'e-mails).
- Couverture de code du frontend non mesurée.
- Un token émis dans la même seconde qu'un changement de mot de passe reste valide (précision des JWT à la seconde).

## 9. Prochaines étapes recommandées

1. **Faire le premier commit** des 19 tâches, ou me le demander.
2. **Parcourir le scénario dans le navigateur** :
   - chef de projet : créer un projet et un sprint, ajouter un développeur, créer des tâches ;
   - développeur : déplacer une tâche sur le Kanban et la commenter ;
   - chef de projet : consulter les notifications et le tableau de bord.
3. Quand vous le déciderez : **TASK 20**, début du service IA.
