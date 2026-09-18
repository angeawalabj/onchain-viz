# Changelog

## [1.0.0] — 2026-07-07

### Ajouté

**Architecture**
- Next.js 14 App Router + React Three Fiber — canvas WebGL `dynamic()` côté client uniquement
- Zustand store avec persistance localStorage (clés API + préférences)
- 2 ADR (stack technique, design system) documentant les décisions

**Visualisation 3D**
- `Scene3D` — Canvas R3F avec ACESFilmicToneMapping, 3 point lights colorés, `Environment preset="night"`
- `GraphNodes` — `<Instances>` drei (1 draw call pour tous les nœuds), pulsation smart money, anneau sélection
- `GraphEdges` — `LineSegments` BufferGeometry (1 draw call), couleur par direction flux, particules animées sur liens importants
- `NodeLabels` — Billboard SDF toujours face caméra, labels lazily affichés (sélectionnés + top 5 volume)
- Post-processing : Bloom UnrealBloom sélectif + ChromaticAberration + Vignette

**Données on-chain**
- 3 fetchers réels : Etherscan (wallet), The Graph Uniswap V3 (DeFi), Alchemy eth_getLogs (contract)
- Mock data réaliste pour les 3 modes (25–40 nœuds, volumes variés, types mixtes)
- Fallback automatique mock si pas de clé API ou erreur réseau

**ENS**
- `lib/ens.ts` — résolution ENS → adresse via viem + pool de 4 RPCs publics
- Lookup inverse adresse → nom ENS dans `NodeDetail`
- Cache mémoire pour éviter les requêtes répétées

**Clustering**
- `lib/clustering.ts` — budget de nœuds par mode (150/80/100)
- Nœuds bundle agrégés par type avec volume et txCount cumulés
- Liens fusionnés vers les bundles, sans self-loops

**UI**
- `SearchPanel` — 3 modes switchables, presets (vitalik.eth, USDC, Uniswap V3), résolution ENS inline
- `NodeDetail` — stats, inflow/outflow, top connexions, liens Etherscan/Zerion/DeBank
- `ControlsBar` — métriques live, autoRotate, panel clés API
- Page 404, Loading skeleton, Error boundary

**Tests**
- 41 tests unitaires (Vitest + jsdom) : types helpers, clustering, mock fetchers

**Métriques**
| Indicateur | Valeur |
|------------|--------|
| Tests | 41/41 |
| Erreurs TypeScript | 0 |
| Build production | ✓ |
| Draw calls nœuds | 1 (InstancedMesh) |
| Draw calls liens | 1 (LineSegments) |
| Budget nœuds wallet | 150 max |
| Coût déploiement | 0 € (Vercel) |

## [Unreleased]

- Support ENS pour les presets dans le sélecteur de collection
- Historique des recherches (localStorage)
- Export du graphe en PNG / SVG
- Mode fullscreen
- Filtres par type de nœud
