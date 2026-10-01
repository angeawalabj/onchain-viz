/**
 * Sui — API GraphQL publique (le JSON-RPC des fullnodes publics est déprécié).
 * Résolution SuiNS (*.sui) incluse.
 */

import type { BalanceDelta, TxDeltas } from "./deltas";
import { NATIVE, TOKENS, toUnits } from "../tokens";

const GRAPHQL_URL = "https://graphql.mainnet.sui.io/graphql";
const TX_LIMIT    = 50;
const SUI_COIN    = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Sui GraphQL HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

/** Résout un nom SuiNS (ex: example.sui) en adresse. */
export async function resolveSuiName(name: string): Promise<string> {
  const data = await gql<{ address: { address: string } | null }>(
    `query($name: String!) { address(name: $name) { address } }`,
    { name }
  );
  if (!data.address) throw new Error(`Nom SuiNS "${name}" introuvable`);
  return data.address.address;
}

const TX_QUERY = `
  query($addr: SuiAddress!, $last: Int!) {
    transactions(last: $last, filter: { affectedAddress: $addr }) {
      nodes {
        effects {
          timestamp
          balanceChanges(first: 50) {
            nodes { owner { address } coinType { repr } amount }
          }
        }
      }
    }
  }`;

export async function fetchSuiTxDeltas(address: string): Promise<TxDeltas[]> {
  const data = await gql<{ transactions: { nodes: SuiTx[] } }>(TX_QUERY, { addr: address, last: TX_LIMIT });
  return data.transactions.nodes.map(suiTxToDeltas);
}

export interface SuiTx {
  effects: {
    timestamp: string | null;
    balanceChanges: {
      nodes: { owner: { address: string } | null; coinType: { repr: string } | null; amount: string }[];
    };
  } | null;
}

/** Garde le SUI natif et les coins du registre, sur des propriétaires adresses. */
export function suiTxToDeltas(tx: SuiTx): TxDeltas {
  const ts = tx.effects?.timestamp ? Date.parse(tx.effects.timestamp) / 1000 : 0;
  const deltas: BalanceDelta[] = [];
  for (const c of tx.effects?.balanceChanges.nodes ?? []) {
    const repr = c.coinType?.repr;
    if (!c.owner || !repr) continue;
    if (repr === SUI_COIN) {
      deltas.push({ owner: c.owner.address, asset: NATIVE, amount: toUnits(c.amount, 9) });
    } else if (TOKENS.sui[repr]) {
      deltas.push({ owner: c.owner.address, asset: repr, amount: toUnits(c.amount, TOKENS.sui[repr].decimals) });
    }
  }
  return { timestamp: ts, deltas };
}
