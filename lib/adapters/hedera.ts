/**
 * Hedera — Mirror Node REST public (gratuit, sans clé, CORS ouvert).
 */

import type { BalanceDelta, TxDeltas } from "./deltas";
import { NATIVE, TOKENS, toUnits } from "../tokens";

const MIRROR_URL = "https://mainnet-public.mirrornode.hedera.com/api/v1";
const TX_LIMIT   = 100;

// Comptes système (nœuds, frais réseau 0.0.98, staking 0.0.800-0.0.802…) :
// présents dans quasiment chaque transaction, ce ne sont pas de vrais pairs.
const SYSTEM_ACCOUNT_MAX = 1000;

function isSystemAccount(id: string): boolean {
  const num = Number(id.split(".")[2]);
  return Number.isFinite(num) && num < SYSTEM_ACCOUNT_MAX;
}

export async function fetchHederaTxDeltas(accountId: string): Promise<TxDeltas[]> {
  const url = `${MIRROR_URL}/transactions?account.id=${accountId}&limit=${TX_LIMIT}&order=desc&transactiontype=CRYPTOTRANSFER`;
  const res = await fetch(url);
  if (res.status === 404) throw new Error(`Compte Hedera ${accountId} introuvable`);
  if (!res.ok) throw new Error(`Hedera Mirror Node HTTP ${res.status}`);
  const data: { transactions: HederaTx[] } = await res.json();
  return data.transactions.map((tx) => hederaTxToDeltas(tx, accountId));
}

export interface HederaTx {
  consensus_timestamp: string;          // "1790708555.389639985"
  result:              string;
  transfers:           { account: string; amount: number }[];
  token_transfers?:    { token_id: string; account: string; amount: number }[];
}

export function hederaTxToDeltas(tx: HederaTx, focal: string): TxDeltas {
  const timestamp = Math.floor(parseFloat(tx.consensus_timestamp));
  if (tx.result !== "SUCCESS") return { timestamp, deltas: [] };

  const keep = (account: string) => account === focal || !isSystemAccount(account);

  const deltas: BalanceDelta[] = tx.transfers
    .filter((t) => keep(t.account))
    .map((t) => ({ owner: t.account, asset: NATIVE, amount: toUnits(t.amount, 8) }));

  for (const t of tx.token_transfers ?? []) {
    const token = TOKENS.hedera[t.token_id];
    if (token && keep(t.account)) {
      deltas.push({ owner: t.account, asset: t.token_id, amount: toUnits(t.amount, token.decimals) });
    }
  }
  return { timestamp, deltas };
}
