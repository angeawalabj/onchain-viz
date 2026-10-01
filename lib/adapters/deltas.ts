/**
 * Solana, Sui et Hedera exposent tous des variations de solde par transaction
 * (pre/post balances, balanceChanges, transfers). On en déduit des transferts
 * focal ↔ pairs avec une seule règle commune, appliquée actif par actif.
 */

export interface BalanceDelta {
  owner:  string;
  asset:  string;        // NATIVE ou identifiant du jeton (cf. lib/tokens.ts)
  amount: number;        // en unités du jeton (déjà divisé par les decimals)
}

export interface TxDeltas {
  timestamp: number;     // unix (secondes)
  deltas:    BalanceDelta[];
}

export interface Transfer {
  peer:      string;
  isOut:     boolean;    // true = focal → peer
  asset:     string;
  amount:    number;     // en unités du jeton
  timestamp: number;
}

/**
 * Pour chaque actif : si le focal en perd, les pairs crédités sont ses
 * destinataires (et inversement). Les montants des pairs sont ramenés
 * proportionnellement à la variation du focal, pour ne pas lui attribuer
 * des flux d'une transaction multi-parties qui ne le concernent pas.
 * Un swap SOL → USDC donne ainsi deux transferts (SOL sortant, USDC entrant).
 */
export function deltasToTransfers(focal: string, tx: TxDeltas): Transfer[] {
  const byAsset = new Map<string, BalanceDelta[]>();
  for (const d of tx.deltas) {
    const list = byAsset.get(d.asset);
    if (list) list.push(d); else byAsset.set(d.asset, [d]);
  }

  const out: Transfer[] = [];
  for (const [asset, deltas] of Array.from(byAsset.entries())) {
    let focalDelta = 0;
    for (const d of deltas) if (d.owner === focal) focalDelta += d.amount;
    if (focalDelta === 0) continue;

    const isOut = focalDelta < 0;
    const peers = new Map<string, number>();
    for (const d of deltas) {
      if (d.owner === focal) continue;
      if (isOut ? d.amount <= 0 : d.amount >= 0) continue;
      peers.set(d.owner, (peers.get(d.owner) ?? 0) + Math.abs(d.amount));
    }

    const total = Array.from(peers.values()).reduce((s, v) => s + v, 0);
    if (total === 0) continue;
    const scale = Math.min(1, Math.abs(focalDelta) / total);

    for (const [peer, amount] of Array.from(peers.entries())) {
      out.push({ peer, isOut, asset, amount: amount * scale, timestamp: tx.timestamp });
    }
  }
  return out;
}
