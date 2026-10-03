# Prompts

This file has two parts:

- **Part A — Development prompts** (in French, like the exchanges): the prompts exchanged between the human supervisor and the AI development agent (Claude Code) to build the project, from the start until the stop point before the AI service (2 October → 3 October 2026, after TASK 19). Kept up to date with the progress report [bilan.md](bilan.md).
- **Part B — LLM prompts of the application** (deliverable 3): the prompts the application itself will send to an LLM (feature AI-01). **Not implemented yet** — the template below will be filled in by TASK 24.

---

## Partie A — Prompts de développement (superviseur ↔ agent IA)

### A.1 Démarche

- **Un prompt de contexte unique** (environ 22 000 caractères, 30 sections) envoyé au début ; tous les prompts suivants sont courts (« continuer », questions d'état, consignes de méthode).
- **L'agent** inspecte le dépôt, implémente une tâche, écrit les tests, met à jour `docs/`, lance tests, build et lint, vérifie l'absence de secrets, rend un rapport au format imposé, puis **s'arrête**.
- **Le superviseur** valide chaque étape (« continuer »), fournit les informations sur son environnement (MongoDB, Python), vérifie dans le navigateur et ajuste la méthode (phases entières, bilan après chaque tâche, arrêt avant l'IA).

### A.2 Le prompt de contexte (résumé)

| Section | Contenu |
|---|---|
| 1. Contexte | Mini-projet universitaire « AI for Software Engineering » : application web complète de gestion de projets logiciels assistée par l'IA (frontend, backend, base de données, module IA, API REST, tests, Git, documentation, architecture déployable) |
| 2. Stack imposée | Angular (TypeScript) · Node.js + Express.js en **JavaScript** · MongoDB + Mongoose · service IA séparé en Python + FastAPI · Git, GitHub, Docker, Docker Compose. Interdits : React/Vue, NestJS, backend en TypeScript, SQL |
| 3–7. Architecture et structures | Angular → API REST Express → MongoDB ; Express appelle FastAPI pour l'IA (jamais le navigateur) ; arborescences cibles `frontend/`, `backend/`, `ai-service/`, `docs/` |
| 8–15. Fonctionnel | 15 modules (authentification … fonctions IA), 3 rôles (ADMIN, PROJECT_MANAGER, DEVELOPER), projets, sprints, tâches (types, priorités, workflow TODO → DONE + BLOCKED), Kanban, commentaires, historique, tableau de bord |
| 16–17. IA | AI-01 génération de tâches (LLM), AI-02 recommandation de développeur, AI-03 risque de retard d'un sprint (ML) ; chaque fonction IA doit avoir entrée, sortie, approche, validation, gestion d'erreurs et documentation |
| 18. Livrables | 1. code versionné (commits significatifs, aucun secret) ; 2. démonstration en 10 étapes ; 3. prompts et modèles IA (`ai.md`, `prompts.md`) ; 4. rapport technique en 24 chapitres |
| 19–26. Règles | Documentation fidèle au code ; sécurité (aucun secret en dur, mots de passe hachés, validation des entrées et des sorties IA) ; règles Express, Angular, MongoDB, FastAPI ; tests réellement exécutés |
| 27–28. Méthode | Développement **tâche par tâche** : inspecter, implémenter le seul périmètre demandé, tester, documenter, vérifier, rapporter, **s'arrêter** ; rapport au format fixe (TASK STATUS, IMPLEMENTED, FILES…, NEXT RECOMMENDED TASK) |
| 29–30. Contraintes | Ne pas changer la stack sans demande du superviseur ; attendre la TASK 01 et répondre « PROJECT CONTEXT UNDERSTOOD » |

### A.3 Les prompts, dans l'ordre

Heures locales (Tunis). Les messages sont cités tels qu'ils ont été écrits ; « (en cours de tâche) » = message envoyé pendant que l'agent travaillait.

| # | Date, heure | Prompt du superviseur | Ce que l'agent a fait | Résultat |
|---|---|---|---|---|
| 1 | 02/10 11:20 | Prompt de contexte complet (§ A.2) | Lecture, aucune modification | « PROJECT CONTEXT UNDERSTOOD » |
| 2 | 11:21 | « continuer » | TASK 01 non définie : interprétée comme l'initialisation du dépôt (et signalé) | TASK 01 : Git, `.gitignore`, `.env.example`, README, 9 fichiers `docs/` |
| 3 | 11:25 | « continuer vers task 02 » | Backend Express (configuration, MongoDB, santé, erreurs) | — |
| 4 | 11:43 | Capture de MongoDB Compass : « database est already running et les coordonneé de connexion sont les par defaut » | Connexion à `localhost:27017`, base dédiée `smart_project_manager`, autres bases jamais touchées | TASK 02 : 24 tests |
| 5 | 11:55 | « continuer vers task 03 » | Authentification JWT ; décision soumise : inscription libre en développeur ou chef de projet, admin par commande | TASK 03 : 72 tests |
| 6 | 12:05 | « continuer vers task 040 » | Compris comme TASK 04 : administration des utilisateurs | TASK 04 : 115 tests |
| 7 | 12:13 | « oui continuer task 05 » | Profil, mot de passe, compétences | TASK 05 : 148 tests |
| 8 | 12:21 | « continsuer vers les differents tasks backend et m'a lister les tasks complets a suivre » | Toute la phase backend d'un bloc + feuille de route complète TASK 01–29 | TASK 06–11 : 295 tests, 22/22 vérifications de bout en bout |
| 9 | 12:58 | « continuer » | Socle Angular ; interrompu à 13:32 par la limite de la session | — |
| 10 | 15:21 | « pouvez vous continuer » | Reprise, vérifications finales | TASK 12 : 23 tests frontend |
| 11 | 15:24 | « continuer et bien lister les tasks restants » | Écrans de connexion et d'inscription ; liste des 16 tâches restantes | TASK 13 : 90 tests ; boucle de redirection infinie trouvée et corrigée |
| 12 | 15:40 | « continuer » (en cours de tâche) | Pris comme une confirmation : la TASK 13 a été terminée, sans enchaîner une autre tâche | — |
| 13 | 15:55 | `/compact` | Résumé automatique de la conversation | — |
| 14 | 15:57 | « a quel etape en est deja et quel sont les fonctionnalité deja fonctionnels pour les tester » | État du projet et guide de test (navigateur, API, tests) | Ligne périmée du README corrigée |
| 15 | 16:07 | Deux captures (comptes chef de projet et développeur) : « donner a quel etape on est deja et quel reste a faire » | Vérification consignée dans `docs/testing.md` | Première validation dans un vrai navigateur |
| 16 | 16:10 | « donner un bilan complet des differents tasks implemnter et ce qu'il reste a faire aussi le livrable but pour ce travaille (bilan sur le discours et les differents prompt entre nous ) » | Création de `docs/bilan.md` | — |
| 17 | 16:37 | « continuer python est bien installer et a chaque fois fait un resumer livrable des differents prompt entre nous et tache realiser et a faire aussi » | Python 3.14.8 vérifié ; consigne enregistrée (bilan après chaque tâche) ; profil et administration | TASK 14 : 143 tests, 21/21 vérifications |
| 18 | 17:07 | « oui continuer » | Projets et équipes ; « oui » n'a pas été pris comme une autorisation de commit | TASK 15 : 194 tests, 26/26 vérifications ; bundle initial 500,8 → 341,6 kB |
| 19 | 17:26 | « continuer les differents tasks une fois pour toute relier a la partie dev des fonctionnalités sans ia » (en cours de tâche) | Enchaînement des TASK 16 à 19 (tous les écrans hors IA) | TASK 16 : 240 tests ; TASK 17 : 245 ; TASK 18 : 283 (+ correction backend) |
| 20 | 03/10 10:26 | « continuer l'implementation des differents partie fonctionnalités de l'application et arrete a la partie developpement des partie ia aussi a chaque generer le bilan qui resume la discussion entre nous et le livrable obtenue et le reste a faire » | Fin de la TASK 19 (tableaux de bord, recherche), arrêt avant la TASK 20 (IA), bilan mis à jour | TASK 19 : 307 tests, 35/35 vérifications de bout en bout |
| 21 | 10:37 | « si tu arrive a l'etape d'arret fait remplir le fichier prompts.md par un resumer des differents prompts discuter entre nous dé le debut de projet jusqu'a cette etape » (en cours de tâche) | Rédaction de cette partie A (la partie B reste réservée aux prompts LLM de l'application) | Ce document |

### A.4 Analyse

Un même prompt peut relever de plusieurs types (le #17, par exemple).

| Type de prompt | Prompts | Exemples | Effet |
|---|---|---|---|
| Contexte | #1 | Prompt initial | Fixe la stack, les règles, la méthode et le format de rapport pour tout le projet |
| Poursuite | #2, 3, 5, 6, 7, 9, 10, 11, 12, 18 | « continuer », « continuer vers task 02 », « oui continuer » | Une tâche par prompt ; le rapport précédent indique la tâche suivante |
| Information sur l'environnement | #4, 17 | Capture Compass, « python est bien installer » | Débloque une étape (base locale, service IA) |
| Vérification et état | #14, 15, 16 | « a quel etape… », captures du navigateur, bilan | Contrôle humain du résultat réel |
| Consigne de méthode | #8, 17, 19, 20, 21 | Phase entière, bilan après chaque tâche, tout le hors-IA, arrêt avant l'IA, ce fichier | Change la façon de travailler de l'agent pour la suite |
| Commande | #13 | `/compact` | Gestion du contexte de la conversation |

**Ce qui a bien fonctionné**
- Le prompt de contexte rend les prompts suivants très courts et sans ambiguïté.
- Le format de rapport imposé (tests, build, sécurité, problèmes connus, commit recommandé) rend chaque étape vérifiable.
- Demander une phase entière (#8, #19) accélère beaucoup le travail : 6 tâches backend en 35 minutes.

**Interprétations faites par l'agent** (signalées dans les rapports)
- #2 : TASK 01 non définie → initialisation du dépôt.
- #6 : « task 040 » → TASK 04.
- #12 : un « continuer » reçu pendant une tâche ne lance pas une deuxième tâche.
- #18 : « oui continuer » répond à la proposition de continuer, pas à celle de faire un commit (une action irréversible reste à demander explicitement).

**Problèmes trouvés par l'agent, pas par les prompts**
- Les tests ont révélé une boucle de redirection infinie (TASK 13) et des erreurs affichées sur un formulaire vidé après un succès (TASK 14).
- La relecture du code a évité une recherche ignorée quand le même texte était tapé dans les deux champs du dialogue « Add developers » (TASK 15).
- La vérification de bout en bout a révélé une anomalie du backend : un projet supprimé laissait ses notifications. Elle a été relevée en TASK 15 et corrigée en TASK 18.
- Le bundle initial dépassait le seuil de 500 kB. Il a été réduit à 341,6 kB en chargeant les messages à la demande (TASK 15).

---

## Part B — LLM prompts of the application

> Current state: **no LLM is used yet and no prompt exists** (AI-01 is TASK 24).
> An external LLM API is introduced only when explicitly requested. Prompts are documented here exactly as they appear in the code (`ai-service/app/prompts/`).

### Template (one section per LLM feature)

#### Feature: `<AI-xx name>`

| Item | Value |
|------|-------|
| Provider / model | |
| Endpoint | |
| Timeout | |

**System prompt**

```text
(exact system prompt)
```

**User prompt structure**

```text
(template with placeholders)
```

**Input** — fields received from the backend.

**Expected output — JSON schema**

```json
{}
```

**Validation** — how the response is parsed and validated (Pydantic schema, enum checks, bounds).

**Error handling** — malformed JSON, schema mismatch, timeout, provider error, rate limit.

**Security considerations** — API key handling, prompt-injection mitigation, data sent to the provider.

### Implemented prompts

None yet.
