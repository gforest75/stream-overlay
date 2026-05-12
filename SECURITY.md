# Security Audit — stream-overlay

**Date :** 2026-05-12  
**Repo :** https://github.com/gforest75/stream-overlay  
**Stack :** HTML/CSS/JS vanilla — Supabase Realtime — GitHub Pages

---

## Vecteurs identifiés

### 1. RLS trop permissive — UPDATE sans restriction de colonnes `(HIGH → FIXED via SQL)`

**Risque :** La policy `public update` d'origine permettait à n'importe qui possédant
la clé anon de modifier **toutes** les colonnes, y compris `id`. Un attaquant aurait pu :
- Écraser la ligne unique (`id = 1`) en changeant son `id` → overlay cassé définitivement
- Pousser n'importe quelle valeur sans contrainte de borne

**Fix SQL :** Voir section [SQL à exécuter](#sql-à-exécuter).
- UPDATE limité à la ligne `id = 1` (USING + WITH CHECK)
- Colonne `id` protégée par `REVOKE UPDATE` + `GRANT UPDATE (colonnes métier seulement)`
- INSERT bloqué (aucune policy = refus par défaut en RLS)
- DELETE bloqué (idem)

---

### 2. Input `progress_label` non sanitisé — `(MEDIUM → FIXED in control.js)`

**Risque :** Le champ texte libre était envoyé tel quel en base sans validation ni limite.
N'importe qui accédant à `control.html` pouvait stocker une string arbitraire (longueur
illimitée, caractères spéciaux) dans la colonne `progress_label`.

**Fix code :** `sanitizeLabel()` dans `js/control.js` :
- Seuls les caractères `[a-zA-ZÀ-ÿ0-9 -]` sont acceptés
- Limite : 30 caractères maximum
- Chaîne vide après sanitisation → patch ignoré

---

### 3. `progress_total` acceptait 0 — division par zéro `(LOW → FIXED in control.js)`

**Risque :** La validation acceptait `n >= 0`. Valeur `0` en base → division par zéro
dans le calcul du pourcentage de progression (résultat `NaN` propagé au DOM).

**Fix code :** Validation changée en `n >= 1 && n <= 99` dans `applyProgress()`.  
Attributs HTML mis à jour : `min="1" max="99"` sur `input-total`.

---

### 4. Absence de validation des données reçues de Supabase dans overlay.js — `(LOW → FIXED)`

**Risque :** `applyState()` appliquait directement les valeurs brutes du payload Realtime
sans vérification de type ni de bornes. Un attaquant ayant modifié la DB (ex: via l'API
REST Supabase avec la clé anon) aurait pu injecter des valeurs inattendues dans le DOM.

**Fix code :** `validateState()` dans `js/overlay.js` :
- Tous les entiers sont re-parsés et clampés (`deaths: 0–9999`, `rage: 0–100`, etc.)
- `progress_label` re-sanitisé identiquement à `sanitizeLabel()`

---

### 5. XSS via valeurs Supabase `(POTENTIEL → CONFIRMÉ SAFE)`

**Vecteur théorique :** Si le code utilisait `innerHTML` pour afficher des valeurs venant
de Supabase, un attaquant ayant écrit `<img src=x onerror=alert(1)>` en base aurait pu
exécuter du JavaScript dans le contexte de l'overlay OBS.

**Verdict :** `overlay.js` et `control.js` utilisent **exclusivement `textContent`** pour
toutes les valeurs issues de Supabase. Aucun `innerHTML` sur des données dynamiques.
XSS impossible par ce vecteur.

---

### 6. Clé anon Supabase exposée en clair `(INFO — RISQUE ACCEPTÉ)`

**Constat :** `SUPABASE_KEY` est visible dans le code source public (GitHub Pages + repo
public). Elle sera indexée par des crawlers et moteurs de recherche.

**Verdict :** **Comportement normal et attendu** dans l'architecture Supabase.
La clé anon n'est pas un secret — elle identifie le projet mais ne donne accès qu'à ce
que les RLS policies autorisent explicitement. La sécurité repose sur RLS, pas sur la
confidentialité de la clé.

**Mitigation :** RLS correctement configurée (voir #1 et SQL ci-dessous).

---

### 7. Accès aux autres tables Supabase `(INFO — MITIGÉ PAR RLS)`

**Risque :** Avec la clé anon, une tentative de SELECT/UPDATE sur d'autres tables du projet.

**Verdict :** Limité par les RLS policies de chaque table. Seule `overlay_state` est
accessible (SELECT public) et partiellement modifiable (UPDATE 5 colonnes sur `id=1`).
Les autres tables sans policy RLS explicite sont bloquées par défaut.

---

## Risques résiduels

| Risque | Niveau | Raison de l'acceptation |
|--------|--------|-------------------------|
| Clé anon publique | Accepté | Architecture Supabase — clé non-secrète par design |
| `control.html` accessible sans auth | Accepté (temporaire) | Voir roadmap ci-dessous |
| Spam d'UPDATE par un tiers | Faible | Impact limité aux 5 colonnes de `overlay_state` |

---

## Ce qui reste à faire

- [ ] **Authentification sur `control.html`** — l'URL est publique, n'importe qui peut
  modifier l'overlay. À sécuriser avec OAuth Twitch ou un secret partagé (password simple).
- [ ] **Rate limiting** — Supabase ne limite pas nativement les requêtes anon.
  Envisager une Edge Function devant les writes pour limiter le débit.

---

## SQL à exécuter

Copier-coller dans **Supabase → SQL Editor → New query** :

```sql
-- 1. Supprimer les policies trop permissives
DROP POLICY IF EXISTS "public read"   ON public.overlay_state;
DROP POLICY IF EXISTS "public update" ON public.overlay_state;

-- 2. S'assurer que RLS est activé
ALTER TABLE public.overlay_state ENABLE ROW LEVEL SECURITY;

-- 3. SELECT : lecture publique (nécessaire pour overlay.js sans authentification)
CREATE POLICY "anon_select"
  ON public.overlay_state
  FOR SELECT TO anon
  USING (true);

-- 4. UPDATE : uniquement la ligne id=1
CREATE POLICY "anon_update_row1"
  ON public.overlay_state
  FOR UPDATE TO anon
  USING     (id = 1)
  WITH CHECK (id = 1);

-- 5. Restreindre UPDATE aux colonnes métier uniquement (interdit de modifier id)
REVOKE UPDATE ON public.overlay_state FROM anon;
GRANT  UPDATE (deaths, rage, progress_current, progress_total, progress_label)
  ON public.overlay_state TO anon;
```

> **INSERT** et **DELETE** restent bloqués : aucune policy = accès refusé par défaut en RLS.
