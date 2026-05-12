# stream-overlay

Overlay OBS en temps réel pour stream Twitch, contrôlable depuis un téléphone.

## Stack

HTML / CSS / JS vanilla — zéro framework, zéro npm.  
Communication temps réel via **Supabase Realtime**.

---

## Supabase

Le projet Supabase est déjà configuré et opérationnel.

**URL** : `https://vdiqyyitfwqpstizvbti.supabase.co`  
**Anon Key** : voir `js/overlay.js` et `js/control.js`

### Schéma de la table `overlay_state`

| Colonne            | Type    | Défaut    |
|--------------------|---------|-----------|
| `id`               | integer | `1` (PK)  |
| `deaths`           | integer | `0`       |
| `rage`             | integer | `0`       |
| `progress_current` | integer | `0`       |
| `progress_total`   | integer | `10`      |
| `progress_label`   | text    | `Bosses`  |

La table contient une seule ligne (`id = 1`). RLS activé.

---

## GitHub Pages

Activer dans **Settings → Pages → Branch: main → Save**.

| Page    | URL |
|---------|-----|
| Overlay | https://gforest75.github.io/stream-overlay/overlay.html |
| Control | https://gforest75.github.io/stream-overlay/control.html |

---

## OBS — Source navigateur

1. Ajouter une source **Navigateur**
2. URL : `https://gforest75.github.io/stream-overlay/overlay.html`
3. Largeur : `1920` / Hauteur : `1080`
4. Cocher **Fond transparent**
5. Décocher « Rafraîchir le navigateur quand la scène devient active » (optionnel)

---

## Mobile — Interface de contrôle

1. Ouvrir `https://gforest75.github.io/stream-overlay/control.html` sur le téléphone
2. Pour un accès rapide : **Partager → Ajouter à l'écran d'accueil** (iOS/Android)

### Widgets disponibles

- **Deaths** : compteur de morts (+1 / −1 / Reset)
- **Progress** : objectif configurable (label + total), avancement +1 / −1 / Done / Reset
- **Rage Meter** : jauge 0–100 (+5 / +10 / −5 / −10 / Reset)

---

## Structure du projet

```
stream-overlay/
├── overlay.html       ← source OBS (fond transparent)
├── control.html       ← interface mobile
├── css/
│   ├── overlay.css
│   └── control.css
└── js/
    ├── overlay.js
    └── control.js
```
