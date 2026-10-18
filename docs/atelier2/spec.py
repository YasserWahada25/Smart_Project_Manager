# -*- coding: utf-8 -*-
"""Modèle de l'Atelier 2 : packages, sous-packages, composants, classes, interfaces.

Source unique utilisée par les diagrammes (diagrams.py) et le document Word (build_docx.py).
Les noms de packages, de classes et de méthodes sont ceux de l'Atelier 3 (code réel du backend).
"""

SVC = "service"
ENT = "entity"
VAL = "value object"
CTL = "control"

PACKAGES = [
    {
        "name": "Identity",
        "fr": ["FR-01 Authentification", "FR-02 Utilisateurs", "FR-03 Profils", "FR-04 Compétences"],
        "role": "Identifier les utilisateurs, gérer leurs comptes, profils et compétences, et contrôler les droits selon le rôle.",
        "provided": [
            ("IAuthentication", "register, login"),
            ("IAuthorization", "authenticate, authorize"),
            ("IUserDirectory", "getUserById, listDevelopers"),
        ],
        "required": [],
        "rows": [[0, 1, 2, 3]],
        "subs": [
            {"name": "Authentication", "comp": "AuthComponent", "classes": [
                {"name": "AuthService", "stereo": SVC, "methods": [
                    "register(data)", "login(email, password)", "buildAuthResponse(user)"]},
                {"name": "TokenService", "stereo": SVC, "methods": [
                    "signAccessToken(user)", "verifyAccessToken(token)"]},
            ]},
            {"name": "Authorization", "comp": "AccessComponent", "classes": [
                {"name": "AccessGuard", "stereo": CTL, "methods": [
                    "authenticate(request)", "authorize(roles)"]},
            ]},
            {"name": "Users", "comp": "UserComponent", "classes": [
                {"name": "UserService", "stereo": SVC, "methods": [
                    "listUsers(filters)", "listDevelopers(filters)", "getUserById(id)",
                    "updateUserStatus(id, active)", "updateUserRole(id, role)"]},
                {"name": "ProfileService", "stereo": SVC, "methods": [
                    "updateProfile(user, data)", "changePassword(user, data)",
                    "replaceSkills(user, skills)"]},
            ]},
            {"name": "Domain model", "comp": "UserModel", "classes": [
                {"name": "User", "stereo": ENT,
                 "attrs": ["email", "passwordHash", "role", "isActive", "skills", "passwordChangedAt"],
                 "methods": ["comparePassword(plain)", "hasRole(role)", "activate()", "deactivate()"]},
                {"name": "Skill", "stereo": VAL,
                 "attrs": ["name", "level", "yearsOfExperience"],
                 "methods": ["validate()"]},
            ]},
        ],
    },
    {
        "name": "Projects",
        "fr": ["FR-05 Projets", "FR-06 Équipes"],
        "role": "Gérer les projets et leurs équipes, centraliser le contrôle d'accès au projet et publier les événements métier.",
        "provided": [
            ("IProjectAccess", "canViewProject, assertManager"),
            ("IProjectService", "createProject, addMember"),
            ("IDomainEvents", "publish, subscribe"),
        ],
        "required": [("IUserDirectory", "Identity"), ("IAuthorization", "Identity")],
        "rows": [[0, 1, 2]],
        "subs": [
            {"name": "Project management", "comp": "ProjectComponent", "classes": [
                {"name": "ProjectService", "stereo": SVC, "methods": [
                    "createProject(manager, data)", "listProjects(user, filters)",
                    "getProject(user, id)", "updateProject(user, id, data)",
                    "deleteProject(user, id)", "addMember(user, id, userId)",
                    "removeMember(user, id, userId)"]},
                {"name": "Project", "stereo": ENT,
                 "attrs": ["name", "description", "startDate", "deadline", "status",
                           "technologies", "manager", "members"],
                 "methods": ["changeStatus(status)", "isManager(user)", "hasMember(user)",
                             "isArchived()"]},
            ]},
            {"name": "Access control", "comp": "ProjectAccessComponent", "classes": [
                {"name": "ProjectAccessService", "stereo": SVC, "methods": [
                    "canViewProject(user, project)", "assertManager(user, project)",
                    "assertNotArchived(project)", "findManagedProject(user, id)"]},
            ]},
            {"name": "Domain events", "comp": "EventComponent", "classes": [
                {"name": "EventBus", "stereo": CTL, "methods": [
                    "publish(event)", "subscribe(listener)"]},
                {"name": "DomainEvent", "stereo": VAL,
                 "attrs": ["type", "actor", "project", "task", "sprint", "targetUser", "details"],
                 "methods": ["describe()"]},
            ]},
        ],
    },
    {
        "name": "Sprints",
        "fr": ["FR-07 Sprints"],
        "role": "Planifier les sprints d'un projet, piloter leur cycle de vie et calculer leur avancement.",
        "provided": [("ISprintQuery", "getSprint, computeSprintStats")],
        "required": [("IProjectAccess", "Projects"), ("IDomainEvents", "Projects")],
        "rows": [[0, 1]],
        "subs": [
            {"name": "Lifecycle", "comp": "SprintComponent", "classes": [
                {"name": "SprintService", "stereo": SVC, "methods": [
                    "createSprint(user, data)", "updateSprint(user, id, data)",
                    "changeSprintStatus(user, id, status)", "computeSprintStats(sprint)",
                    "deleteSprint(user, id)"]},
                {"name": "Sprint", "stereo": ENT,
                 "attrs": ["name", "objective", "project", "startDate", "endDate", "status",
                           "completedAt"],
                 "methods": ["start()", "complete()", "cancel()", "isOpen()",
                             "canTransitionTo(status)"]},
            ]},
            {"name": "Statistics", "comp": "SprintStatsComponent", "classes": [
                {"name": "SprintStats", "stereo": VAL,
                 "attrs": ["totalPoints", "donePoints", "taskCount", "blockedCount"],
                 "methods": ["progress()", "remainingPoints()"]},
            ]},
        ],
    },
    {
        "name": "Tasks",
        "fr": ["FR-08 Tâches", "FR-09 Tableau Kanban"],
        "role": "Gérer les tâches, leur affectation et leur workflow, et fournir la vue Kanban.",
        "provided": [("ITaskManagement", "createTask, assignTask, changeTaskStatus")],
        "required": [("IProjectAccess", "Projects"), ("IDomainEvents", "Projects"),
                     ("ISprintQuery", "Sprints")],
        "rows": [[0, 1, 2]],
        "subs": [
            {"name": "Task management", "comp": "TaskComponent", "classes": [
                {"name": "TaskService", "stereo": SVC, "methods": [
                    "createTask(user, data)", "updateTask(user, id, data)",
                    "changeTaskStatus(user, id, status)", "assignTask(user, id, userId)",
                    "listTasks(user, filters)", "listMyTasks(user)"]},
                {"name": "Task", "stereo": ENT,
                 "attrs": ["title", "description", "type", "priority", "complexity", "status",
                           "blockedReason", "deadline", "requiredSkills", "project", "sprint",
                           "assignee"],
                 "methods": ["moveTo(status)", "assignTo(user)", "block(reason)", "unblock()",
                             "isOverdue()"]},
            ]},
            {"name": "Workflow", "comp": "WorkflowComponent", "classes": [
                {"name": "TaskWorkflow", "stereo": CTL, "methods": [
                    "allowedTransitions(status)", "canTransition(from, to)",
                    "requiresAssignee(status)"]},
            ]},
            {"name": "Board", "comp": "BoardComponent", "classes": [
                {"name": "BoardService", "stereo": SVC, "methods": ["getBoard(user, projectId)"]},
                {"name": "Board", "stereo": VAL,
                 "attrs": ["scope", "columns"],
                 "methods": ["groupByStatus(tasks)", "countOf(status)"]},
            ]},
        ],
    },
    {
        "name": "Collaboration",
        "fr": ["FR-10 Commentaires", "FR-11 Historique d'activité", "FR-12 Notifications"],
        "role": "Permettre les échanges sur les tâches, tracer les événements et informer les utilisateurs concernés.",
        "provided": [("ICommentService", "addComment, listComments"),
                     ("IActivityLog", "record, listProjectActivities"),
                     ("INotificationInbox", "listNotifications, markAsRead")],
        "required": [("IProjectAccess", "Projects"), ("IDomainEvents", "Projects"),
                     ("ITaskManagement", "Tasks")],
        "rows": [[0, 1, 2]],
        "subs": [
            {"name": "Comments", "comp": "CommentComponent", "classes": [
                {"name": "CommentService", "stereo": SVC, "methods": [
                    "listComments(user, taskId)", "addComment(user, taskId, content)",
                    "updateComment(user, id, content)", "deleteComment(user, id)"]},
                {"name": "Comment", "stereo": ENT,
                 "attrs": ["content", "author", "task", "editedAt"],
                 "methods": ["edit(content)", "isAuthor(user)"]},
            ]},
            {"name": "History", "comp": "ActivityComponent", "classes": [
                {"name": "ActivityService", "stereo": SVC, "methods": [
                    "record(event)", "onActivity(listener)",
                    "listProjectActivities(user, id)", "changedFields(before, after)"]},
                {"name": "Activity", "stereo": ENT,
                 "attrs": ["type", "actor", "project", "task", "sprint", "targetUser", "details",
                           "createdAt"],
                 "methods": ["describe()"]},
            ]},
            {"name": "Notifications", "comp": "NotificationComponent", "classes": [
                {"name": "NotificationService", "stereo": SVC, "methods": [
                    "registerActivityListener()", "buildNotifications(activity)",
                    "notifyFromActivity(activity)", "listNotifications(user)",
                    "markAsRead(user, id)", "markAllAsRead(user)", "countUnread(user)"]},
                {"name": "Notification", "stereo": ENT,
                 "attrs": ["recipient", "type", "message", "link", "read", "createdAt"],
                 "methods": ["markRead()", "isFor(user)"]},
            ]},
        ],
    },
    {
        "name": "Insight",
        "fr": ["FR-13 Tableaux de bord", "FR-14 Recherche et filtres"],
        "role": "Calculer les indicateurs de pilotage et rechercher projets et tâches visibles par l'utilisateur.",
        "provided": [("IDashboard", "getDashboard, getProjectDashboard"),
                     ("ISearch", "search")],
        "required": [("IProjectAccess", "Projects"), ("ITaskManagement", "Tasks"),
                     ("ISprintQuery", "Sprints")],
        "rows": [[0, 1]],
        "subs": [
            {"name": "Dashboard", "comp": "DashboardComponent", "classes": [
                {"name": "DashboardService", "stereo": SVC, "methods": [
                    "getDashboard(user)", "getProjectDashboard(user, id)",
                    "taskIndicators(filter)", "workload(projectId)", "activeSprints(user)"]},
                {"name": "Indicators", "stereo": VAL,
                 "attrs": ["totalProjects", "activeProjects", "totalTasks", "doneTasks",
                           "overdueTasks", "blockedTasks", "byStatus", "byPriority"],
                 "methods": ["completionRate()"]},
            ]},
            {"name": "Search", "comp": "SearchComponent", "classes": [
                {"name": "SearchService", "stereo": SVC, "methods": ["search(user, query)"]},
                {"name": "SearchResult", "stereo": VAL,
                 "attrs": ["projects", "tasks"],
                 "methods": ["isEmpty()"]},
            ]},
        ],
    },
    {
        "name": "AI",
        "fr": ["FR-15 IA", "AI-01 Plan du projet", "AI-02 Recommandation", "AI-03 Risque de retard",
               "AI-04 Assistant"],
        "role": "Orchestrer les fonctionnalités d'IA : le backend prépare les données, appelle le service IA, valide la réponse puis l'applique.",
        "provided": [("IAiFeatures", "generatePlan, predictSprintRisk, chat")],
        "required": [("IProjectAccess", "Projects"), ("ITaskManagement", "Tasks"),
                     ("ISprintQuery", "Sprints"), ("IAiApi", "Service IA")],
        "rows": [[0, 1, 2], [3, 4]],
        "subs": [
            {"name": "Gateway", "comp": "AiGatewayComponent", "classes": [
                {"name": "AiClientService", "stereo": SVC, "methods": [
                    "request(path, body)", "getStatus()"]},
            ]},
            {"name": "Planning (AI-01)", "comp": "PlanComponent", "classes": [
                {"name": "AiPlanService", "stereo": SVC, "methods": [
                    "generatePlan(user, project, spec)", "extractDocument(file)",
                    "parseAiPlan(raw)", "applyPlan(user, project, plan)"]},
                {"name": "ProjectPlan", "stereo": VAL,
                 "attrs": ["sprints", "backlog", "warnings"],
                 "methods": ["validate()", "totalPoints()"]},
            ]},
            {"name": "Recommendation (AI-02)", "comp": "RecommendationComponent", "classes": [
                {"name": "AiRecommendationService", "stereo": SVC, "methods": [
                    "recommendDevelopers(user, taskId)", "workloads(project)",
                    "experiences(project)"]},
                {"name": "DeveloperRecommendation", "stereo": VAL,
                 "attrs": ["developer", "score", "matchingSkills", "missingSkills",
                           "explanation"],
                 "methods": ["compareTo(other)"]},
            ]},
            {"name": "Risk (AI-03)", "comp": "RiskComponent", "classes": [
                {"name": "AiRiskService", "stereo": SVC, "methods": [
                    "predictSprintRisk(user, sprintId)", "historicalVelocity(project)"]},
                {"name": "SprintRisk", "stereo": VAL,
                 "attrs": ["level", "probability", "factors"],
                 "methods": ["isHigh()"]},
            ]},
            {"name": "Assistant (AI-04)", "comp": "AssistantComponent", "classes": [
                {"name": "AiAssistantService", "stereo": SVC, "methods": [
                    "chat(user, project, messages)", "runTool(name, args)",
                    "executeAction(user, action)", "assertAssistantAvailable()"]},
                {"name": "ProposedAction", "stereo": VAL,
                 "attrs": ["type", "arguments", "status"],
                 "methods": ["confirm()", "dismiss()"]},
            ]},
        ],
    },
]

# (source, cible, interfaces)
DEPENDENCIES = [
    ("Projects", "Identity", "IUserDirectory, IAuthorization"),
    ("Sprints", "Projects", "IProjectAccess, IDomainEvents"),
    ("Tasks", "Projects", "IProjectAccess, IDomainEvents"),
    ("Tasks", "Sprints", "ISprintQuery"),
    ("Collaboration", "Projects", "IProjectAccess, IDomainEvents"),
    ("Collaboration", "Tasks", "ITaskManagement"),
    ("Insight", "Tasks", "ITaskManagement"),
    ("Insight", "Sprints", "ISprintQuery"),
    ("AI", "Projects", "IProjectAccess"),
    ("AI", "Tasks", "ITaskManagement"),
    ("AI", "Sprints", "ISprintQuery"),
    ("AI", "Service IA (externe)", "IAiApi"),
    ("Service IA (externe)", "Fournisseur LLM (externe)", "ILlmApi"),
]

# (interface, fournie par, opérations, utilisée par)
INTERFACES = [
    ("IAuthentication", "Identity", "register(data), login(email, password)", "Interface web (REST)"),
    ("IAuthorization", "Identity", "authenticate(request), authorize(roles)", "Projects, tous les contrôleurs"),
    ("IUserDirectory", "Identity", "getUserById(id), listDevelopers(filters)", "Projects"),
    ("IProjectAccess", "Projects", "canViewProject, assertManager, assertNotArchived, findManagedProject", "Sprints, Tasks, Collaboration, AI"),
    ("IProjectService", "Projects", "createProject, listProjects, addMember, removeMember…", "Interface web (REST)"),
    ("IDomainEvents", "Projects", "publish(event), subscribe(listener)", "Sprints, Tasks (publient) ; Collaboration (s'abonne)"),
    ("ISprintQuery", "Sprints", "getSprint(id), computeSprintStats(sprint)", "Tasks, Insight, AI"),
    ("ITaskManagement", "Tasks", "createTask, assignTask, changeTaskStatus", "Collaboration, Insight, AI"),
    ("ICommentService", "Collaboration", "addComment, listComments, updateComment, deleteComment", "Interface web (REST)"),
    ("IActivityLog", "Collaboration", "record(event), listProjectActivities(user, id)", "Interface web (REST)"),
    ("INotificationInbox", "Collaboration", "listNotifications, markAsRead, countUnread", "Interface web (REST)"),
    ("IDashboard", "Insight", "getDashboard(user), getProjectDashboard(user, id)", "Interface web (REST)"),
    ("ISearch", "Insight", "search(user, query)", "Interface web (REST)"),
    ("IAiFeatures", "AI", "generatePlan, recommendDevelopers, predictSprintRisk, chat", "Interface web (REST)"),
    ("IAiApi", "Service IA (externe)", "/ai/projects/plan, /ai/developers/recommend, /ai/sprints/predict-risk, /ai/assistant/chat", "AI (AiClientService)"),
    ("ILlmApi", "Fournisseur LLM (externe)", "API de complétion (facultative)", "Service IA"),
]
