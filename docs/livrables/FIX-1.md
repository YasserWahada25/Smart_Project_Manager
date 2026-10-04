# Livrable — FIX-1 : conversation de l'assistant enregistrée

> Problème signalé : la conversation entre le manager et l'assistant (AI-04) disparaissait dès qu'on changeait de page. Elle est maintenant **enregistrée en base**, une par manager et par projet, avec l'état de chaque proposition. Réalisé le 4 octobre 2026. **Non commité.**

## 1. Prompts à l'origine

| # | Prompt du superviseur (cité) | Décision / effet |
|---|---|---|
| 45 | « maintenant le discours entre l'assistant et le manager n'etait pas enregistrer, a la changement de page tous disparaitre fixer ce probleme » | Cause : la conversation n'existait que dans le composant de la page (choix de TASK 25 : « the conversation is not stored »). Correction : enregistrement côté backend (MongoDB) plutôt que dans le navigateur, pour qu'elle survive aussi au rechargement, à un autre ordinateur, et que l'état des propositions soit fiable |

## 2. Ce qui a été livré

- **Enregistrement** : chaque échange réussi (question du manager, réponse, propositions) est ajouté à la conversation du manager pour ce projet. Une requête en échec n'enregistre rien. 200 messages au plus (les plus anciens sont retirés).
- **Retour sur l'onglet « Assistant »** : la conversation est rechargée (barre « Loading the conversation… », envoi bloqué pendant le chargement pour que l'assistant ait tout l'historique) ; message clair si elle ne peut pas être chargée.
- **Propositions fiables** :
  - « Confirm » applique la proposition **enregistrée** (son outil et ses arguments stockés, pas ceux envoyés par le navigateur) ;
  - son résultat est enregistré : *Applied — message* ou *Not applied — raison* ;
  - une proposition déjà appliquée ne peut pas l'être une seconde fois (409), même après rechargement ;
  - « Dismiss » est aussi enregistré.
- **« New conversation »** supprime la conversation enregistrée.
- **Confidentialité** : chaque manager ne voit que sa propre conversation ; les conversations d'un projet supprimé sont supprimées avec lui.
- **Bug trouvé pendant le test réel avec Gemini, corrigé** : pour créer une tâche dans le backlog, le modèle envoyait `sprintId: "backlog"` (la valeur des autres outils) ; la confirmation échouait (« Sprint must be a valid id or null »). `'backlog'` est maintenant accepté comme `null`.

## 3. API ajoutée ou modifiée

| Méthode | Route | Effet |
|---|---|---|
| GET | `/api/v1/projects/:id/ai/assistant/conversation` | Conversation enregistrée (messages, propositions et leur état) |
| DELETE | `/api/v1/projects/:id/ai/assistant/conversation` | « New conversation » (204) |
| POST | `/api/v1/projects/:id/ai/assistant/proposals/:proposalId/dismiss` | Proposition écartée |
| POST | `/api/v1/projects/:id/ai/assistant/actions` | Accepte maintenant `{ "proposalId" }` (proposition enregistrée, appliquée une seule fois) ; l'ancien format `{ tool, arguments }` reste accepté |
| POST | `/api/v1/projects/:id/ai/assistant/chat` | Inchangé pour le navigateur ; enregistre l'échange |

## 4. Fichiers

| Fichier | Rôle |
|---|---|
| `backend/src/models/assistantConversation.model.js` | **Nouveau** : collection `assistantconversations` (index unique projet + manager ; arguments stockés en texte JSON pour qu'aucune clé venant du LLM ne soit lue comme opérateur MongoDB) |
| `backend/src/services/aiAssistant.service.js` | Enregistrement des échanges, lecture, suppression, état des propositions ; `'backlog'` pour `create_task` |
| `backend/src/controllers/ai.controller.js`, `backend/src/routes/project.routes.js`, `backend/src/validators/aiAssistant.validator.js` | Trois nouvelles routes et leurs validations ; `proposalId` pour `/actions` |
| `backend/src/services/project.service.js` | Suppression des conversations avec le projet |
| `backend/tests/aiAssistant.test.js`, `backend/tests/projects.test.js` | 5 tests ajoutés, 1 complété |
| `frontend/src/app/core/models/ai-assistant.ts` | Types de la conversation enregistrée |
| `frontend/src/app/features/ai-assistant/ai-assistant.service.ts` | `conversation()`, `clear()`, `dismiss()` ; `apply()` envoie `proposalId` |
| `frontend/src/app/features/ai-assistant/assistant-page/*` | Chargement de la conversation, « Dismiss » et « New conversation » enregistrés ; 2 tests ajoutés, 3 complétés |
| `docs/api.md`, `docs/database.md` (§ 5.8), `docs/ai.md`, `docs/architecture.md` | Documentation |

## 5. Preuves

- Backend : **25 suites, 364 tests** réussis ; ESLint OK.
- Frontend : **59 fichiers, 378 tests** réussis ; lint, format, build OK.
- **Test réel** (seconde instance du backend sur le port 3001, base `smart_project_manager`, Gemini) avec un manager et un projet temporaires, supprimés à la fin :

| Étape | Résultat |
|---|---|
| Conversation au départ | 200, vide |
| « Create a task "Write the API documentation" in the backlog. » | 200, 1 proposition |
| Relecture (= retour sur la page) | question + réponse + proposition `PENDING` |
| Confirm | 201, « Task «Write the API documentation» created. » |
| Confirm une seconde fois | 409 |
| Relecture | `APPLIED` avec son message |
| New conversation | 204, conversation vide |

## 6. Limites

- **Redémarrer le backend** pour activer les nouvelles routes (le serveur lancé avant la correction sert encore l'ancien code).
- Si le manager quitte la page pendant que l'assistant réfléchit, la réponse est quand même enregistrée et apparaît au retour ; sa question n'apparaît qu'une fois la réponse reçue.
- Une seule conversation par manager et par projet (pas d'historique de plusieurs conversations).
