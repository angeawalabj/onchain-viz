# ADR-0001 — Stack technique : R3F, données on-chain, rendu

| Champ       | Valeur                              |
|-------------|--------------------------------------|
| Statut      | **Accepté**                          |
| Date        | 2026-07-03                           |
| Tags        | r3f, three.js, blockchain, api, viz  |

## Contexte

Le projet doit visualiser des données on-chain en 3D dans un navigateur, sans backend, avec un design de niveau production (Bubblemaps, Nansen). Trois décisions structurantes :

1. **Three.js vanilla vs React Three Fiber** — lequel pour ce projet ?
2. **Quelle API blockchain** — sans backend, sans clé API obligatoire ?
3. **Algorithme de layout 3D** — comment positionner les nœuds ?

## Décisions

### 1. React Three Fiber (R3F)

**Retenu** — R3F est le standard de facto pour la viz 3D on-chain en 2025-2026 :
- Bubblemaps, Galaxy.eco, Zapper utilisent R3F ou Three.js encapsulé dans React
- `@react-three/drei` fournit `OrbitControls`, `Billboard`, `Sparkles` out of the box
- `@react-three/postprocessing` donne le bloom/glow en une ligne — exactement l'aesthetic voulu
- Intégration naturelle avec le state React pour les 3 modes (wallet / DeFi / contract)

Three.js vanilla reste utilisé en dessous (R3F est un wrapper) — la connaissance existante est donc totalement réutilisée.

### 2. Sources de données

| Source | Données | Auth | Limite |
|--------|---------|------|--------|
| **Etherscan API** | Transactions wallet, token transfers | Clé gratuite | 5 req/s |
| **The Graph (free)** | Subgraphs Uniswap V3, Aave | Clé gratuite | 1000 req/jour |
| **Alchemy (free tier)** | NFT, traces, receipts | Clé gratuite | 300M compute units |
| **CoinGecko (no auth)** | Volumes, prix tokens | Aucune | 30 req/min |

Architecture : les clés API sont entrées par l'utilisateur dans l'UI (localStorage) — le projet ne nécessite pas de backend. Fallback sur des données mockées si pas de clé.

### 3. Layout 3D — force-directed graph

Algorithme : **force simulation** (d3-force-3d) avec :
- Force de répulsion entre nœuds (évite le clustering)
- Force d'attraction sur les liens (arêtes pondérées par le volume)
- Force centrale (garde le graphe dans la vue)
- 300 ticks max, puis animation continue avec amortissement

Encodage visuel :
- **Taille du nœud** → volume total de transactions (sqrt pour éviter les outliers)
- **Couleur** → type (wallet = violet, contract = teal, exchange = amber)
- **Opacité du lien** → force de la relation (volume relatif)
- **Glow/bloom** → nœuds "smart money" ou à fort volume

## Conséquences

- **Positif** : Zéro backend, déployable sur Vercel gratuitement et définitivement
- **Positif** : R3F + drei + postprocessing → aesthetic Bubblemaps en < 100 lignes
- **Négatif** : L'API Etherscan a une limite à 5 tx/s — pagination nécessaire pour les gros wallets
- **Négatif** : d3-force-3d est lourd (~80KB) — lazy load au premier render
- **Révision** : Si The Graph annonce des subgraphs payants, migrer vers une API self-hosted (graph-node Docker)
