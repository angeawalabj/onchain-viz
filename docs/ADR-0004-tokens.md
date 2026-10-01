# ADR-0004 — Transferts de jetons (ERC-20, SPL, coins Sui, HTS)

| Champ       | Valeur                                       |
|-------------|----------------------------------------------|
| Statut      | **Accepté**                                  |
| Date        | 2026-10-01                                   |
| Tags        | tokens, prix, spam, etherscan, solana, sui, hedera |

## Contexte

ADR-0003 ne comptait que le jeton natif de chaque chaîne. Une grande partie de
l'activité réelle passe pourtant par des jetons (stablecoins surtout). Deux
problèmes : il faut un **prix USD** par jeton, et n'importe qui peut créer un
jeton nommé "USDC" et l'envoyer à des milliers d'adresses (**spam**).

## Décisions

### 1. Liste blanche par identifiant exact (`lib/tokens.ts`)

Un jeton est suivi uniquement si son identifiant on-chain est dans le registre
(adresse de contrat ERC-20, mint SPL, coin type Sui, token id HTS) — jamais
d'après son symbole. Tout le reste est ignoré. Identifiants, symboles et
décimales vérifiés on-chain le 2026-10-01.

| Chaîne   | Jetons suivis |
|----------|---------------|
| Ethereum | USDC, USDT, DAI, WETH, WBTC, stETH, LINK, UNI |
| Solana   | USDC, USDT, JUP, BONK, JitoSOL |
| Sui      | USDC, USDT (Wormhole), DEEP, CETUS, WAL |
| Hedera   | USDC, SAUCE |

Écartés volontairement :
- **wSOL** : wrap/unwrap = mouvements de lamports déjà comptés en SOL natif → double comptage.
- **HBARX** : absent de CoinGecko (pas de prix).
- **USDT Hedera (`0.0.1055472`)** et second USDT Sui : provenance non confirmée.

### 2. Un actif = une clé, la règle des deltas s'applique actif par actif

`BalanceDelta` et `Transfer` portent un champ `asset` (`"native"` ou
l'identifiant du registre). `deltasToTransfers` applique la règle d'ADR-0003
séparément pour chaque actif : un swap SOL → USDC produit deux transferts
(SOL sortant, USDC entrant).

| Chaîne   | Source des variations de jetons |
|----------|---------------------------------|
| Ethereum | Etherscan V2 `tokentx` (en plus de `txlist`) |
| Solana   | `preTokenBalances` / `postTokenBalances`, regroupés par `owner` |
| Sui      | `balanceChanges` (déjà récupérés), filtrés par coin type |
| Hedera   | `token_transfers` des transactions Mirror Node |

### 3. Prix : une requête CoinGecko par chaîne

`getAssetPrices(chain)` demande en une fois le natif + les jetons non stables
(cache 5 min par id). Stablecoins à $1 fixe. Si CoinGecko est indisponible,
le natif retombe sur son prix de secours et les jetons non stables sont
ignorés plutôt que mal valorisés.

### 4. Affichage

Un lien agrège tous les actifs en USD et garde la liste de leurs symboles
(`GraphLink.assets`), conservée par le clustering. Le panneau de détail
affiche les actifs échangés par le nœud et ceux de chaque connexion.

### 5. Correctif : Etherscan V1 → V2

L'API V1 (`api.etherscan.io/api`) répond désormais "deprecated V1 endpoint" :
le mode Ethereum réel ne fonctionnait plus. Passage à
`api.etherscan.io/v2/api?chainid=1`. "No transactions found" est traité comme
une liste vide, et les erreurs remontent le détail d'Etherscan
("Invalid API Key"…) au lieu de "NOTOK".

## Conséquences

- **Solana : jetons reçus** — résolu, voir l'addendum ci-dessous.
- Ajouter un jeton = une ligne dans `TOKENS` (identifiant vérifié + décimales
  + prix fixe ou id CoinGecko).

## Addendum (2026-10-01) — jetons reçus sur Solana

**Problème.** L'historique d'un wallet (`getSignaturesForAddress`) ne liste
que les transactions où son adresse figure. Un jeton reçu arrive sur le
compte de jetons associé (ATA) du wallet, souvent sans que l'adresse
principale apparaisse : la plupart des réceptions étaient invisibles.

**Contrainte.** Le RPC public refuse `getTokenAccountsByOwner` ("Indexed
requests require a personal token").

**Décision.** L'ATA est une adresse dérivée déterministe :
`PDA([wallet, TOKEN_PROGRAM, mint], ASSOCIATED_TOKEN_PROGRAM)`. On la calcule
localement (`lib/adapters/solana-ata.ts` : base58, SHA-256 et test
« sur la courbe » ed25519 en TypeScript pur, sans dépendance), pour chaque
mint du registre, puis on lit aussi l'historique de chaque ATA (10 signatures),
fusionné à celui du wallet (25) par date, plafonné aux 40 plus récentes.
Coût : 5 requêtes de signatures en plus, sans requête pour trouver les comptes.

Les 5 mints du registre appartiennent au programme SPL Token classique
(vérifié) ; un jeton Token-2022 demanderait l'autre programme dans la
dérivation. Les ATA calculées ont été vérifiées sur mainnet
(`getAccountInfo` : owner et mint attendus).

**Limites.** Les jetons détenus hors ATA (comptes de jetons auxiliaires,
fréquents chez les exchanges) restent hors champ. Le RPC public limite le
débit : des recherches très rapprochées peuvent récupérer moins de 40
transactions (une clé Helius lève la limite).

`tsconfig` passe en `target: ES2020` pour les littéraux BigInt (supportés par
tous les navigateurs actuels ; le code livré est produit par SWC).
