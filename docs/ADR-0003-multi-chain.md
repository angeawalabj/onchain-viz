# ADR-0003 — Support multi-chaînes (Ethereum, Solana, Sui, Hedera)

| Champ       | Valeur                                   |
|-------------|------------------------------------------|
| Statut      | **Accepté**                              |
| Date        | 2026-10-01                               |
| Tags        | blockchain, api, solana, sui, hedera     |

## Contexte

Le mode Wallet Graph ne lisait qu'Ethereum (Etherscan). On veut explorer aussi
Solana, Sui et Hedera, toujours sans backend et si possible sans clé API.
Les quatre chaînes n'ont ni le même format d'adresse, ni le même modèle de
transaction, ni d'équivalent commun à `txlist` d'Etherscan.

## Décisions

### 1. Une config par chaîne (`lib/chains.ts`)

Format et normalisation d'adresse, presets, labels connus, explorateurs,
jeton natif et modes supportés sont déclarés dans une seule table `CHAINS`.
Ajouter une chaîne = une entrée dans la table + un adapter.

Normalisation : Ethereum en minuscules, Sui paddé sur 64 hex, Solana **non**
modifié (base58 sensible à la casse), Hedera tel quel (`0.0.N`).

### 2. Les transferts sont déduits des variations de solde

Solana (`preBalances`/`postBalances`), Sui (`balanceChanges`) et Hedera
(`transfers`) exposent tous la variation de solde de chaque compte par
transaction. `lib/adapters/deltas.ts` applique une règle unique : si le focal
perd des jetons, les comptes crédités sont ses destinataires (et inversement),
montants ramenés proportionnellement à la variation du focal pour ne pas lui
attribuer les flux d'une transaction multi-parties.

Seul le jeton natif est compté (SOL, SUI, HBAR, ETH) — les tokens demandent
un prix par token, hors périmètre de cette étape.

### 3. Sources de données

| Chaîne   | Source                                  | Clé            | Contraintes constatées |
|----------|-----------------------------------------|----------------|------------------------|
| Ethereum | Etherscan `txlist`                      | requise        | —                      |
| Solana   | `solana-rpc.publicnode.com` (ou Helius) | optionnelle    | `api.mainnet-beta.solana.com` renvoie 403 ; publicnode limite à 1 `getTransaction` par batch → requêtes unitaires, 5 en parallèle |
| Sui      | GraphQL `graphql.mainnet.sui.io`        | aucune         | JSON-RPC des fullnodes publics déprécié ; SuiNS (`*.sui`) résolu via `address(name:)` |
| Hedera   | Mirror Node REST                        | aucune         | comptes système `< 0.0.1000` (frais, staking 0.0.800–802) exclus des pairs |

Prix USD : CoinGecko `simple/price` (sans clé, cache 5 min), avec un prix fixe
de secours par chaîne.

### 4. Modes DeFi et Contract : Ethereum uniquement pour l'instant

Les boutons sont désactivés sur les autres chaînes ; changer de chaîne repasse
en mode Wallet si le mode actif n'y est pas disponible.

## Conséquences

- Solana, Sui et Hedera fonctionnent sans aucune clé ; Ethereum garde son
  fallback démo sans clé Etherscan.
- Les endpoints publics peuvent limiter le débit : une transaction Solana
  en échec est ignorée plutôt que de faire échouer tout le graphe.
- Les transferts de tokens (SPL, coins Sui, HTS, ERC-20) ne sont pas encore
  représentés.
