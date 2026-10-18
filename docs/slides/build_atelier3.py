"""Atelier 3 - Vue building block de Smart Project Manager (python-pptx)."""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn
from lxml import etree

NAVY = RGBColor(0x0F, 0x1B, 0x3D)
TEAL = RGBColor(0x14, 0xB8, 0xA6)
TEAL_D = RGBColor(0x0E, 0x7F, 0x74)
WHITE = RGBColor(255, 255, 255)
LIGHT = RGBColor(0xF3, 0xF6, 0xFA)
GREY = RGBColor(0x4B, 0x55, 0x63)
MID = RGBColor(0xD5, 0xDC, 0xE6)
AMBER = RGBColor(0xF5, 0x9E, 0x0B)
SOFT_T = RGBColor(0xDD, 0xF5, 0xF2)
SOFT_N = RGBColor(0xE3, 0xE8, 0xF3)
SOFT_A = RGBColor(0xFD, 0xF0, 0xD5)

p = Presentation()
p.slide_width = Inches(13.333)
p.slide_height = Inches(7.5)
blank = p.slide_layouts[6]
counter = [0]


def rect(s, x, y, w, h, fill, line=None, shape=MSO_SHAPE.RECTANGLE, lw=1.0):
    r = s.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    r.shadow.inherit = False
    if fill is None:
        r.fill.background()
    else:
        r.fill.solid()
        r.fill.fore_color.rgb = fill
    if line is None:
        r.line.fill.background()
    else:
        r.line.color.rgb = line
        r.line.width = Pt(lw)
    return r


def text(s, x, y, w, h, t, size=16, color=GREY, bold=False, align=None,
         anchor=None, italic=False, space=4, font="Calibri"):
    tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Inches(0.05)
    tf.margin_top = tf.margin_bottom = Inches(0.03)
    if anchor:
        tf.vertical_anchor = anchor
    lines = t if isinstance(t, list) else [t]
    for i, l in enumerate(lines):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        r = para.add_run()
        r.text = l
        r.font.size = Pt(size)
        r.font.color.rgb = color
        r.font.bold = bold
        r.font.italic = italic
        r.font.name = font
        para.space_after = Pt(space)
        if align:
            para.alignment = align
    return tb


def label_box(s, x, y, w, h, t, fill, fg=WHITE, size=16, bold=True, line=None,
              shape=MSO_SHAPE.ROUNDED_RECTANGLE):
    r = rect(s, x, y, w, h, fill, line, shape)
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        r.adjustments[0] = 0.12
    tf = r.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = tf.margin_right = Inches(0.08)
    lines = t if isinstance(t, list) else [t]
    for i, l in enumerate(lines):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.alignment = PP_ALIGN.CENTER
        run = para.add_run()
        run.text = l
        run.font.size = Pt(size if i == 0 else size - 3)
        run.font.bold = bold if i == 0 else False
        run.font.color.rgb = fg
        run.font.name = "Calibri"
    return r


def slide(title, kicker=None):
    counter[0] += 1
    s = p.slides.add_slide(blank)
    rect(s, 0, 0, 13.333, 7.5, LIGHT)
    rect(s, 0, 0, 13.333, 1.15, NAVY)
    if kicker:
        text(s, 0.6, 0.12, 9, 0.3, kicker.upper(), 11, TEAL, True)
    text(s, 0.6, 0.38, 12.2, 0.7, title, 28, WHITE, True, anchor=MSO_ANCHOR.MIDDLE)
    text(s, 12.2, 7.05, 0.8, 0.3, str(counter[0] + 1), 11, GREY, align=PP_ALIGN.RIGHT)
    text(s, 0.6, 7.05, 8, 0.3, "Atelier 3 \u2013 Smart Project Manager \u2013 Vue building block", 10, GREY)
    return s


def arrow(s, x1, y1, x2, y2, color=NAVY, dashed=False, width=2.0, both=False):
    c = s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    c.line.color.rgb = color
    c.line.width = Pt(width)
    ln = c.line._get_or_add_ln()
    if dashed:
        d = etree.SubElement(ln, qn("a:prstDash"))
        d.set("val", "dash")
    tail = etree.SubElement(ln, qn("a:tailEnd"))
    tail.set("type", "triangle")
    if both:
        head = etree.SubElement(ln, qn("a:headEnd"))
        head.set("type", "triangle")
    return c


def tag(s, x, y, w, t, size=12, color=TEAL_D):
    text(s, x, y, w, 0.3, t, size, color, True, align=PP_ALIGN.CENTER)


def uml(s, x, y, w, name, stereo, attrs=None, methods=None, hdr=NAVY, size=12, fill=WHITE):
    """UML class box: header (name + stereotype), attributes, methods."""
    attrs = attrs or []
    methods = methods or []
    lh = 0.245
    hh = 0.62
    ah = (len(attrs) * lh + 0.12) if attrs else 0
    mh = (len(methods) * lh + 0.12) if methods else 0
    total = hh + ah + mh
    rect(s, x, y, w, total, fill, hdr, lw=1.25)
    r = rect(s, x, y, w, hh, hdr)
    tf = r.text_frame
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_top = tf.margin_bottom = 0
    pa = tf.paragraphs[0]
    pa.alignment = PP_ALIGN.CENTER
    ru = pa.add_run()
    ru.text = stereo
    ru.font.size = Pt(10)
    ru.font.color.rgb = TEAL if hdr == NAVY else WHITE
    ru.font.name = "Calibri"
    pb = tf.add_paragraph()
    pb.alignment = PP_ALIGN.CENTER
    rn = pb.add_run()
    rn.text = name
    rn.font.size = Pt(14)
    rn.font.bold = True
    rn.font.color.rgb = WHITE
    rn.font.name = "Calibri"
    yy = y + hh
    if attrs:
        text(s, x + 0.05, yy + 0.04, w - 0.1, ah, ["- " + a for a in attrs], size, GREY, space=0, font="Consolas")
        yy += ah
        ln = s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x), Inches(yy), Inches(x + w), Inches(yy))
        ln.line.color.rgb = hdr
        ln.line.width = Pt(0.75)
    if methods:
        text(s, x + 0.05, yy + 0.04, w - 0.1, mh, ["+ " + m for m in methods], size, NAVY, space=0, font="Consolas")
    return total


def card(s, x, y, w, h, head, body, accent=TEAL, size=14, fill=WHITE):
    rect(s, x, y, w, h, fill, MID)
    c = rect(s, x + 0.2, y + 0.2, 0.42, 0.42, accent, shape=MSO_SHAPE.OVAL)
    text(s, x + 0.78, y + 0.15, w - 0.95, 0.55, head, 16, NAVY, True, anchor=MSO_ANCHOR.MIDDLE)
    text(s, x + 0.2, y + 0.82, w - 0.4, h - 0.9, body, size, GREY, space=3)
    return c


# ------------------------------------------------------------------ 1. Titre
counter[0] += 1
s = p.slides.add_slide(blank)
rect(s, 0, 0, 13.333, 7.5, NAVY)
rect(s, 0.8, 1.55, 0.14, 2.3, TEAL)
text(s, 1.15, 1.2, 10, 0.4, "ATELIER 3  \u2013  ARCHITECTURE LOGICIELLE", 16, TEAL, True)
text(s, 1.15, 1.75, 11, 1.2, "Smart Project Manager", 54, WHITE, True)
text(s, 1.15, 2.95, 11, 1.0,
     "Modélisation de la vue building block du projet", 28, RGBColor(0xCB, 0xD5, 0xE1))
text(s, 1.15, 5.6, 9, 0.8, ["ESPRIT University", "Travail de groupe \u2013 Atelier 3 \u2013 Semaine 3"], 16,
     RGBColor(0x94, 0xA3, 0xB8))
for i, (n, c) in enumerate([("Angular", TEAL), ("Express", TEAL), ("MongoDB", TEAL), ("FastAPI", TEAL)]):
    label_box(s, 8.2 + (i % 2) * 2.35, 4.6 + (i // 2) * 0.85, 2.15, 0.65, n, NAVY, TEAL, 16, line=TEAL)

# ------------------------------------------------------------------ 2. Objectifs
s = slide("Objectifs et démarche de l'atelier", "Introduction")
steps = [
    ("1", "Packages", "Modéliser les exigences fonctionnelles de l'atelier 1 (FR-01 à FR-15) par des packages."),
    ("2", "Raffinement", "Descendre du système vers ses blocs : black box puis white box, avec sous-packages, composants et classes."),
    ("3", "Interactions", "Définir les liens de dépendance et les interfaces fournies / requises entre les blocs."),
    ("4", "Méthodes", "Ajouter les méthodes aux classes principales de chaque package."),
]
for i, (n, h, b) in enumerate(steps):
    x = 0.6 + i * 3.1
    rect(s, x, 1.7, 2.9, 3.4, WHITE, MID)
    label_box(s, x + 0.25, 1.95, 0.7, 0.7, n, TEAL, WHITE, 26, shape=MSO_SHAPE.OVAL)
    text(s, x + 0.2, 2.8, 2.5, 0.5, h, 20, NAVY, True)
    text(s, x + 0.2, 3.35, 2.5, 1.7, b, 14, GREY)
    if i < 3:
        arrow(s, x + 2.92, 3.4, x + 3.08, 3.4, TEAL, width=2.5)
rect(s, 0.6, 5.5, 12.1, 1.15, SOFT_T)
text(s, 0.85, 5.6, 11.6, 0.95,
     ["Principe : black box = ce que fait un bloc et par quelles interfaces ; white box = comment il est composé en interne.",
      "Le projet a trois blocs exécutables (frontend, backend, service IA) et une base de données : la vue est donc hiérarchique."],
     15, NAVY, space=4, anchor=MSO_ANCHOR.MIDDLE)

# ------------------------------------------------------------------ 3. Exigences -> packages
s = slide("Des exigences fonctionnelles aux packages", "Étape 1")
rows = [
    ("Identity", "FR-01 Authentification \u00b7 FR-02 Utilisateurs \u00b7 FR-03 Profils \u00b7 FR-04 Compétences"),
    ("Projects", "FR-05 Projets \u00b7 FR-06 Équipes"),
    ("Sprints", "FR-07 Sprints"),
    ("Tasks", "FR-08 Tâches \u00b7 FR-09 Kanban"),
    ("Collaboration", "FR-10 Commentaires \u00b7 FR-11 Historique d'activité \u00b7 FR-12 Notifications"),
    ("Insight", "FR-13 Tableaux de bord \u00b7 FR-14 Recherche et filtres"),
    ("AI", "FR-15 IA : AI-01 plan, AI-02 recommandation, AI-03 risque de retard, AI-04 assistant"),
]
for i, (pk, fr) in enumerate(rows):
    y = 1.5 + i * 0.77
    label_box(s, 0.6, y, 2.5, 0.64, pk, NAVY if i < 6 else TEAL_D, WHITE, 17)
    arrow(s, 3.12, y + 0.32, 3.55, y + 0.32, TEAL, width=2.5)
    rect(s, 3.6, y, 9.1, 0.64, WHITE, MID)
    text(s, 3.75, y, 8.9, 0.64, fr, 14, GREY, anchor=MSO_ANCHOR.MIDDLE)

# ------------------------------------------------------------------ 4. Niveau 0
s = slide("Niveau 0 \u2013 Black box du système", "Vue building block")
label_box(s, 4.9, 2.9, 3.5, 1.7, ["Smart Project Manager", "Plateforme de gestion de projets logiciels"], NAVY, WHITE, 22)
actors = [("Administrateur", "Gère utilisateurs, rôles, comptes", 1.7),
          ("Chef de projet", "Projets, sprints, tâches, IA", 3.2),
          ("Développeur", "Tâches, commentaires, profil", 4.7)]
for n, d, y in actors:
    rect(s, 0.6, y - 0.35, 3.2, 1.1, WHITE, MID)
    text(s, 0.75, y - 0.3, 2.9, 0.4, n, 17, NAVY, True)
    text(s, 0.75, y + 0.1, 2.9, 0.6, d, 13, GREY)
    arrow(s, 3.82, y + 0.2, 4.88, 3.75, TEAL, width=2)
tag(s, 3.0, 5.45, 2.3, "Interface web (HTTPS)")
rect(s, 9.4, 3.05, 3.3, 1.4, SOFT_A, AMBER)
text(s, 9.5, 3.1, 3.1, 0.4, "Fournisseur LLM (OpenAI)", 15, NAVY, True, align=PP_ALIGN.CENTER)
text(s, 9.5, 3.55, 3.1, 0.8, "Système externe, optionnel : un analyseur local prend le relais s'il est absent",
     12, GREY, align=PP_ALIGN.CENTER)
arrow(s, 8.42, 3.75, 9.38, 3.75, AMBER, width=2.5)
tag(s, 8.3, 3.2, 1.3, "API LLM", 12, AMBER)
rect(s, 0.6, 5.95, 12.1, 0.85, SOFT_T)
text(s, 0.85, 5.95, 11.6, 0.85,
     "Interfaces fournies : interface web pour les trois rôles (JWT).   Interfaces requises : API du fournisseur LLM (facultative).",
     14, NAVY, anchor=MSO_ANCHOR.MIDDLE)

# ------------------------------------------------------------------ 5. Niveau 1
s = slide("Niveau 1 \u2013 White box : les blocs du système", "Vue building block")
bw, bh = 2.7, 1.65
blocks = [
    (0.6, 2.2, "Frontend", "Angular \u00b7 TypeScript", NAVY),
    (4.0, 2.2, "Backend", "Express.js \u00b7 API REST", NAVY),
    (8.0, 1.45, "Service IA", "FastAPI \u00b7 Python", TEAL_D),
    (8.0, 3.7, "MongoDB", "Mongoose \u00b7 7 collections", RGBColor(0x2D, 0x6A, 0x4F)),
]
for x, y, n, d, c in blocks:
    label_box(s, x, y, bw, bh, [n, d], c, WHITE, 22)
rect(s, 11.4, 1.77, 1.6, 1.0, SOFT_A, AMBER)
text(s, 11.4, 1.77, 1.6, 1.0, ["LLM", "(externe)"], 14, NAVY, True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
arrow(s, 3.32, 3.0, 3.98, 3.0, NAVY, both=True)
tag(s, 3.0, 3.1, 1.2, "REST/JSON", 11)
arrow(s, 6.72, 2.7, 7.98, 2.3, NAVY, both=True)
arrow(s, 6.72, 3.4, 7.98, 4.5, NAVY, both=True)
arrow(s, 10.72, 2.27, 11.38, 2.27, AMBER, dashed=True, both=True)
text(s, 0.45, 4.05, 3.2, 0.3, "JWT bearer", 11, TEAL_D, True, align=PP_ALIGN.CENTER)
text(s, 6.55, 1.5, 1.4, 0.5, "REST + jeton de service", 11, TEAL_D, True)
text(s, 6.9, 4.2, 1.1, 0.3, "Mongoose", 11, TEAL_D, True)
rect(s, 0.6, 5.5, 12.1, 1.3, WHITE, MID)
text(s, 0.85, 5.55, 11.7, 1.2,
     ["Règles de dépendance :",
      "1. Le frontend ne parle qu'au backend.   2. Seul le backend lit et écrit dans MongoDB.",
      "3. Le service IA est sans état, jamais exposé au navigateur et n'accède pas à la base."],
     14, GREY, space=3)

# ------------------------------------------------------------------ 6. Interfaces
s = slide("Interfaces entre les blocs", "Étape 3")
hdrs = ["Interface", "Fournie par", "Requise par", "Contrat"]
cw = [3.0, 2.2, 2.4, 4.5]
xs = [0.6]
for w in cw[:-1]:
    xs.append(xs[-1] + w)
for i, h in enumerate(hdrs):
    label_box(s, xs[i], 1.45, cw[i] - 0.05, 0.5, h, NAVY, WHITE, 14, shape=MSO_SHAPE.RECTANGLE)
irows = [
    ("API REST publique /api/v1", "Backend", "Frontend", "JSON, JWT en en-tête Bearer, rôles ADMIN / PROJECT_MANAGER / DEVELOPER"),
    ("Persistance (modèles Mongoose)", "MongoDB", "Backend", "7 collections : users, projects, sprints, tasks, comments, activities, notifications"),
    ("API IA /api/v1/ai/*", "Service IA", "Backend (AiClient)", "plan, recommandation, risque, assistant, extraction ; jeton de service ; délai limité"),
    ("Contrôle d'état /api/v1/health", "Backend, Service IA", "Frontend, Backend", "Statut de chaque bloc affiché sur la page d'accueil"),
    ("API LLM", "Fournisseur OpenAI", "Service IA (OpenAiClient)", "Facultative : repli sur l'analyseur local"),
]
for r, row in enumerate(irows):
    y = 2.05 + r * 0.9
    for i, v in enumerate(row):
        rect(s, xs[i], y, cw[i] - 0.05, 0.82, WHITE if r % 2 == 0 else SOFT_N, MID)
        text(s, xs[i] + 0.05, y, cw[i] - 0.15, 0.82, v, 13, NAVY if i == 0 else GREY, i == 0, anchor=MSO_ANCHOR.MIDDLE)
text(s, 0.6, 6.6, 12, 0.4, "Le backend est la seule passerelle : il valide chaque réponse de l'IA avant de la persister ou de la retourner.",
     13, TEAL_D, True, italic=True)

# ------------------------------------------------------------------ 7. Niveau 2 backend packages
s = slide("Niveau 2 \u2013 Packages du backend et dépendances", "White box du backend")
pw, ph = 3.4, 0.95
rows3 = {
    0: [("Insight", "Dashboard \u00b7 Search", 0.9), ("Collaboration", "Comments \u00b7 Activity \u00b7 Notifications", 4.95),
        ("AI Gateway", "AiPlan \u00b7 AiRecommendation \u00b7 AiRisk \u00b7 AiAssistant", 9.0)],
    1: [("Tasks", "Tâches \u00b7 Kanban", 2.9), ("Sprints", "Sprints \u00b7 Statistiques", 7.0)],
    2: [("Projects", "Projets \u00b7 Équipes \u00b7 Contrôle d'accès", 4.95)],
    3: [("Identity", "Auth \u00b7 Users \u00b7 Profile \u00b7 Token", 4.95)],
}
ys = {0: 1.45, 1: 3.0, 2: 4.45, 3: 5.8}
pos = {}
for r, items in rows3.items():
    for n, sub, x in items:
        fill = TEAL_D if n == "AI Gateway" else NAVY
        label_box(s, x, ys[r], pw, ph, [n, sub], fill, WHITE, 18, shape=MSO_SHAPE.RECTANGLE)
        pos[n] = (x, ys[r])


def dep(a, b, dx1=0.0, dx2=0.0, color=NAVY):
    ax, ay = pos[a]
    bx, by = pos[b]
    arrow(s, ax + pw / 2 + dx1, ay + ph, bx + pw / 2 + dx2, by, color, dashed=True, width=1.75)


dep("Insight", "Tasks", -0.6, -0.5)
dep("Insight", "Sprints", 0.6, -0.5)
dep("Collaboration", "Tasks", -0.6, 0.4)
dep("AI Gateway", "Sprints", -0.6, 0.5)
dep("AI Gateway", "Tasks", -1.0, 0.9)
dep("Tasks", "Projects", 0.0, -0.7)
dep("Sprints", "Projects", 0.0, 0.7)
dep("Projects", "Identity", 0.0, 0.0)
rect(s, 0.6, 3.0, 2.0, 3.75, WHITE, MID)
text(s, 0.7, 3.05, 1.8, 3.6,
     ["Lecture", "Flèche pointillée = « dépend de ».", "", "Les dépendances vont toujours vers le bas : aucun cycle.",
      "", "Collaboration écoute les événements d'activité (observateur)."],
     12, GREY, space=2)
rect(s, 9.0, 4.45, 3.7, 2.3, SOFT_T)
text(s, 9.15, 4.5, 3.4, 2.2,
     ["Pourquoi cette découpe ?", "Chaque package correspond à un ou deux modules fonctionnels.",
      "Identity et Projects portent le contrôle d'accès, réutilisé par tous les autres.",
      "Un changement dans Insight ou AI n'impacte pas le cœur métier."],
     12, NAVY, space=5)

# ------------------------------------------------------------------ 8. Backend layers
s = slide("White box du backend \u2013 architecture en couches", "Raffinement")
layers = [
    ("routes/", "Déclare les points d'entrée REST, enchaîne les middlewares", NAVY),
    ("middleware/", "authenticate \u00b7 authorize \u00b7 validate \u00b7 upload \u00b7 errorHandler", NAVY),
    ("controllers/", "Traduit HTTP \u2194 appels de services (12 contrôleurs)", NAVY),
    ("services/", "Règles métier, droits, orchestration, appels IA", TEAL_D),
    ("models/", "Schémas Mongoose : User, Project, Sprint, Task, Comment, Activity, Notification", RGBColor(0x2D, 0x6A, 0x4F)),
]
for i, (n, d, c) in enumerate(layers):
    y = 1.5 + i * 1.0
    label_box(s, 0.6, y, 2.4, 0.78, n, c, WHITE, 18, shape=MSO_SHAPE.RECTANGLE)
    rect(s, 3.0, y, 5.6, 0.78, WHITE, MID)
    text(s, 3.12, y, 5.4, 0.78, d, 13, GREY, anchor=MSO_ANCHOR.MIDDLE)
    if i < 4:
        arrow(s, 1.8, y + 0.78, 1.8, y + 1.0, TEAL, width=2)
rect(s, 9.0, 1.5, 3.7, 1.55, SOFT_N)
text(s, 9.15, 1.55, 3.4, 1.45, ["Transversal", "validators/ : validation des entrées par module",
                                "utils/ : ApiError, logger, pagination", "config/ : env, database"], 12, NAVY, space=3)
rect(s, 9.0, 3.25, 3.7, 3.05, SOFT_T)
text(s, 9.15, 3.3, 3.4, 2.95, ["Règles de la white box", "Un contrôleur n'accède jamais à un modèle directement.",
                               "Les règles métier vivent uniquement dans les services.",
                               "Les modèles ne connaissent pas les services.",
                               "Les erreurs passent par ApiError puis errorHandler."], 12, NAVY, space=5)

# ------------------------------------------------------------------ 9. Classes Identity & Projects
s = slide("Classes \u2013 Identity et Projects", "Étape 4 \u00b7 Méthodes")
w = 3.9
uml(s, 0.6, 1.4, w, "AuthService", "<<service>>", methods=["register(data)", "login(email, password)", "buildAuthResponse(user)"])
uml(s, 0.6, 3.25, w, "TokenService", "<<service>>", methods=["signAccessToken(user)", "verifyAccessToken(token)"])
uml(s, 4.7, 1.4, w, "UserService", "<<service>>",
    methods=["listUsers(filters)", "listDevelopers(filters)", "getUserById(id)", "updateUserStatus(id, active)", "updateUserRole(id, role)"])
uml(s, 4.7, 4.1, w, "ProfileService", "<<service>>", methods=["updateProfile(user, data)", "changePassword(user, data)", "replaceSkills(user, skills)"])
uml(s, 8.8, 1.4, w, "ProjectService", "<<service>>",
    methods=["createProject(manager, data)", "listProjects(user, filters)", "getProject(user, id)", "updateProject(user, id, data)",
             "deleteProject(user, id)", "addMember(user, id, userId)", "removeMember(user, id, userId)"])
uml(s, 8.8, 4.3, w, "ProjectAccessService", "<<interface fournie>>",
    methods=["canViewProject(user, project)", "assertManager(user, project)", "assertNotArchived(project)", "findManagedProject(user, id)"],
    hdr=TEAL_D)
arrow(s, 2.55, 3.23, 2.55, 2.8, NAVY, dashed=True, width=1.5)
arrow(s, 10.75, 4.28, 10.75, 3.9, TEAL_D, dashed=True, width=1.75)
text(s, 0.6, 5.5, 3.9, 1.3, ["AuthService utilise TokenService ; ProjectService s'appuie sur ProjectAccessService, que tous les autres packages réutilisent."],
     12, TEAL_D, True, italic=True)

# ------------------------------------------------------------------ 10. Classes Sprints & Tasks
s = slide("Classes \u2013 Sprints et Tasks", "Étape 4 \u00b7 Méthodes")
uml(s, 0.6, 1.4, 3.7, "Sprint", "<<model>>", attrs=["name, objective", "project", "startDate, endDate", "status, completedAt"])
uml(s, 0.6, 3.55, 3.7, "SprintService", "<<service>>",
    methods=["createSprint(user, data)", "updateSprint(user, id, data)", "changeSprintStatus(user, id, status)",
             "computeSprintStats(sprint)", "deleteSprint(user, id)"])
uml(s, 4.7, 1.4, 4.0, "Task", "<<model>>",
    attrs=["title, description", "type, priority, complexity", "status, blockedReason", "deadline, requiredSkills", "project, sprint, assignee"])
uml(s, 4.7, 3.8, 4.0, "TaskService", "<<service>>",
    methods=["createTask(user, data)", "updateTask(user, id, data)", "changeTaskStatus(user, id, status)", "assignTask(user, id, userId)",
             "listTasks(user, filters)", "getBoard(user, projectId)", "listMyTasks(user)"])
card(s, 9.1, 1.4, 3.6, 2.7, "Workflow d'une tâche",
     ["TODO \u2192 IN_PROGRESS \u2192 CODE_REVIEW \u2192 TESTING \u2192 DONE", "BLOCKED : état supplémentaire avec motif obligatoire."],
     size=13)
card(s, 9.1, 4.3, 3.6, 2.5, "Dépendances",
     ["TaskService \u2192 SprintService", "TaskService, SprintService \u2192 ProjectAccessService", "Chaque changement alimente ActivityService."],
     size=13, accent=AMBER)
arrow(s, 2.45, 3.5, 2.45, 3.3, NAVY, width=1.5)
arrow(s, 6.7, 3.75, 6.7, 3.5, NAVY, width=1.5)

# ------------------------------------------------------------------ 11. Collaboration & Insight
s = slide("Classes \u2013 Collaboration et Insight", "Étape 4 \u00b7 Méthodes")
uml(s, 0.6, 1.4, 3.9, "CommentService", "<<service>>",
    methods=["listComments(user, taskId)", "addComment(user, taskId, content)", "updateComment(user, id, content)", "deleteComment(user, id)"])
uml(s, 4.7, 1.4, 3.9, "ActivityService", "<<service>>",
    methods=["record(event)", "onActivity(listener)", "listProjectActivities(user, id)", "changedFields(before, after)"], hdr=TEAL_D)
uml(s, 8.8, 1.4, 3.9, "NotificationService", "<<service>>",
    methods=["registerActivityListener()", "buildNotifications(activity)", "notifyFromActivity(activity)", "listNotifications(user)",
             "markAsRead(user, id)", "markAllAsRead(user)", "countUnread(user)"])
arrow(s, 8.6, 2.1, 8.78, 2.1, TEAL_D, width=2)
uml(s, 0.6, 4.2, 3.9, "DashboardService", "<<service>>",
    methods=["getDashboard(user)", "getProjectDashboard(user, id)", "taskIndicators(filter)", "workload(projectId)", "activeSprints(user)"])
uml(s, 4.7, 4.2, 3.9, "SearchService", "<<service>>", methods=["search(user, query)"])
rect(s, 8.8, 4.2, 3.9, 2.55, SOFT_T)
text(s, 8.95, 4.25, 3.6, 2.45,
     ["Patron observateur", "ActivityService publie un événement à chaque action ; NotificationService s'y abonne.",
      "Le couplage reste faible : ajouter un type de notification ne modifie pas les modules métier."],
     12, NAVY, space=5)

# ------------------------------------------------------------------ 12. AI gateway
s = slide("Package AI Gateway \u2013 le backend appelle l'IA", "Interfaces")
uml(s, 0.6, 1.4, 3.9, "AiClientService", "<<interface requise>>", methods=["request(path, body)", "getStatus()"], hdr=TEAL_D)
uml(s, 0.6, 3.05, 3.9, "AiAssistantService", "<<service>>",
    methods=["chat(user, project, messages)", "runTool(name, args)", "executeAction(user, action)", "assertAssistantAvailable()"])
uml(s, 4.7, 1.4, 3.9, "AiPlanService", "<<service>>",
    methods=["generatePlan(user, project, spec)", "extractDocument(file)", "parseAiPlan(raw)", "applyPlan(user, project, plan)"])
uml(s, 4.7, 3.55, 3.9, "AiRecommendationService", "<<service>>", methods=["recommendDevelopers(user, taskId)", "workloads(project)", "experiences(project)"])
uml(s, 4.7, 5.35, 3.9, "AiRiskService", "<<service>>", methods=["predictSprintRisk(user, sprintId)", "historicalVelocity(project)"])
text(s, 0.6, 5.5, 3.9, 1.2, "Tous les services IA dépendent de AiClientService, l'unique point de sortie vers le service IA.", 12, TEAL_D, True, italic=True)
rect(s, 8.9, 1.4, 3.8, 5.35, SOFT_T)
text(s, 9.05, 1.45, 3.5, 5.25,
     ["Rôle de la passerelle", "Collecte les données dans MongoDB, les envoie au service IA, puis valide la réponse.",
      "Toute proposition (plan, action de l'assistant) est confirmée par le chef de projet avant écriture.",
      "Si l'IA est indisponible, le reste de la plateforme continue de fonctionner."],
     13, NAVY, space=8)

# ------------------------------------------------------------------ 13. AI service
s = slide("White box du service IA (FastAPI)", "Raffinement")
label_box(s, 0.6, 1.4, 12.1, 0.7, "routes/   planning \u00b7 recommendation \u00b7 risk \u00b7 assistant \u00b7 health   (jeton de service requis)", NAVY, WHITE, 15, shape=MSO_SHAPE.RECTANGLE)
sv = [("planning_service", "build_plan(request, llm, settings)", "requirement_parser, sprint_planner, task_enricher"),
      ("developer_scoring", "recommend(request)", "score_candidate, target_skills"),
      ("sprint_risk", "predict_risk(request)", "snapshot_of, risk_level"),
      ("assistant", "chat(request, llm)", "validate_call, to_openai_messages")]
for i, (n, m, d) in enumerate(sv):
    x = 0.6 + i * 3.05
    arrow(s, x + 1.4, 2.12, x + 1.4, 2.45, TEAL, width=2)
    rect(s, x, 2.5, 2.9, 1.55, WHITE, TEAL_D, lw=1.25)
    text(s, x + 0.1, 2.52, 2.7, 0.35, n, 14, NAVY, True)
    text(s, x + 0.1, 2.9, 2.7, 0.45, m, 11, TEAL_D, True, font="Consolas")
    text(s, x + 0.1, 3.4, 2.7, 0.65, d, 11, GREY)
uml(s, 0.6, 4.4, 3.9, "NaiveBayesClassifier", "<<ml>>", methods=["fit(texts, labels)", "predict_proba(text)", "predict(text)"], size=11)
uml(s, 4.7, 4.4, 3.9, "LogisticRegression", "<<ml>>", methods=["fit(rows, labels)", "predict_proba(row)", "contributions(row)"], size=11)
uml(s, 8.8, 4.4, 3.9, "OpenAiClient", "<<adapter externe>>", methods=["complete_json(system, user, ...)", "chat(messages, tools)"], hdr=TEAL_D, size=11)
text(s, 0.6, 6.0, 7.9, 0.9, ["Planification : classification du type de tâche. Risque de retard : probabilité et facteurs.",
                              "Sans clé OpenAI, l'analyseur local reste disponible."], 12, GREY, space=2)

# ------------------------------------------------------------------ 14. Frontend
s = slide("White box du frontend (Angular)", "Raffinement")
label_box(s, 0.6, 1.4, 12.1, 0.65, "features/   composants et services par module fonctionnel (chargés à la demande)", NAVY, WHITE, 15, shape=MSO_SHAPE.RECTANGLE)
feats = ["auth", "projects", "sprints", "tasks", "kanban", "comments", "activity", "notifications", "dashboard", "search",
         "profile", "users", "ai-plan", "ai-recommendation", "ai-risk", "ai-assistant"]
for i, f in enumerate(feats):
    x = 0.6 + (i % 8) * 1.52
    y = 2.2 + (i // 8) * 0.6
    label_box(s, x, y, 1.45, 0.5, f, SOFT_T if not f.startswith("ai") else SOFT_A, NAVY, 11, bold=False, line=MID)
arrow(s, 3.0, 3.5, 3.0, 3.95, NAVY, dashed=True, width=1.75)
arrow(s, 9.0, 3.5, 9.0, 3.95, NAVY, dashed=True, width=1.75)
rect(s, 0.6, 4.0, 5.9, 1.5, WHITE, MID)
text(s, 0.75, 4.05, 5.6, 1.9,
     ["core/ \u2013 services singletons", "AuthService, AuthInterceptor, guards, ApiErrorInterceptor,",
      "NotificationService, ThemeService, ToastService, modèles d'API"], 13, NAVY, space=3)
rect(s, 6.8, 4.0, 5.9, 1.5, WHITE, MID)
text(s, 6.95, 4.05, 5.6, 1.9,
     ["shared/ \u2013 briques réutilisables", "loading-state, error-state, confirm-dialog, tag-input,",
      "chart, avatar, validateurs de formulaires, PagedList"], 13, NAVY, space=3)
text(s, 0.6, 5.75, 12.1, 0.7,
     "layouts/ (main, auth) dépend de core/. Les features dépendent de core/ et shared/, jamais l'inverse.",
     13, TEAL_D, True)

# ------------------------------------------------------------------ 15. Qualités
s = slide("Du modèle aux qualités attendues", "Décisions d'architecture")
qs = [("Maintenabilité", "Couches et packages : une modification d'un module n'impacte pas les modules indépendants."),
      ("Modularité", "Frontend, backend et IA sont trois blocs déployables séparément."),
      ("Sécurité", "Contrôle d'accès centralisé dans Identity et Projects ; secrets uniquement côté serveur."),
      ("Résilience", "L'IA est optionnelle : une panne n'arrête pas la gestion de projets."),
      ("Testabilité", "Services purs et interfaces explicites, tests unitaires par bloc."),
      ("Performance", "Requêtes indexées, appels IA avec délai limité.")]
for i, (h, b) in enumerate(qs):
    x = 0.6 + (i % 3) * 4.1
    y = 1.5 + (i // 3) * 2.7
    card(s, x, y, 3.9, 2.4, h, b, accent=TEAL if i % 2 == 0 else AMBER, size=14)

# ------------------------------------------------------------------ 16. Conclusion
counter[0] += 1
s = p.slides.add_slide(blank)
rect(s, 0, 0, 13.333, 7.5, NAVY)
text(s, 0.9, 0.8, 11, 0.4, "CONCLUSION", 14, TEAL, True)
text(s, 0.9, 1.25, 11.5, 1.0, "Ce que la vue building block apporte", 38, WHITE, True)
pts = [("3 niveaux", "Système (black box), blocs exécutables, packages et classes (white box)."),
       ("7 packages", "Un par groupe d'exigences FR-01 à FR-15, avec des dépendances sans cycle."),
       ("5 interfaces", "REST publique, persistance, API IA, état de santé et API LLM, chacune fournie et requise."),
       ("Méthodes", "Classes principales documentées pour guider l'implémentation et les tests.")]
for i, (h, b) in enumerate(pts):
    x = 0.9 + (i % 2) * 5.9
    y = 2.7 + (i // 2) * 1.9
    rect(s, x, y, 5.6, 1.65, RGBColor(0x1A, 0x2A, 0x57))
    text(s, x + 0.25, y + 0.12, 5.1, 0.5, h, 22, TEAL, True)
    text(s, x + 0.25, y + 0.7, 5.1, 0.9, b, 14, RGBColor(0xE2, 0xE8, 0xF0))
text(s, 0.9, 6.7, 11, 0.4, "Merci \u2013 Questions ?", 16, RGBColor(0x94, 0xA3, 0xB8))

p.save(r"D:\5eme\Smart_Project_Manager\docs\slides\Atelier3_Building_Block.pptx")
print("saved")
