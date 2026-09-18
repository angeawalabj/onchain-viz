# OnChain Viz — 3D Blockchain Explorer

Visualisation 3D interactive des données on-chain Ethereum. Graphe de transactions wallet, liquidité DeFi (Uniswap V3, Aave), activité de smart contracts — avec un aesthetic level Bubblemaps.

## Stack

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 16 App Router |
| 3D | React Three Fiber + @react-three/drei |
| Post-processing | @react-three/postprocessing (bloom, vignette) |
| Layout graphe | d3-force-3d (simulation 3D) |
| State | Zustand (persistance localStorage) |
| Data | Etherscan API + The Graph + Alchemy |
| Style | Tailwind CSS + JetBrains Mono |
| Deploy | Vercel (gratuit, permanent) |

## Modes de visualisation

| Mode | Données | API requise |
|------|---------|-------------|
| **Wallet Graph** | Transactions d'une adresse, nœuds voisins, flux entrant/sortant | Etherscan (free) |
| **DeFi Liquidity** | Top pools Uniswap V3 / Aave / Curve par TVL | The Graph (free) |
| **Contract Activity** | Appelants d'un smart contract, fréquence, volume | Alchemy (free) |

Sans clé API → données de démo (25 nœuds réalistes).

## Démarrage local

```bash
git clone https://github.com/angeawalabj/onchain-viz
cd onchain-viz
npm install
npm run dev
# → http://localhost:3000
```

## Déploiement Vercel

```bash
npx vercel deploy --prod
# → https://onchain-viz.vercel.app (gratuit, permanent)
```

Aucune variable d'environnement côté serveur nécessaire. Les clés API sont saisies dans l'UI et stockées dans localStorage.

## Architecture

```
onchain-viz/
├── app/
│   ├── layout.tsx        ← metadata, polices
│   ├── globals.css       ← dark theme, scrollbar
│   └── page.tsx          ← assemblage sidebar + canvas + detail
├── components/
│   ├── Scene3D.tsx       ← Canvas R3F, postprocessing bloom
│   ├── GraphNodes.tsx    ← InstancedMesh sphères + sélection
│   ├── GraphEdges.tsx    ← LineSegments + particules flux
│   ├── NodeLabels.tsx    ← Billboard text SDF
│   ├── SearchPanel.tsx   ← Input + mode selector + presets
│   ├── NodeDetail.tsx    ← Panel latéral nœud sélectionné
│   └── ControlsBar.tsx   ← Stats + rotation + API keys
├── lib/
│   ├── types.ts          ← Types, palette, helpers
│   ├── store.ts          ← Zustand store global
│   ├── fetchers.ts       ← Etherscan, The Graph, Alchemy + mocks
│   └── useForceGraph.ts  ← Hook d3-force-3d simulation
└── docs/
    ├── ADR-0001-stack.md
    └── ADR-0002-design.md
```

## Optimisations performance

- **InstancedMesh** — 1 draw call pour tous les nœuds (150 → 1)
- **LineSegments BufferGeometry** — 1 draw call pour tous les liens
- **Bloom sélectif** — uniquement sur layer 1 (smart money + sélection)
- **Labels LOD** — affichés seulement pour les nœuds proches/sélectionnés
- **Simulation pausée** — d3-force arrêté après convergence (économise ~80% CPU)
- **Particules** — uniquement sur les liens à fort volume (> 15% du max)

## Design reference

Inspiré de : Bubblemaps, Nansen, Eigenphi, Parsec Finance.

Palette : fond `#060610`, nœuds PhysicalMaterial (metalness 0.6), bloom UnrealBloom, aberration chromatique, vignette.
