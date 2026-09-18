# ADR-0002 — Design : aesthetic on-chain, encodage couleur, budget perf

| Champ       | Valeur                              |
|-------------|--------------------------------------|
| Statut      | **Accepté**                          |
| Date        | 2026-07-03                           |
| Tags        | design, performance, 3d, aesthetic   |

## Contexte

Le design doit être au niveau des meilleurs outils de la catégorie (Bubblemaps, Nansen, Parsec) — pas le rendu générique Three.js. Trois axes : palette, encodage des données, budget de performance.

## Analyse des références

### Bubblemaps
- Fond : `#04040d` (near-black avec teinte bleue)
- Nœuds : sphères avec `MeshPhysicalMaterial`, metalness élevé
- Liens : `LineBasicMaterial` transparent, couleur selon la direction du flux
- Glow : `UnrealBloomPass` sur les nœuds à fort volume
- Labels : `Billboard` sprites qui font toujours face à la caméra

### Nansen
- Monochrome avec accents orange pour "smart money"
- Nœuds plats (cercles 2D) pas de 3D véritable
- Force-directed graph classique

### Eigenphi
- Trails de transactions animées sur les arêtes (dash offset animation)
- Fond très sombre `#070710`
- Couleur encodant la direction : entrant = vert, sortant = rouge

## Décisions retenues

### Palette

```
Fond          #060610  (near-black, légèrement violet)
Surface       #0d0d1a
Bord          rgba(255,255,255,0.08)
Texte         #e8e6f0
Texte muted   rgba(232,230,240,0.45)

Nœud wallet   #7c6df0  (violet — neutre)
Nœud contract #14b8a6  (teal — contrat)
Nœud exchange #f59e0b  (amber — exchange connu)
Nœud DEX pool #10b981  (vert — liquidity pool)

Lien entrant  #4ade80  (vert)
Lien sortant  #f87171  (rouge)
Lien neutre   rgba(148,163,184,0.2)

Accent data   #818cf8  (violet clair — valeurs élevées)
```

### Encodage visuel

| Attribut | Encodage 3D |
|----------|-------------|
| Volume tx | Rayon sphère (sqrt-scale, min 0.3, max 2.5) |
| Type entité | Couleur de base (voir palette) |
| Est "smart money" | Glow bloom + anneau pulsant |
| Volume lien | Opacité + épaisseur ligne |
| Tx récente | Particule animée sur l'arête |
| Sélectionné | Ring blanc + zoom caméra |

### Budget performance

| Scénario | Nœuds max | Liens max | FPS cible |
|----------|-----------|-----------|-----------|
| Wallet   | 150       | 500       | 60fps     |
| DeFi     | 80        | 200       | 60fps     |
| Contract | 100       | 300       | 60fps     |

Au-delà : clustering automatique des nœuds (nœuds "bundle" représentant N adresses similaires).

### Optimisations obligatoires

1. **InstancedMesh** pour les sphères — une seule draw call pour tous les nœuds
2. **LOD (Level of Detail)** — sphères à 8 segments < 50px, 32 segments > 200px
3. **Bloom sélectif** — uniquement sur les nœuds flaggés, pas global
4. **Labels lazy** — affichés uniquement si distance caméra < seuil
5. **Simulation force pausée** après convergence — économise 80% CPU

## Conséquences

- **Positif** : `InstancedMesh` réduit les draw calls de 150 → 1 pour les nœuds
- **Positif** : Bloom sélectif vs global = 3-4× moins de coût GPU
- **Négatif** : `InstancedMesh` complexifie la sélection par raycasting — nécessite un mesh proxy invisible pour le picking
- **Révision** : Si 60fps non atteignable sur mobile, désactiver le bloom et réduire les segments sphère à 8
