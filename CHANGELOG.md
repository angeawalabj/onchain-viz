# Changelog

## [1.0.0] — 2026-07-07

### Ajouté

**Architecture**
- Next.js 16 App Router + React Three Fiber — canvas WebGL `dynamic()` côté client uniquement
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

### Ajouté — multi-chaînes (ADR-0003)
- Sélecteur de chaîne : Ethereum, Solana, Sui, Hedera (mode Wallet Graph)
- `lib/chains.ts` — format d'adresse, presets, explorateurs et labels par chaîne
- Adapters sans clé API : Solana (RPC publicnode, Helius optionnel), Sui (GraphQL + SuiNS), Hedera (Mirror Node)
- Transferts déduits des variations de solde (`lib/adapters/deltas.ts`), règle commune aux 3 chaînes
- Prix USD via CoinGecko (cache 5 min, prix de secours) — remplace l'approximation ETH ≈ $3000
- Données de démo au format de chaque chaîne ; liens explorateurs par chaîne (Solscan, Suiscan, HashScan…)
- 25 tests (adapters sur réponses réelles, validation d'adresses, graphe wallet)

### Ajouté — transferts de jetons (ADR-0004)
- Registre de jetons par chaîne (`lib/tokens.ts`), identifiés par contrat/mint/coin type/token id exact — protège du spam
  - Ethereum : USDC, USDT, DAI, WETH, WBTC, stETH, LINK, UNI
  - Solana : USDC, USDT, JUP, BONK, JitoSOL · Sui : USDC, USDT, DEEP, CETUS, WAL · Hedera : USDC, SAUCE
- Variations de solde par actif ; un swap donne deux transferts (actif vendu, actif reçu)
- Prix de tous les actifs en une requête CoinGecko par chaîne (stablecoins à $1)
- Liens : liste des symboles échangés ; panneau de détail : actifs du nœud et de chaque connexion
- 17 tests (adapters jetons sur réponses réelles, registre, prix, Etherscan V2)

### Ajouté — jetons reçus sur Solana
- Calcul local des comptes de jetons associés (ATA) du wallet pour chaque jeton suivi (`lib/adapters/solana-ata.ts`, sans dépendance) — le RPC public refuse `getTokenAccountsByOwner`
- Historique du wallet + de ses ATA fusionné par date (40 transactions max) : les réceptions de jetons apparaissent
- `tsconfig` : `target` ES2020 (littéraux BigInt)
- 11 tests (SHA-256 sur vecteurs de référence, base58, courbe ed25519, ATA vérifiées sur mainnet, fusion des historiques)

### Ajouté — rejeu dans le temps
- Barre de rejeu sous la scène : lecture/pause, curseur, date courante, retour au graphe complet (`components/Timeline.tsx`)
- Chaque lien garde ses transferts datés (`GraphLink.events`) ; à l'instant t, seuls les liens déjà actifs sont affichés, avec le volume cumulé jusqu'à t (`lib/replay.ts`)
- La disposition est calculée une fois sur le graphe complet : le rejeu ne relance aucune simulation
- Événements conservés par le clustering (fusion) et par l'exploration de nœuds (vue la plus complète)
- 11 tests (bornes, filtrage, événements de bout en bout)

### Ajouté — suivre l'argent
- Bouton « Explorer ses transactions » dans le panneau de détail : charge les contreparties du nœud et les fusionne au graphe (`lib/expand.ts`), à répéter de proche en proche
- Le lien vu des deux côtés n'est pas doublé ; le focal d'origine reste le centre ; nœuds explorés entourés d'un anneau
- Positions conservées entre deux simulations : les nœuds déjà affichés ne bougent plus, les nouveaux apparaissent près de leur voisin
- Bouton désactivé (avec raison) sur données de démo, nœuds agrégés, hors mode Wallet
- 10 tests (fusion, conditions d'exploration, positions initiales)

### Corrigé
- Deux simulations tournaient en parallèle (page + scène 3D) : CPU doublé, et la scène affichait le graphe non clusterisé. Une seule simulation, partagée
- Particules de flux : tableau de progression dimensionné une seule fois → particules invalides (NaN) dès que le nombre de liens augmentait ; géométries remplacées désormais libérées
- Bandeau « données démo » affiché seulement sur les données de démo
- Au-delà du budget de nœuds, le clustering recréait le graphe à chaque rendu et relançait la simulation en boucle (mémoïsation)
- Etherscan V1 désactivé par Etherscan → passage à l'API V2 (le mode Ethereum réel ne fonctionnait plus)
- Erreurs Etherscan : message détaillé ("Invalid API Key"…) au lieu de "NOTOK" ; adresse sans transaction = graphe vide, pas une erreur

### À venir

- Support ENS pour les presets dans le sélecteur de collection
- Historique des recherches (localStorage)
- Export du graphe en PNG / SVG
- Mode fullscreen
- Filtres par type de nœud
