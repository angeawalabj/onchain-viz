/**
 * Solana, Sui et Hedera exposent tous des variations de solde par transaction
 * (pre/post balances, balanceChanges, transfers). On en déduit des transferts
 * focal ↔ pairs avec une seule règle commune.
 */

export interface BalanceDelta {
  owner:  string;
  amount: number;        // en unités du jeton natif (déjà divisé par les decimals)
}

export interface TxDeltas {
  timestamp: number;     // unix (secondes)
  deltas:    BalanceDelta[];
}

export interface NativeTransfer {
  peer:      string;
  isOut:     boolean;    // true = focal → peer
  amount:    number;     // en unités du jeton natif
  timestamp: number;
}

/**
 * Si le focal perd des jetons, les pairs dont le solde augmente sont ses
 * destinataires (et inversement). Les montants des pairs sont ramenés
 * proportionnellement à la variation du focal, pour ne pas lui attribuer
 * des flux d'une transaction multi-parties qui ne le concernent pas.
 */
export function deltasToTransfers(focal: string, tx: TxDeltas): NativeTransfer[] {
  let focalDelta = 0;
  for (const d of tx.deltas) if (d.owner === focal) focalDelta += d.amount;
  if (focalDelta === 0) return [];

  const isOut = focalDelta < 0;
  const peers = new Map<string, number>();
  for (const d of tx.deltas) {
    if (d.owner === focal) continue;
    if (isOut ? d.amount <= 0 : d.amount >= 0) continue;
    peers.set(d.owner, (peers.get(d.owner) ?? 0) + Math.abs(d.amount));
  }

  const total = Array.from(peers.values()).reduce((s, v) => s + v, 0);
  if (total === 0) return [];
  const scale = Math.min(1, Math.abs(focalDelta) / total);

  return Array.from(peers.entries()).map(([peer, amount]) => ({
    peer,
    isOut,
    amount:    amount * scale,
    timestamp: tx.timestamp,
  }));
}
