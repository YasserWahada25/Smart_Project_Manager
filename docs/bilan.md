# Bilan du projet — Smart Project Manager

> **Point d'étape au 2 octobre 2026, après la TASK 15** (15 tâches terminées sur 29).
> Ce document est mis à jour à la fin de chaque tâche, à la demande du superviseur. L'état de référence reste dans le [README](../README.md#development-progress) et les autres fichiers de `docs/`.
>
> Sources : le dépôt, les rapports rendus à la fin de chaque tâche et l'historique des échanges entre le superviseur humain et l'agent IA (Claude Code).

## 1. En bref

| Élément | État |
|---|---|
| Avancement | 15 tâches sur 29 : phases 1 et 2 terminées, phase 3 en cours (4 tâches sur 8) |
| Backend Express | Terminé pour toutes les fonctions hors IA : 49 endpoints REST, 7 collections MongoDB, 295 tests automatisés |
| Frontend Angular | Socle, authentification, « My profile », administration « Users », **projets et équipes** (liste, création, page projet, statuts, équipe constituée depuis l'annuaire des développeurs) ; 194 tests automatisés |
| Service IA (Python / FastAPI) | Pas commencé. Python 3.14.8 est maintenant installé |
| Docker / Compose | Pas commencé : Docker Desktop n'est pas démarré |
| Git | Dépôt créé sur `main`, **aucun commit pour l'instant** |
| Vérifié par le superviseur dans un vrai navigateur | Création d'un compte chef de projet et d'un compte développeur, accueil personnalisé, menu utilisateur, état système « Operational » (après la TASK 13) |

## 2. Le but : les 4 livrables attendus

Le prompt de contexte (section 18) fixe quatre livrables finaux.

| Livrable | Ce qui est demandé | État au 2 octobre | Reste à faire |
|---|---|---|---|
| **1. Code source versionné** | Dépôt Git avec frontend Angular, backend Express, intégration MongoDB, service FastAPI, tests, documentation, README, `.gitignore`, `.env.example`, configuration Docker ; commits significatifs ; aucun secret | Frontend, backend, tests, docs, `.gitignore` et `.env.example` présents ; aucun secret détecté. **Aucun commit.** | Commits (dès maintenant), service IA (TASK 20–25), Docker (TASK 26), publication sur GitHub |
| **2. Démonstration de l'application web** | Scénario en 10 étapes dans le navigateur, uniquement avec des fonctions qui existent réellement | Étapes 1 à 3 dans l'interface (connexion, créer un projet, ajouter des développeurs) ; étapes 4 à 6 et 10 seulement via l'API ; étapes 7 à 9 pas commencées | Écrans (TASK 16–19), IA (TASK 22–24), données de démo (TASK 27) |
| **3. Prompts et modèles IA** | `docs/ai.md` et `docs/prompts.md` : pour chaque fonction LLM, modèle, prompts, schéma JSON, validation, erreurs ; pour chaque fonction ML, dataset, variables, algorithme, métriques, persistance | Fichiers créés ; `ai.md` décrit les données déjà disponibles pour AI-02 et AI-03 ; aucun modèle ni prompt, car rien n'est encore implémenté | Remplis au fil des TASK 22 à 24 |
| **4. Rapport technique** (24 chapitres) | Toutes les informations nécessaires au rapport, tenues à jour au fil du projet | Les fichiers `docs/` sont mis à jour à chaque tâche ; le README indique quel fichier alimente chaque chapitre | Rédaction finale (TASK 29), surtout les chapitres 13, 15, 16 et 19 à 24 |

### Scénario de démonstration (livrable 2)

| # | Étape | API | Interface |
|---|---|---|---|
| 1 | Connexion | ✅ | ✅ (TASK 13) |
| 2 | Créer un projet | ✅ | ✅ (TASK 15) |
| 3 | Ajouter des développeurs | ✅ | ✅ (TASK 15) |
| 4 | Créer un sprint | ✅ | TASK 16 |
| 5 | Créer et gérer des tâches | ✅ | TASK 16 |
| 6 | Utiliser le tableau Kanban | ✅ | TASK 17 |
| 7 | Générer des tâches avec l'IA (AI-01) | TASK 24 | TASK 24 |
| 8 | Recommandation d'un développeur (AI-02) | TASK 23 | TASK 23 |
| 9 | Prédire le risque de retard d'un sprint (AI-03) | TASK 22 | TASK 22 |
| 10 | Tableau de bord | ✅ | TASK 19 |

## 3. Méthode de travail

- **Un prompt de contexte unique** (environ 22 000 caractères) fixe dès le départ :
  - la stack imposée et l'architecture cible ;
  - les 15 modules fonctionnels, les 3 rôles et les 3 fonctions IA ;
  - les 4 livrables et les règles de sécurité ;
  - le développement tâche par tâche et le format de rapport.
- **Répartition des rôles :**
  - le superviseur humain donne le feu vert à chaque tâche, fournit les informations sur son environnement et vérifie le résultat ;
  - l'agent IA inspecte le dépôt, implémente le périmètre demandé, teste, documente, rend son rapport, puis **s'arrête**.
- **Boucle suivie pour chaque tâche :** inspecter → implémenter → écrire les tests → mettre à jour `docs/` (et ce bilan) → lancer tests, build et lint → chercher les secrets → rapport → arrêt.
- **Conventions ajoutées en cours de route :**
  - « continuer » lance la tâche suivante ; « continuer vers les tasks backend » lance toute la phase, puis arrêt.
  - Depuis la TASK 14, ce bilan est mis à jour **après chaque tâche** : nouveaux prompts, tâche réalisée, reste à faire.
  - La base MongoDB locale contient d'autres projets. L'application utilise sa propre base `smart_project_manager`, et les comptes de test `@smoke.test` sont supprimés après chaque vérification. Les autres bases ne sont jamais touchées.
- **Feuille de route :** le prompt de contexte ne découpait pas le travail en tâches. L'agent a défini la TASK 01, puis proposé la feuille de route complète en 29 tâches pendant la phase backend. Le superviseur l'a suivie.
- **Rien n'est fait à la place du superviseur :**
  - aucun commit, car les commits sont seulement recommandés ;
  - aucun compte administrateur réel, car son mot de passe doit venir du superviseur ;
  - aucun choix d'outil hors de la stack imposée.

## 4. Historique des échanges

Heures locales (Tunis), le 2 octobre 2026. Les messages du superviseur sont cités tels qu'ils ont été écrits.

| # | Heure | Message du superviseur | Action de l'agent | Résultat |
|---|---|---|---|---|
| 1 | 11:20 | Prompt de contexte complet (section 3), terminé par « Wait for TASK 01 » | Lecture, aucune modification | « PROJECT CONTEXT UNDERSTOOD » |
| 2 | 11:21 | « continuer » | La TASK 01 n'étant pas définie, l'agent l'interprète comme l'initialisation du dépôt et le signale | TASK 01 PASS : Git, `.gitignore`, `.env.example`, README, 9 fichiers de documentation. Signale : Python absent, Docker arrêté, aucun MongoDB détecté |
| 3 | 11:25 | « continuer vers task 02 » | Mise en place du backend Express | — |
| 4 | 11:43 | Capture de MongoDB Compass : « database est already running et les coordonneé de connexion sont les par defaut » | Connexion à `localhost:27017`, base dédiée `smart_project_manager`, sans toucher aux autres bases | TASK 02 PASS : 24 tests |
| 5 | 11:55 | « continuer vers task 03 » | Authentification JWT | TASK 03 PASS : 72 tests. Décision soumise au superviseur : inscription libre en développeur ou chef de projet, jamais en admin. Pas d'objection, la décision est conservée |
| 6 | 12:05 | « continuer vers task 040 » (comprise comme TASK 04) | Gestion des utilisateurs par l'admin | TASK 04 PASS : 115 tests, commande `create-admin` |
| 7 | 12:13 | « oui continuer task 05 » | Profil, mot de passe, compétences | TASK 05 PASS : 148 tests |
| 8 | 12:21 | « continsuer vers les differents tasks backend et m'a lister les tasks complets a suivre » | TASK 06 à 11 enchaînées, puis arrêt ; feuille de route complète 01–29 | PASS : 295 tests et 22 vérifications sur 22 de bout en bout sur la vraie base (données supprimées ensuite) |
| 9 | 12:58 | « continuer » | TASK 12 (socle Angular), interrompue à 13:32 par la limite d'utilisation de la session | — |
| 10 | 15:21 | « pouvez vous continuer » | Reprise : vérifications finales relancées | TASK 12 PASS : 23 tests frontend |
| 11 | 15:24 | « continuer et bien lister les tasks restants » | TASK 13 et liste détaillée des 16 tâches restantes | TASK 13 PASS : 90 tests frontend. Une boucle de redirection infinie, trouvée par les tests, a été corrigée |
| 12 | 15:55 | `/compact` | Résumé automatique de la conversation pour libérer de la place | — |
| 13 | 15:57 | « a quel etape en est deja et quel sont les fonctionnalité deja fonctionnels pour les tester » | État du projet et guide de test (navigateur, API, tests automatiques) | Une ligne périmée du README corrigée |
| 14 | 16:07 | Deux captures (comptes chef de projet et développeur) : « donner a quel etape on est deja et quel reste a faire » | Vérification consignée dans `docs/testing.md` | Première validation dans un vrai navigateur |
| 15 | 16:10 | « donner un bilan complet des differents tasks implemnter et ce qu'il reste a faire […] » | Création de ce document | — |
| 16 | 16:37 | « continuer python est bien installer et a chaque fois fait un resumer livrable des differents prompt entre nous et tache realiser et a faire aussi » | Python 3.14.8 vérifié ; nouvelle consigne enregistrée (bilan après chaque tâche) ; TASK 14 | TASK 14 PASS : 143 tests frontend, 21 vérifications sur 21 de bout en bout. Les tests ont trouvé un défaut d'affichage, corrigé : un formulaire vidé après succès montrait des erreurs |
| 17 | 17:07 | « oui continuer » | TASK 15 (projets et équipes). « oui » n'a pas été pris comme une autorisation de commit : un commit reste à demander explicitement | TASK 15 PASS : 194 tests frontend, 26 vérifications sur 26 de bout en bout. Bundle initial réduit de 500,8 à 341,6 kB. Une anomalie backend relevée (notifications d'un projet supprimé conservées) |

### Ce que montre cet échange

- **Des prompts très courts suffisent après le contexte.** Le prompt initial fixe les règles une fois pour toutes. Chaque rapport se termine par la tâche recommandée, donc « continuer » est sans ambiguïté.
- **L'agent n'interprète pas une réponse vague comme une autorisation** : « oui continuer » a lancé la tâche suivante, mais pas le commit proposé juste avant.
- **Le superviseur ajuste la méthode en cours de route.** Il a demandé une phase entière d'un coup (TASK 06–11), puis un bilan livrable tenu à jour après chaque tâche (depuis la TASK 14).
- **Durée :** les 13 premières tâches ont été réalisées entre 11:20 et 15:55, dont environ 1 h 50 d'interruption (13:32 → 15:21). La phase backend entière (TASK 06 à 11) a pris 35 minutes, parce qu'elle a été demandée d'un seul bloc.
- **Les interventions humaines décisives :**
  - la capture de Compass, qui a permis de tester sur la vraie base ;
  - la consigne « toute la phase backend », qui a accéléré le travail ;
  - le test dans le navigateur, qui a apporté la première validation visuelle ;
  - l'installation de Python, qui débloque la phase 4.
- **Les tests ont trouvé de vrais problèmes avant le superviseur :**
  - la boucle de redirection infinie (TASK 13) ;
  - les messages d'erreur affichés sur un formulaire vidé après un changement de mot de passe réussi (TASK 14) ;
  - un test de routage incomplet (liaison des paramètres de route), corrigé pour reproduire la configuration réelle (TASK 15) ;
  - une anomalie du backend : un projet supprimé laisse ses notifications (vérification de bout en bout, TASK 15 ; à corriger en TASK 18) ;
  - l'erreur de connexion de Jest à la base de test (TASK 02) ;
  - un défaut de la bibliothèque de validation qui masquait des erreurs (TASK 05) ;
  - un cas d'erreur 500 sur une entrée inattendue (phase 2).

## 5. Bilan des tâches réalisées

### Phase 1 — Fondations du backend

| Tâche | Contenu | Preuves | Point notable |
|---|---|---|---|
| 01 | Dépôt Git ; `.gitignore` (exclut les `.env`) ; `.gitattributes` (fins de ligne LF) ; `.env.example` ; README avec la correspondance des chapitres du rapport ; 9 fichiers `docs/` | Contrôle des règles d'exclusion Git et des liens de la documentation | Toutes les fonctions y sont marquées « prévues » tant qu'elles n'existent pas |
| 02 | Backend Express 5 en couches (routes, contrôleurs, services) ; connexion MongoDB ; `GET /health` (200 si la base répond, 503 sinon) ; format d'erreur JSON unique ; helmet, CORS, limite de 1 Mo ; contrôle de la configuration au démarrage | 24 tests | Jest ne joignait pas la base de test (pilote MongoDB 7.6), corrigé par une option de Node |
| 03 | Modèle `User` ; inscription, connexion, `/auth/me` ; JWT HS256 ; mots de passe hachés avec bcrypt ; middlewares d'authentification et d'autorisation ; validation de toutes les entrées | 72 tests | Même message et même durée pour un email inconnu et un mauvais mot de passe ; tentatives d'injection MongoDB refusées |
| 04 | Administration : liste, recherche et filtres, activation et désactivation, changement de rôle ; commande `npm run create-admin` | 115 tests | Un admin ne peut ni se désactiver ni se rétrograder ; les comptes sont désactivés, jamais supprimés |
| 05 | Profil, changement de mot de passe, compétences (nom, niveau, années d'expérience) | 148 tests | Un changement de mot de passe invalide tous les anciens tokens, sur tous les appareils |

### Phase 2 — Fonctionnalités du backend

| Tâche | Contenu | Point notable |
|---|---|---|
| 06 | Projets : création, modification, suppression, statuts, archivage en lecture seule ; membres ; annuaire des développeurs filtrable par compétence | Une personne extérieure au projet reçoit 404, pour ne pas révéler son existence |
| 07 | Sprints : cycle PLANNED → ACTIVE → COMPLETED ou CANCELLED ; statistiques en story points | Un seul sprint actif par projet, garanti aussi par un index MongoDB |
| 08 | Tâches : type, priorité, complexité (1, 2, 3, 5, 8, 13), échéance, compétences requises, assignation ; workflow contrôlé avec état BLOCKED ; Kanban ; « mes tâches » ; filtres | Un développeur ne peut déplacer que ses propres tâches |
| 09 | Commentaires (modérés par le chef de projet) ; historique d'activité (16 types d'événements) | Un échec d'écriture dans l'historique ne bloque jamais l'action elle-même |
| 10 | Notifications créées à partir de l'historique ; compteur de non-lues ; marquer comme lu ; suppression automatique après 90 jours | L'auteur d'une action n'est jamais notifié de sa propre action |
| 11 | Tableau de bord global adapté au rôle ; tableau de bord par projet ; recherche globale | — |

Preuves pour la phase 2 :
- **295 tests automatisés.** Couverture : 99 % des instructions, 91 % des branches, 99,5 % des lignes.
- **22 vérifications sur 22** de bout en bout sur la vraie base locale, de l'inscription jusqu'au tableau de bord. Les données créées ont été supprimées ensuite.

### Phase 3 — Interface Angular (en cours)

| Tâche | Contenu | Preuves | Point notable |
|---|---|---|---|
| 12 | Angular 22 (composants standalone, signals) ; Angular Material 3 ; proxy `/api` vers le backend ; gestion centralisée des erreurs HTTP ; messages toast ; mise en page responsive ; page d'état du système ; page 404 | 23 tests ; build de production de 494 kB | Session interrompue par la limite d'utilisation, puis reprise sans perte |
| 13 | Connexion, inscription, déconnexion ; pages protégées par des gardes ; déconnexion automatique à l'expiration du token ; retour à la page demandée après connexion | 90 tests ; build de 471 kB ; vérifié dans le navigateur par le superviseur | Boucle de redirection infinie corrigée ; bundle initial réduit de 606 à 471 kB |
| 14 | **My profile** (tous les rôles) : compte en lecture seule, informations personnelles, compétences (ajout, modification, suppression, enregistrement de la liste entière), changement de mot de passe. **Users** (administrateurs) : tableau des comptes avec recherche, filtres par rôle et statut, pagination, changement de rôle, activation et désactivation avec confirmation. Menu latéral adapté au rôle | 143 tests ; build de 499,7 kB ; 21 vérifications sur 21 de bout en bout via le proxy | Après un changement de mot de passe, l'onglet courant reste connecté avec le nouveau token, tandis que les autres appareils sont déconnectés. Un admin ne peut pas modifier son propre compte. Défaut d'affichage des erreurs après succès corrigé |
| 15 | **Projects** : liste en cartes (recherche, filtre par statut, pagination, message adapté au rôle) ; formulaire de création et de modification (dates, technologies en « chips ») ; page projet (vue d'ensemble, équipe, changement de statut avec archivage confirmé, suppression confirmée) ; dialogue « Add developers » : annuaire filtré par nom et par compétence | 194 tests ; build de 341,6 kB ; 26 vérifications sur 26 de bout en bout via le proxy | Le code des messages (snack bar) est chargé à la demande : le bundle initial passe de 500,8 à 341,6 kB. Logique des listes paginées mutualisée (`PagedList`). Les droits suivent ceux du backend : seul le chef de projet modifie, admin et membres en lecture seule |

### Évolution du nombre de tests automatisés

| Après | 02 | 03 | 04 | 05 | 06–11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|
| Backend | 24 | 72 | 115 | 148 | 295 | 295 | 295 | 295 | 295 |
| Frontend | — | — | — | — | — | 23 | 90 | 143 | 194 |

À chaque tâche, lint et `npm audit --omit=dev` (0 vulnérabilité) ont aussi été lancés.

## 6. Exigences fonctionnelles

| Exigence | Module | API | Interface |
|---|---|---|---|
| FR-01 | Authentification | ✅ | ✅ |
| FR-02 | Gestion des utilisateurs | ✅ | ✅ (TASK 14) |
| FR-03 | Profils | ✅ | ✅ (TASK 14) |
| FR-04 | Compétences des développeurs | ✅ | ✅ (TASK 14) |
| FR-05 | Projets | ✅ | ✅ (TASK 15) |
| FR-06 | Équipes | ✅ | ✅ (TASK 15) |
| FR-07 | Sprints | ✅ | TASK 16 |
| FR-08 | Tâches | ✅ | TASK 16 |
| FR-09 | Kanban | ✅ | TASK 17 |
| FR-10 | Commentaires | ✅ | TASK 18 |
| FR-11 | Historique d'activité | ✅ | TASK 18 |
| FR-12 | Notifications | ✅ | TASK 18 |
| FR-13 | Tableau de bord | ✅ (sans les indicateurs IA) | TASK 19 |
| FR-14 | Recherche et filtres | ✅ | Partiel : projets et annuaire des développeurs (TASK 15) ; tâches et recherche globale (TASK 16, 19) |
| FR-15 | Fonctions IA | TASK 20–24 | TASK 22–24 |

Détail : [requirements.md](requirements.md).

## 7. Ce qu'il reste à faire : 14 tâches

### Phase 3 — Interface Angular

Ces écrans s'appuient sur l'API déjà terminée.

| Tâche | Contenu |
|---|---|
| **16** (prochaine) | Sprints et tâches : listes, formulaires, filtres, progression, « Mes tâches » |
| 17 | Tableau Kanban |
| 18 | Commentaires, historique d'activité, notifications avec compteur |
| 19 | Tableau de bord avec graphiques (Chart.js) et recherche globale |

### Phase 4 — Service IA (Python + FastAPI)

Python 3.14.8 est installé : cette phase n'est plus bloquée.

| Tâche | Contenu |
|---|---|
| 20 | Mise en place de FastAPI : structure, endpoint de santé, Pydantic, tests pytest |
| 21 | Liaison backend ↔ service IA : délais d'attente, gestion des erreurs |
| 22 | AI-03 : prédiction du risque de retard d'un sprint (dataset, modèle ML, métriques, écran) |
| 23 | AI-02 : recommandation de développeur selon les compétences et la charge de travail |
| 24 | AI-01 : génération de tâches par un LLM (prompt, validation du JSON, enregistrement, écran) |
| 25 | Optionnel : estimation de la complexité, résumé de sprint |

### Phase 5 — Livraison

| Tâche | Contenu |
|---|---|
| 26 | Docker et Docker Compose pour les 4 services. **Prérequis : Docker Desktop démarré** |
| 27 | Données de démonstration et scénario de démo |
| 28 | Renforcement de la sécurité (limitation des tentatives de connexion…) et intégration continue GitHub Actions |
| 29 | Documentation finale et rapport technique |

## 8. Points ouverts

### Décisions prises par l'agent, à confirmer ou changer

| Décision | Raison | Alternative possible |
|---|---|---|
| Inscription libre en développeur ou chef de projet ; admin créé uniquement par commande | La démo fonctionne tout de suite | Inscription en développeur seulement, puis promotion par l'admin |
| Interface et documentation en anglais | Le prompt de contexte est rédigé en anglais | Traduire l'interface en français |
| Token de session dans `localStorage` | La session survit au rechargement de la page ; le risque XSS est atténué et documenté | Cookie httpOnly, avec une protection CSRF côté backend |
| Déconnexion côté navigateur seulement | Fonctionnement normal d'un JWT : le token reste valide jusqu'à son expiration (1 jour par défaut) | Liste de révocation des tokens |
| Complexité exprimée en story points (1, 2, 3, 5, 8, 13) | Pratique courante en Scrum ; utile pour AI-03 | Échelle libre |
| Une personne extérieure à un projet reçoit 404 plutôt que 403 | Ne pas révéler l'existence du projet | 403 explicite |
| Les compétences sont enregistrées en une fois (liste entière) | Correspond à l'API `PUT /profile/skills` ; une seule vérification des doublons | Enregistrer chaque compétence séparément |
| Désactivation d'un compte et changement de rôle confirmés par une boîte de dialogue ; réactivation sans confirmation | La désactivation coupe l'accès immédiatement ; la réactivation est sans risque | Confirmer toutes les actions |
| Statut du projet changé depuis la page projet (pas dans le formulaire) ; seul l'archivage est confirmé | L'archivage rend le projet en lecture seule ; les autres statuts sont sans risque | Champ « statut » dans le formulaire |
| Code des messages (snack bar) chargé à la demande puis préchargé après le premier affichage | Bundle initial réduit de 159 kB ; le préchargement garde les messages d'erreur réseau disponibles | Tout charger au démarrage (bundle initial au-delà du seuil de 500 kB) |

### À fournir par le superviseur

- ~~Python 3.11+~~ : fait (3.14.8).
- **Docker Desktop** démarré, avant la TASK 26.
- Pour AI-01 (TASK 24), **un fournisseur LLM et une clé API**. La clé sera placée uniquement dans `.env` et jamais commitée.
- **Le dépôt GitHub.** Le dossier racine pourra aussi être renommé de `SmartManager` en `smart-project-manager`.
- **`ADMIN_EMAIL` et `ADMIN_PASSWORD`** dans `backend/.env`, pour créer l'administrateur avec `npm run create-admin` et utiliser la page « Users ».

### Limites connues

- **Aucun commit.** Le travail peut être perdu, et le livrable 1 exige des commits significatifs.
- ~~Bundle initial au seuil d'alerte~~ : résolu en TASK 15 (341,6 kB pour un seuil de 500 kB).
- **Anomalie backend** : supprimer un projet efface son historique d'activité mais pas ses notifications, qui pointent alors vers un projet inexistant. À corriger avec l'écran des notifications (TASK 18).
- Pas de limitation des tentatives de connexion (prévu en TASK 28).
- Arrêt propre du serveur non testé sous Windows (sera vérifié avec Docker en TASK 26).
- Les dates d'un sprint ne sont pas contrôlées par rapport à celles du projet.
- Pas de fonction « mot de passe oublié » : elle nécessiterait un service d'envoi d'emails.
- La couverture de code du frontend n'est pas mesurée.
- Un token émis dans la même seconde qu'un changement de mot de passe reste valide, car la date d'un JWT est précise à la seconde.
- Les écrans des TASK 14 et 15 ont été vérifiés par les tests automatiques et par des appels HTTP via le proxy, pas encore dans un vrai navigateur.

## 9. Prochaines étapes recommandées

1. **Faire le premier commit maintenant**, pour sécuriser les 15 tâches terminées (à demander explicitement).
2. Tester les nouveaux écrans dans le navigateur :
   - « My profile » avec le compte développeur ;
   - « Users » avec un compte administrateur, après `npm run create-admin` ;
   - « Projects » avec le compte chef de projet : créer un projet, puis ajouter le compte développeur à l'équipe.
3. Lancer la **TASK 16** (écrans sprints et tâches).
