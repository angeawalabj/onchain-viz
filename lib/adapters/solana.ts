/**
 * Solana — RPC JSON public (publicnode, CORS ouvert) ou Helius si clé fournie.
 * getSignaturesForAddress puis un getTransaction par signature : publicnode
 * limite les batchs à 1 getTransaction, on parallélise donc par petits lots.
 */

import type { TxDeltas } from "./deltas";

const PUBLIC_RPC = "https://solana-rpc.publicnode.com";
const LAMPORTS   = 1e9;
const TX_LIMIT   = 25;
const CONCURRENCY = 5;

export function solanaRpcUrl(heliusKey: string): string {
  return heliusKey ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}` : PUBLIC_RPC;
}

async function rpc<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Solana RPC HTTP ${res.status}`);
  return res.json();
}

export async function fetchSolanaTxDeltas(address: string, heliusKey: string): Promise<TxDeltas[]> {
  const url = solanaRpcUrl(heliusKey);

  const sigRes = await rpc<{ result?: { signature: string; err: unknown }[]; error?: { message: string } }>(url, {
    jsonrpc: "2.0", id: 1,
    method:  "getSignaturesForAddress",
    params:  [address, { limit: TX_LIMIT }],
  });
  if (sigRes.error) throw new Error(sigRes.error.message);

  const sigs = (sigRes.result ?? []).filter((s) => !s.err).map((s) => s.signature);
  if (sigs.length === 0) return [];

  const txs: (SolanaTx | null)[] = [];
  for (let i = 0; i < sigs.length; i += CONCURRENCY) {
    const chunk = await Promise.all(sigs.slice(i, i + CONCURRENCY).map((sig) =>
      rpc<{ result?: SolanaTx | null }>(url, {
        jsonrpc: "2.0", id: 1,
        method:  "getTransaction",
        params:  [sig, { encoding: "json", maxSupportedTransactionVersion: 0 }],
      })
        .then((r) => r.result ?? null)
        .catch(() => null)           // une tx manquante ne bloque pas le graphe
    ));
    txs.push(...chunk);
  }

  return txs
    .filter((tx): tx is SolanaTx => !!tx)
    .map(solanaTxToDeltas);
}

export interface SolanaTx {
  blockTime: number | null;
  transaction: { message: { accountKeys: string[] } };
  meta: {
    err:          unknown;
    preBalances:  number[];
    postBalances: number[];
    loadedAddresses?: { writable: string[]; readonly: string[] };
  } | null;
}

/** Variation de solde SOL de chaque compte de la transaction. */
export function solanaTxToDeltas(tx: SolanaTx): TxDeltas {
  const timestamp = tx.blockTime ?? 0;
  if (!tx.meta || tx.meta.err) return { timestamp, deltas: [] };

  // Transactions v0 : les comptes des lookup tables suivent les clés statiques
  const keys = [
    ...tx.transaction.message.accountKeys,
    ...(tx.meta.loadedAddresses?.writable ?? []),
    ...(tx.meta.loadedAddresses?.readonly ?? []),
  ];

  const deltas = keys.map((owner, i) => ({
    owner,
    amount: ((tx.meta!.postBalances[i] ?? 0) - (tx.meta!.preBalances[i] ?? 0)) / LAMPORTS,
  })).filter((d) => d.amount !== 0);

  return { timestamp, deltas };
}
