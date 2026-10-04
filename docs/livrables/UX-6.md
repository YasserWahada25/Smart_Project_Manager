# Livrable — UX-6 : menu du compte, choix du thème aligné

> Dans le menu du compte (bas de la barre latérale), la coche du thème choisi s'intercalait entre l'icône et le libellé (« ☀ ✓ Light »), décalant ce libellé par rapport aux autres. Réalisé le 4 octobre 2026. **Non commité.**

## 1. Prompts à l'origine

| # | Prompt du superviseur (cité) | Décision / effet |
|---|---|---|
| 46 | Capture du menu du compte : « fixer l'affichage de cette partie » | Coche déplacée à droite, thème choisi mis en évidence, menu un peu plus large |

## 2. Cause et correction

- **Cause** : Angular Material place **toutes** les `<mat-icon>` placées directement dans un élément de menu dans la zone d'icône, avant le texte ; la coche se retrouvait donc à côté du soleil.
- **Correction** :
  - la coche est placée **dans** le libellé, alignée à droite ;
  - le thème choisi (icône, libellé et coche) est affiché dans la couleur principale ;
  - le menu fait au moins 240 px de large, pour que le nom et le rôle ne soient plus serrés ;
  - l'accessibilité est inchangée (`menuitemradio` avec `aria-checked`).

## 3. Fichiers

| Fichier | Rôle |
|---|---|
| `frontend/src/app/layouts/main-layout/main-layout.html` | Coche dans le libellé, classe `selected`, classe `account-menu` du menu |
| `frontend/src/styles.scss` | `.menu-option`, `.mat-mdc-menu-item.selected`, `.menu-check`, largeur de `.account-menu` |
| `frontend/src/app/layouts/main-layout/main-layout.spec.ts` | Test du menu complété : une seule coche, après le libellé du thème choisi |

## 4. Preuves

Frontend : **59 fichiers, 378 tests** réussis ; lint et build OK (bundle initial 355,5 kB).

## 5. Limites

Contrôle visuel : à faire par le superviseur (thèmes clair et sombre).
