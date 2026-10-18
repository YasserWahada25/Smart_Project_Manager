# -*- coding: utf-8 -*-
"""Diagrammes UML en noir et blanc (packages, composants, classes) dessinés avec Pillow."""
import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageChops

from spec import PACKAGES, DEPENDENCIES

FD = "C:/Windows/Fonts/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "img")


def font(name, size):
    return ImageFont.truetype(FD + name, size)


F_TITLE = font("arialbd.ttf", 30)
F_TAB = font("arialbd.ttf", 26)
F_COMP = font("arialbd.ttf", 22)
F_ST = font("ariali.ttf", 18)
F_CN = font("arialbd.ttf", 22)
F_TXT = font("arial.ttf", 20)
F_LBL = font("arial.ttf", 20)
F_LBLB = font("arialbd.ttf", 20)
LW = 3


class Canvas:
    def __init__(self, w=4000, h=3200):
        self.img = Image.new("L", (w, h), 255)
        self.d = ImageDraw.Draw(self.img)

    def crop(self, margin=30):
        bg = Image.new("L", self.img.size, 255)
        box = ImageChops.difference(self.img, bg).getbbox()
        x0, y0, x1, y1 = box
        out = self.img.crop((max(0, x0 - margin), max(0, y0 - margin), x1 + margin, y1 + margin))
        return out.convert("RGB")


def tw(f, s):
    return f.getlength(s)


# ---------------------------------------------------------------- primitives
def folder(d, x, y, w, h, title, f=F_TAB, tab_h=46, fill=255):
    tab_w = max(120, tw(f, title) + 36)
    d.rectangle([x, y + tab_h, x + w, y + h], outline=0, width=LW, fill=fill)
    d.rectangle([x, y, x + tab_w, y + tab_h], outline=0, width=LW, fill=255)
    d.text((x + tab_w / 2, y + tab_h / 2), title, font=f, fill=0, anchor="mm")
    return tab_w


def dashed(d, p1, p2, dash=14, gap=9, width=LW):
    (x1, y1), (x2, y2) = p1, p2
    L = math.hypot(x2 - x1, y2 - y1)
    if L == 0:
        return
    ux, uy = (x2 - x1) / L, (y2 - y1) / L
    t = 0.0
    while t < L:
        e = min(t + dash, L)
        d.line([x1 + ux * t, y1 + uy * t, x1 + ux * e, y1 + uy * e], fill=0, width=width)
        t += dash + gap


def arrowhead(d, p_from, p_to, size=20, ang=26):
    (x1, y1), (x2, y2) = p_from, p_to
    a = math.atan2(y2 - y1, x2 - x1)
    for s in (-1, 1):
        b = a + math.pi - s * math.radians(ang)
        d.line([x2, y2, x2 + size * math.cos(b), y2 + size * math.sin(b)], fill=0, width=LW)


def dashed_arrow(d, pts):
    for a, b in zip(pts[:-1], pts[1:]):
        dashed(d, a, b)
    arrowhead(d, pts[-2], pts[-1])


def label(d, xy, lines, f=F_LBL, anchor="mm", pad=4):
    if isinstance(lines, str):
        lines = [lines]
    lh = f.size + 4
    w = max(tw(f, s) for s in lines) + 2 * pad
    h = lh * len(lines) + 2 * pad - 4
    x, y = xy
    if anchor == "mm":
        x0, y0 = x - w / 2, y - h / 2
    elif anchor == "lm":
        x0, y0 = x, y - h / 2
    else:  # rm
        x0, y0 = x - w, y - h / 2
    d.rectangle([x0, y0, x0 + w, y0 + h], fill=255)
    for i, s in enumerate(lines):
        d.text((x0 + w / 2, y0 + pad + i * lh), s, font=f, fill=0, anchor="ma")


# ---------------------------------------------------------------- white box
def class_layout(c, mode):
    attrs = ["- " + a for a in c.get("attrs", [])]
    meths = ["+ " + m for m in c.get("methods", [])] if mode == "full" else []
    w = max(tw(F_CN, c["name"]), tw(F_ST, "«%s»" % c["stereo"]))
    for s in attrs + meths:
        w = max(w, tw(F_TXT, s))
    w += 28
    head = 74
    ah = (len(attrs) * 26 + 14) if attrs else 0
    mh = (len(meths) * 26 + 14) if meths else 0
    return {"w": w, "h": head + ah + mh, "head": head, "attrs": attrs, "meths": meths,
            "ah": ah, "mh": mh}


def draw_class(d, x, y, w, c, lay):
    h = lay["h"]
    d.rectangle([x, y, x + w, y + h], outline=0, width=2, fill=255)
    d.text((x + w / 2, y + 10), "«%s»" % c["stereo"], font=F_ST, fill=0, anchor="ma")
    d.text((x + w / 2, y + 38), c["name"], font=F_CN, fill=0, anchor="ma")
    cy = y + lay["head"]
    if lay["attrs"]:
        d.line([x, cy, x + w, cy], fill=0, width=2)
        for i, s in enumerate(lay["attrs"]):
            d.text((x + 12, cy + 8 + i * 26), s, font=F_TXT, fill=0, anchor="la")
        cy += lay["ah"]
    if lay["meths"]:
        d.line([x, cy, x + w, cy], fill=0, width=2)
        for i, s in enumerate(lay["meths"]):
            d.text((x + 12, cy + 8 + i * 26), s, font=F_TXT, fill=0, anchor="la")


def component_icon(d, x, y):
    d.rectangle([x + 8, y, x + 40, y + 24], outline=0, width=2, fill=255)
    d.rectangle([x, y + 4, x + 16, y + 10], outline=0, width=2, fill=255)
    d.rectangle([x, y + 14, x + 16, y + 20], outline=0, width=2, fill=255)


def sub_layout(sub, mode):
    lays = [class_layout(c, mode) for c in sub["classes"]]
    cw = max(l["w"] for l in lays)
    comp_w = max(cw + 36, tw(F_COMP, sub["comp"]) + 90, 260)
    cw = comp_w - 36
    comp_h = 64 + 12 + sum(l["h"] for l in lays) + 18 * (len(lays) - 1) + 18
    tab_w = tw(F_TAB, sub["name"]) + 36
    w = max(comp_w + 36, tab_w + 20)
    comp_w = w - 36
    cw = comp_w - 36
    h = 46 + 18 + comp_h + 18
    return {"w": w, "h": h, "lays": lays, "cw": cw, "comp_w": comp_w, "comp_h": comp_h}


def draw_sub(d, x, y, sub, L):
    folder(d, x, y, L["w"], L["h"], sub["name"])
    cx, cy = x + 18, y + 46 + 18
    d.rectangle([cx, cy, cx + L["comp_w"], cy + L["comp_h"]], outline=0, width=2, fill=255)
    d.text((cx + (L["comp_w"] - 50) / 2, cy + 8), "«component»", font=F_ST, fill=0, anchor="ma")
    d.text((cx + (L["comp_w"] - 50) / 2, cy + 30), sub["comp"], font=F_COMP, fill=0, anchor="ma")
    component_icon(d, cx + L["comp_w"] - 50, cy + 10)
    yy = cy + 64 + 12
    for c, lay in zip(sub["classes"], L["lays"]):
        draw_class(d, cx + 18, yy, L["cw"], c, lay)
        yy += lay["h"] + 18


def lollipop(d, x, y_edge, name, ops, up=False):
    """Interface fournie (cercle au bout d'un trait) sous le bord inférieur."""
    d.line([x, y_edge, x, y_edge + 40], fill=0, width=LW)
    d.ellipse([x - 15, y_edge + 40, x + 15, y_edge + 70], outline=0, width=LW, fill=255)
    d.text((x, y_edge + 78), name, font=F_LBLB, fill=0, anchor="ma")
    if ops:
        d.text((x, y_edge + 102), ops, font=font("arial.ttf", 17), fill=0, anchor="ma")


def socket(d, x, y_edge, name, prov):
    """Interface requise (demi-cercle ouvert vers le haut) au-dessus du bord supérieur."""
    d.line([x, y_edge, x, y_edge - 36], fill=0, width=LW)
    d.arc([x - 18, y_edge - 72, x + 18, y_edge - 36], 0, 180, fill=0, width=LW)
    d.text((x, y_edge - 80), name, font=F_LBLB, fill=0, anchor="ms")
    d.text((x, y_edge - 104), "(" + prov + ")", font=font("arial.ttf", 17), fill=0, anchor="ms")


def render_package(pkg, path, mode):
    cv = Canvas()
    d = cv.d
    subs = pkg["subs"]
    lays = [sub_layout(s, mode) for s in subs]
    gap, pad = 36, 40
    rows = pkg["rows"]
    row_w = [sum(lays[i]["w"] for i in r) + gap * (len(r) - 1) for r in rows]
    row_h = [max(lays[i]["h"] for i in r) for r in rows]
    inner_w = max(row_w)
    inner_h = sum(row_h) + gap * (len(rows) - 1)
    ox, oy = 120, 220
    fw = inner_w + 2 * pad
    fh = 46 + inner_h + 2 * pad
    # le cadre du package
    folder(d, ox, oy, fw, fh, "«package»  " + pkg["name"], f=F_TITLE, tab_h=56)
    y = oy + 56 + pad
    for r, rw, rh in zip(rows, row_w, row_h):
        x = ox + pad + (inner_w - rw) / 2
        for i in r:
            draw_sub(d, x, y, subs[i], lays[i])
            x += lays[i]["w"] + gap
        y += rh + gap
    if mode == "full":
        edge_b = oy + fh
        n = len(pkg["provided"])
        for k, (name, ops) in enumerate(pkg["provided"]):
            x = ox + (k + 0.5) * fw / n
            lollipop(d, x, edge_b, name, ops if len(ops) < 48 else ops[:46] + "…")
        edge_t = oy + 56
        req = pkg["required"]
        if req:
            x_start = ox + tw(F_TITLE, "«package»  " + pkg["name"]) + 120
            span = ox + fw - x_start
            for k, (name, prov) in enumerate(req):
                x = x_start + (k + 0.5) * span / len(req)
                socket(d, x, oy, name, prov)
    cv.crop().save(path)


# ---------------------------------------------------------------- niveau 1 : packages
def render_packages_fr(path):
    cv = Canvas()
    d = cv.d
    W, GAP = 470, 40
    pos = [(i % 4, i // 4) for i in range(7)]
    heights = {}
    rowh = [0, 0]
    for p in PACKAGES:
        h = 46 + 28 + 32 * len(p["fr"]) + 18
        heights[p["name"]] = h
    rowh[0] = max(heights[p["name"]] for p in PACKAGES[:4])
    rowh[1] = max(heights[p["name"]] for p in PACKAGES[4:])
    x0, y0 = 60, 130
    d.text((x0, 50), "Modèle fonctionnel : un package par groupe d'exigences", font=F_TITLE, fill=0, anchor="la")
    for p, (cx, cy) in zip(PACKAGES, pos):
        x = x0 + cx * (W + GAP)
        y = y0 + (0 if cy == 0 else rowh[0] + GAP + 20)
        h = rowh[cy]
        folder(d, x, y, W, h, p["name"])
        for i, fr in enumerate(p["fr"]):
            d.text((x + 22, y + 46 + 24 + i * 32), fr, font=F_TXT, fill=0, anchor="la")
    cv.crop().save(path)


# ---------------------------------------------------------------- niveau 2 : black box
def render_blackbox(path):
    cv = Canvas()
    d = cv.d
    BW, BH = 360, 200
    P = {p["name"]: p for p in PACKAGES}
    pos = {
        "Insight": (250, 330), "AI": (900, 330),
        "Sprints": (60, 680), "Tasks": (680, 680), "Collaboration": (1300, 680),
        "Projects": (680, 1030), "Identity": (680, 1380),
    }
    box = {}
    for name, (x, y) in pos.items():
        box[name] = (x, y, x + BW, y + BH)
        folder(d, x, y, BW, BH, name)
        d.text((x + 16, y + 56), "Interfaces fournies", font=font("ariali.ttf", 18), fill=0, anchor="la")
        for i, (iname, _) in enumerate(P[name]["provided"]):
            yy = y + 90 + i * 34
            d.line([x + 20, yy + 10, x + 40, yy + 10], fill=0, width=2)
            d.ellipse([x + 40, yy, x + 60, yy + 20], outline=0, width=2, fill=255)
            d.text((x + 72, yy + 10), iname, font=F_TXT, fill=0, anchor="lm")
    # systèmes externes
    ext = {"Service IA": (900, 30, 900 + BW, 130), "LLM": (1400, 30, 1400 + BW, 130)}
    for n, (x0, y0, x1, y1) in ext.items():
        d.rectangle([x0, y0, x1, y1], outline=0, width=LW, fill=255)
        d.text(((x0 + x1) / 2, y0 + 22), "«external system»", font=F_ST, fill=0, anchor="ma")
        d.text(((x0 + x1) / 2, y0 + 56), "Service IA (FastAPI)" if n == "Service IA" else "Fournisseur LLM", font=F_CN, fill=0, anchor="ma")
    b = lambda n: box[n]
    edges = [
        ([(430, 530), (330, 726)], ["ISprintQuery"], (345, 600)),
        ([(560, 530), (870, 726)], ["ITaskManagement"], (740, 596)),
        ([(1000, 530), (960, 726)], ["ITaskManagement"], (1075, 625)),
        ([(900, 480), (400, 726)], ["ISprintQuery"], (525, 586)),
        ([(680, 800), (420, 800)], ["ISprintQuery"], (550, 770)),
        ([(860, 880), (860, 1076)], ["IProjectAccess", "IDomainEvents"], (975, 955)),
        ([(240, 880), (680, 1120)], ["IProjectAccess", "IDomainEvents"], (400, 1030)),
        ([(1300, 800), (1040, 800)], ["ITaskManagement"], (1170, 770)),
        ([(1400, 880), (1040, 1100)], ["IProjectAccess", "IDomainEvents"], (1280, 1020)),
        ([(1260, 430), (1700, 430), (1700, 1140), (1040, 1140)], ["IProjectAccess"], (1500, 1140)),
        ([(860, 1230), (860, 1426)], ["IUserDirectory", "IAuthorization"], (1010, 1305)),
        ([(1080, 330), (1080, 130)], ["IAiApi"], (1140, 232)),
        ([(1260, 80), (1400, 80)], ["ILlmApi"], (1330, 40)),
    ]
    for pts, lab, at in edges:
        dashed_arrow(d, pts)
        label(d, at, lab)
    d.text((60, 1330), "- - ->  dépendance «use»      —○  interface fournie", font=F_TXT, fill=0, anchor="la")
    cv.crop().save(path)


def main():
    os.makedirs(OUT, exist_ok=True)
    render_packages_fr(os.path.join(OUT, "fig01_packages.png"))
    render_blackbox(os.path.join(OUT, "fig02_black_box.png"))
    for i, p in enumerate(PACKAGES):
        render_package(p, os.path.join(OUT, "wb_%s_struct.png" % p["name"].lower()), "struct")
        render_package(p, os.path.join(OUT, "wb_%s_full.png" % p["name"].lower()), "full")
    print("ok")


if __name__ == "__main__":
    main()
