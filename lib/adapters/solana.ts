/**
 * Solana — RPC JSON public (publicnode, CORS ouvert) ou Helius si clé fournie.
 * getSignaturesForAddress puis un getTransaction par signature : publicnode
 * limite les batchs à 1 getTransaction, on parallélise donc par petits lots.
 *
 * Les jetons reçus arrivent sur les comptes de jetons associés (ATA) du
 * wallet, pas sur son adresse : on lit aussi l'historique de l'ATA de chaque
 * jeton suivi, puis on fusionne les signatures par date.
 */

import type { BalanceDelta, TxDeltas } from "./deltas";
import { NATIVE, TOKENS, toUnits } from "../tokens";
import { associatedTokenAddress } from "./solana-ata";

const PUBLIC_RPC = "https://solana-rpc.publicnode.com";
const LAMPORTS   = 1e9;
const TX_LIMIT   = 25;      // signatures du wallet
const ATA_LIMIT  = 10;      // signatures par compte de jetons
const TX_CAP     = 40;      // transactions récupérées au total (les plus récentes)
const CONCURRENCY = 5;

interface SignatureInfo { signature: string; err: unknown; blockTime?: number | null }

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

async function signaturesOf(url: string, address: string, limit: number): Promise<SignatureInfo[]> {
  const res = await rpc<{ result?: SignatureInfo[]; error?: { message: string } }>(url, {
    jsonrpc: "2.0", id: 1,
    method:  "getSignaturesForAddress",
    params:  [address, { limit }],
  });
  if (res.error) throw new Error(res.error.message);
  return res.result ?? [];
}

/** Fusionne plusieurs historiques : sans doublon, sans échec, du plus récent au plus ancien. */
export function mergeSignatures(lists: SignatureInfo[][], cap: number): string[] {
  const seen = new Map<string, number>();
  for (const list of lists) {
    for (const s of list) if (!s.err) seen.set(s.signature, s.blockTime ?? 0);
  }
  return Array.from(seen.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map(([sig]) => sig);
}

export async function fetchSolanaTxDeltas(address: string, heliusKey: string): Promise<TxDeltas[]> {
  const url = solanaRpcUrl(heliusKey);

  // L'historique du wallet est obligatoire ; celui des comptes de jetons est un
  // complément (un compte jamais créé renvoie simplement une liste vide)
  const atas = Object.keys(TOKENS.solana).map((mint) => associatedTokenAddress(address, mint));
  const [own, ...tokenHistories] = await Promise.all([
    signaturesOf(url, address, TX_LIMIT),
    ...atas.map((ata) => signaturesOf(url, ata, ATA_LIMIT).catch(() => [])),
  ]);

  const sigs = mergeSignatures([own, ...tokenHistories], TX_CAP);
  if (sigs.length === 0) return [];

  const txs: (SolanaTx | null)[] = [];
  for (let i = 0; i < sigs.length; i += CONCURRENCY) {
    const chunk = await Promise.all(sigs.slice(i, i + CONCURRENCY).map((sig) =>
      fetchTx(url, sig).catch(() => null)   // une tx manquante ne bloque pas le graphe
    ));
    txs.push(...chunk);
  }

  return txs
    .filter((tx): tx is SolanaTx => !!tx)
    .map(solanaTxToDeltas);
}

/** getTransaction avec un nouvel essai : l'endpoint public limite le débit. */
async function fetchTx(url: string, sig: string, retries = 1): Promise<SolanaTx | null> {
  const r = await rpc<{ result?: SolanaTx | null; error?: unknown }>(url, {
    jsonrpc: "2.0", id: 1,
    method:  "getTransaction",
    params:  [sig, { encoding: "json", maxSupportedTransactionVersion: 0 }],
  }).catch(() => ({ error: true, result: undefined }));
  if (r.result !== undefined && !r.error) return r.result;
  if (retries <= 0) return null;
  await new Promise((ok) => setTimeout(ok, 400));
  return fetchTx(url, sig, retries - 1);
}

interface TokenBalance {
  accountIndex:  number;
  mint:          string;
  owner?:        string;
  uiTokenAmount: { amount: string };
}

export interface SolanaTx {
  blockTime: number | null;
  transaction: { message: { accountKeys: string[] } };
  meta: {
    err:          unknown;
    preBalances:  number[];
    postBalances: number[];
    loadedAddresses?: { writable: string[]; readonly: string[] };
    preTokenBalances?:  TokenBalance[];
    postTokenBalances?: TokenBalance[];
  } | null;
}

/**
 * Variations de solde de la transaction : SOL natif par compte, et jetons du
 * registre par propriétaire (owner) du compte de jetons.
 */
export function solanaTxToDeltas(tx: SolanaTx): TxDeltas {
  const timestamp = tx.blockTime ?? 0;
  if (!tx.meta || tx.meta.err) return { timestamp, deltas: [] };

  // Transactions v0 : les comptes des lookup tables suivent les clés statiques
  const keys = [
    ...tx.transaction.message.accountKeys,
    ...(tx.meta.loadedAddresses?.writable ?? []),
    ...(tx.meta.loadedAddresses?.readonly ?? []),
  ];

  const deltas: BalanceDelta[] = keys.map((owner, i) => ({
    owner,
    asset:  NATIVE,
    amount: ((tx.meta!.postBalances[i] ?? 0) - (tx.meta!.preBalances[i] ?? 0)) / LAMPORTS,
  })).filter((d) => d.amount !== 0);

  // Jetons : post − pre par compte de jetons (absent d'un côté = compte créé/fermé)
  const tokenAccounts = new Map<number, { owner: string; mint: string; pre: number; post: number }>();
  for (const [side, list] of [["pre", tx.meta.preTokenBalances], ["post", tx.meta.postTokenBalances]] as const) {
    for (const b of list ?? []) {
      const token = TOKENS.solana[b.mint];
      if (!token || !b.owner) continue;
      const acc = tokenAccounts.get(b.accountIndex) ?? { owner: b.owner, mint: b.mint, pre: 0, post: 0 };
      acc[side] = toUnits(b.uiTokenAmount.amount, token.decimals);
      tokenAccounts.set(b.accountIndex, acc);
    }
  }
  for (const acc of Array.from(tokenAccounts.values())) {
    const amount = acc.post - acc.pre;
    if (amount !== 0) deltas.push({ owner: acc.owner, asset: acc.mint, amount });
  }

  return { timestamp, deltas };
}
