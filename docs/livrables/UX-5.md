# Livrable — UX-5 : bouton « Ask AI » flottant et rond

> Le bouton « Ask AI » (UX-4) devient une **bulle ronde flottante**, comme le bouton Gemini que le superviseur a pris en exemple. Réalisé le 4 octobre 2026. Commit `bf78f00`.

## 1. Prompts à l'origine

| # | Prompt du superviseur (cité) | Décision / effet |
|---|---|---|
| 43 | Deux captures (le bouton actuel « Ask AI » et le bouton rond Gemini) : « je veux rendre cette button ia flottante comme illustre dans l'exemple 2éme image modifier » | Bouton rond avec dégradé et étoile à quatre branches, libellé déplacé dans une infobulle |

## 2. Ce qui a été livré

- **Forme** : cercle de 48 px en bas à droite (au lieu du bouton allongé bleu vif « ✦ Ask AI »).
- **Style** : dégradé aux couleurs du logo (bleu → cyan), étoile blanche à quatre branches (style Gemini), halo bleu léger.
- **Interaction** :
  - au survol ou menu ouvert, la bulle monte de 2 px et l'étoile tourne d'un quart de tour ;
  - pression : léger enfoncement ;
  - infobulle « Ask AI » à gauche ;
  - contour visible au clavier ;
  - animations coupées si le système demande moins de mouvement.
- **Inchangé** : le menu des projets gérés et l'ouverture de leur assistant ; nom accessible « Ask AI ».

## 3. Fichiers

| Fichier | Rôle |
|---|---|
| `frontend/src/app/layouts/main-layout/main-layout.html` | Bouton simple avec icône SVG et infobulle (à la place de `mat-fab extended`) |
| `frontend/src/styles.scss` | Style `.ask-ai-fab` : cercle, dégradé, ombre, animations |

## 4. Preuves

Frontend complet : **59 fichiers, 376 tests** réussis (le test du bouton « Ask AI » est inchangé et passe) ; lint OK ; build OK (bundle initial 355,2 kB).

## 5. Limites

Contrôle visuel : à faire par le superviseur (thèmes clair et sombre).
