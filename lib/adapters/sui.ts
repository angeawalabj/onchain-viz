/**
 * Sui — API GraphQL publique (le JSON-RPC des fullnodes publics est déprécié).
 * Résolution SuiNS (*.sui) incluse.
 */

import type { TxDeltas } from "./deltas";

const GRAPHQL_URL = "https://graphql.mainnet.sui.io/graphql";
const MIST        = 1e9;
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

/** Ne garde que les variations en SUI natif, sur des propriétaires adresses. */
export function suiTxToDeltas(tx: SuiTx): TxDeltas {
  const ts = tx.effects?.timestamp ? Date.parse(tx.effects.timestamp) / 1000 : 0;
  const deltas = (tx.effects?.balanceChanges.nodes ?? [])
    .filter((c) => c.owner && c.coinType?.repr === SUI_COIN)
    .map((c) => ({ owner: c.owner!.address, amount: Number(c.amount) / MIST }));
  return { timestamp: ts, deltas };
}
