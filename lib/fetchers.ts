/**
 * Fetchers de données on-chain.
 * Chaque fetcher retourne un GraphData normalisé.
 * Fallback sur des données mockées si pas de clé API.
 */

import type {
  Chain, GraphData, GraphLink, GraphNode,
  WalletGraphParams, DefiGraphParams, ContractGraphParams,
  NodeType,
} from "./types";
import { shortAddr } from "./types";
import { CHAINS } from "./chains";
import { getUsdPrice } from "./prices";
import { deltasToTransfers, type NativeTransfer, type TxDeltas } from "./adapters/deltas";
import { fetchSolanaTxDeltas } from "./adapters/solana";
import { fetchSuiTxDeltas } from "./adapters/sui";
import { fetchHederaTxDeltas } from "./adapters/hedera";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function checksumAddr(addr: string): string {
  return addr.toLowerCase();
}

/** Classe une adresse : exchange connu, contract, ou wallet */
function classifyAddress(addr: string, chain: Chain = "ethereum"): { type: NodeType; label: string } {
  const cfg   = CHAINS[chain];
  const known = cfg.knownLabels[cfg.normalize(addr)];
  if (known) return { type: "exchange", label: known };
  return { type: "wallet", label: shortAddr(addr) };
}

// ─── Mode Wallet — multi-chaînes ──────────────────────────────────────────────

export interface WalletApiKeys {
  etherscanKey: string;
  heliusKey:    string;
}

export async function fetchWalletGraph(
  params: WalletGraphParams,
  keys: WalletApiKeys
): Promise<GraphData> {
  const { chain, minVolume } = params;
  const address = CHAINS[chain].normalize(params.address);

  let transfers: NativeTransfer[];
  if (chain === "ethereum") {
    if (!keys.etherscanKey) return mockWalletGraph(address, chain);
    transfers = await fetchEtherscanTransfers(address, keys.etherscanKey);
  } else {
    const txs: TxDeltas[] =
      chain === "solana" ? await fetchSolanaTxDeltas(address, keys.heliusKey)
      : chain === "sui"  ? await fetchSuiTxDeltas(address)
      :                    await fetchHederaTxDeltas(address);
    transfers = txs.flatMap((tx) => deltasToTransfers(address, tx));
  }

  const price = await getUsdPrice(chain);
  const graph = buildWalletGraph(chain, address, transfers, price, minVolume);
  if (graph.links.length === 0) {
    throw new Error(`Aucun transfert ${CHAINS[chain].symbol} ≥ $${minVolume} dans les dernières transactions`);
  }
  return graph;
}

/** Agrège des transferts focal ↔ pairs en nœuds + liens (un lien par sens). */
export function buildWalletGraph(
  chain: Chain,
  address: string,
  transfers: NativeTransfer[],
  priceUSD: number,
  minVolume: number
): GraphData {
  const nodeMap = new Map<string, GraphNode>();
  const linkMap = new Map<string, GraphLink>();

  // Nœud central
  const { type: centerType, label: centerLabel } = classifyAddress(address, chain);
  nodeMap.set(address, {
    id:           address,
    type:         centerType,
    label:        centerLabel,
    volume:       0,
    txCount:      0,
    isSmartMoney: false,
    isFocused:    true,
  });

  for (const t of transfers) {
    const valueUSD = t.amount * priceUSD;
    if (!t.peer || t.peer === address || valueUSD < minVolume) continue;

    const peerAddr = CHAINS[chain].normalize(t.peer);
    const isOut    = t.isOut;

    // Nœud pair
    if (!nodeMap.has(peerAddr)) {
      const { type, label } = classifyAddress(peerAddr, chain);
      nodeMap.set(peerAddr, {
        id: peerAddr, type, label,
        volume: 0, txCount: 0,
        isSmartMoney: false, isFocused: false,
      });
    }

    // Met à jour les volumes
    const centerNode = nodeMap.get(address)!;
    centerNode.volume  += valueUSD;
    centerNode.txCount += 1;

    const peerNode = nodeMap.get(peerAddr)!;
    peerNode.volume  += valueUSD;
    peerNode.txCount += 1;

    // Lien
    const linkKey = isOut
      ? `${address}→${peerAddr}`
      : `${peerAddr}→${address}`;

    if (linkMap.has(linkKey)) {
      const link = linkMap.get(linkKey)!;
      link.volume  += valueUSD;
      link.txCount += 1;
    } else {
      linkMap.set(linkKey, {
        source:    isOut ? address : peerAddr,
        target:    isOut ? peerAddr : address,
        volume:    valueUSD,
        txCount:   1,
        direction: isOut ? "out" : "in",
        timestamp: t.timestamp,
      });
    }
  }

  return {
    nodes:         Array.from(nodeMap.values()),
    links:         Array.from(linkMap.values()),
    centerAddress: address,
    fetchedAt:     Date.now(),
  };
}

// ─── Adapter Ethereum — Etherscan API ─────────────────────────────────────────

async function fetchEtherscanTransfers(address: string, etherscanKey: string): Promise<NativeTransfer[]> {
  const base = "https://api.etherscan.io/api";

  // Récupère les 100 dernières transactions normales
  const url = `${base}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc&apikey=${etherscanKey}`;
  const res  = await fetch(url);
  const data = await res.json();

  if (data.status !== "1") throw new Error(data.message || "Etherscan error");

  const txs: EtherscanTx[] = data.result;
  return txs.map((tx) => {
    const isOut = tx.from.toLowerCase() === address;
    return {
      peer:      (isOut ? tx.to : tx.from).toLowerCase(),   // to vide = création de contrat
      isOut,
      amount:    Number(tx.value) / 1e18,
      timestamp: parseInt(tx.timeStamp),
    };
  });
}

interface EtherscanTx {
  from:      string;
  to:        string;
  value:     string;
  timeStamp: string;
  hash:      string;
}

// ─── Mode DeFi — The Graph (Uniswap V3) ──────────────────────────────────────

export async function fetchDefiGraph(
  params: DefiGraphParams,
  graphApiKey: string
): Promise<GraphData> {
  if (!graphApiKey && params.protocol === "uniswap_v3") {
    return mockDefiGraph();
  }

  // Subgraph Uniswap V3 Ethereum
  const endpoint = "https://gateway.thegraph.com/api/" + graphApiKey +
    "/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV";

  const query = `{
    pools(first: ${params.topN}, orderBy: totalValueLockedUSD, orderDirection: desc) {
      id
      token0 { id symbol }
      token1 { id symbol }
      totalValueLockedUSD
      volumeUSD
      txCount
    }
  }`;

  const res  = await fetch(endpoint, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ query }),
  });
  const { data } = await res.json();

  const nodeMap = new Map<string, GraphNode>();
  const links:   GraphLink[] = [];

  for (const pool of data.pools) {
    // Nœud pool
    const poolId = checksumAddr(pool.id);
    nodeMap.set(poolId, {
      id:           poolId,
      type:         "dex_pool",
      label:        `${pool.token0.symbol}/${pool.token1.symbol}`,
      volume:       parseFloat(pool.volumeUSD),
      txCount:      parseInt(pool.txCount),
      isSmartMoney: false,
      isFocused:    false,
    });

    // Nœuds tokens
    for (const token of [pool.token0, pool.token1]) {
      const tid = checksumAddr(token.id);
      if (!nodeMap.has(tid)) {
        nodeMap.set(tid, {
          id:           tid,
          type:         "token",
          label:        token.symbol,
          volume:       parseFloat(pool.totalValueLockedUSD) / 2,
          txCount:      0,
          isSmartMoney: false,
          isFocused:    false,
        });
      }
      links.push({
        source:    tid,
        target:    poolId,
        volume:    parseFloat(pool.totalValueLockedUSD) / 2,
        txCount:   parseInt(pool.txCount),
        direction: "both",
        timestamp: Date.now() / 1000,
      });
    }
  }

  return { nodes: Array.from(nodeMap.values()), links, fetchedAt: Date.now() };
}

// ─── Mode Contract — Alchemy (events) ────────────────────────────────────────

export async function fetchContractGraph(
  params: ContractGraphParams,
  alchemyKey: string
): Promise<GraphData> {
  if (!alchemyKey) return mockContractGraph(params.address);

  const url  = `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  const body = {
    jsonrpc: "2.0", id: 1,
    method:  "eth_getLogs",
    params:  [{
      address:   params.address,
      fromBlock: `0x${params.fromBlock.toString(16)}`,
      toBlock:   `0x${params.toBlock.toString(16)}`,
    }],
  };

  const res  = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  const { result: logs } = await res.json();

  const callerMap = new Map<string, { count: number; lastBlock: number }>();

  for (const log of (logs || [])) {
    // Pour les Transfer events ERC-20 : topic[1] = from, topic[2] = to
    if (log.topics.length >= 3) {
      const from = "0x" + log.topics[1].slice(26);
      const to   = "0x" + log.topics[2].slice(26);
      for (const addr of [from, to]) {
        const existing = callerMap.get(addr) || { count: 0, lastBlock: 0 };
        callerMap.set(addr, {
          count:     existing.count + 1,
          lastBlock: Math.max(existing.lastBlock, parseInt(log.blockNumber, 16)),
        });
      }
    }
  }

  const contractNode: GraphNode = {
    id:           checksumAddr(params.address),
    type:         "contract",
    label:        shortAddr(params.address),
    volume:       0,
    txCount:      logs?.length || 0,
    isSmartMoney: false,
    isFocused:    true,
  };

  const nodes: GraphNode[] = [contractNode];
  const links: GraphLink[] = [];

  for (const [addr, stats] of Array.from(callerMap.entries()).slice(0, 80)) {
    const { type, label } = classifyAddress(addr);
    nodes.push({
      id:           checksumAddr(addr),
      type,
      label,
      volume:       stats.count * 100,   // approximation
      txCount:      stats.count,
      isSmartMoney: stats.count > 20,
      isFocused:    false,
    });
    links.push({
      source:    checksumAddr(addr),
      target:    checksumAddr(params.address),
      volume:    stats.count * 100,
      txCount:   stats.count,
      direction: "both",
      timestamp: Date.now() / 1000,
    });
  }

  return { nodes, links, centerAddress: params.address, fetchedAt: Date.now() };
}

// ─── Mock data (fallback sans clé API) ───────────────────────────────────────

const MOCK_EXCHANGES: Record<Chain, string[]> = {
  ethereum: ["Binance", "Coinbase", "Uniswap", "Aave", "Curve"],
  solana:   ["Binance", "Coinbase", "Jupiter", "Raydium", "Kraken"],
  sui:      ["Binance", "OKX", "Cetus", "Turbos", "Bybit"],
  hedera:   ["Binance", "OKX", "SaucerSwap", "HashPack", "Bitfinex"],
};

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Identifiant factice au format de la chaîne (unique par index). */
function mockPeerId(chain: Chain, i: number): string {
  switch (chain) {
    case "ethereum": return `0x${i.toString(16).padStart(40, "0")}`;
    case "sui":      return `0x${i.toString(16).padStart(64, "0")}`;
    case "hedera":   return `0.0.${1_000_000 + i * 137}`;
    case "solana": {
      let n = i, tail = "";
      do { tail = BASE58[n % 58] + tail; n = Math.floor(n / 58); } while (n > 0);
      return ("Demo" + tail).padEnd(44, "1");
    }
  }
}

export function mockWalletGraph(address: string, chain: Chain = "ethereum"): GraphData {
  const cfg    = CHAINS[chain];
  const center = cfg.normalize(address || cfg.presets[0].address);
  const names  = MOCK_EXCHANGES[chain];
  const peers  = Array.from({ length: 24 }, (_, i) => ({
    id:           mockPeerId(chain, i),
    type:         (["wallet", "exchange", "contract"] as NodeType[])[i % 3],
    label:        i % 5 === 0 ? names[Math.floor(i/5)] : shortAddr(mockPeerId(chain, i)),
    volume:       Math.pow(Math.random(), 2) * 5_000_000,
    txCount:      Math.floor(Math.random() * 200) + 1,
    isSmartMoney: i < 3,
    isFocused:    false,
  }));

  const centerLabel = cfg.presets.find((p) => cfg.normalize(p.address) === center)?.label
    ?? classifyAddress(center, chain).label;

  const nodes: GraphNode[] = [
    { id: center, type: "wallet", label: centerLabel, volume: 12_000_000, txCount: 1847, isSmartMoney: true, isFocused: true },
    ...peers,
  ];

  const links: GraphLink[] = peers.map((p, i) => ({
    source:    i % 2 === 0 ? center : p.id,
    target:    i % 2 === 0 ? p.id   : center,
    volume:    p.volume,
    txCount:   p.txCount,
    direction: (["in", "out", "both"] as const)[i % 3],
    timestamp: Date.now() / 1000 - Math.random() * 86400 * 30,
  }));

  return { nodes, links, centerAddress: center, fetchedAt: Date.now() };
}

export function mockDefiGraph(): GraphData {
  const pools = [
    { id: "0xpool1", label: "ETH/USDC", tvl: 250_000_000 },
    { id: "0xpool2", label: "ETH/USDT", tvl: 180_000_000 },
    { id: "0xpool3", label: "WBTC/ETH", tvl: 120_000_000 },
    { id: "0xpool4", label: "DAI/USDC", tvl: 95_000_000 },
    { id: "0xpool5", label: "ARB/ETH",  tvl: 60_000_000 },
  ];
  const tokens = [
    { id: "0xeth",  label: "ETH",  volume: 800_000_000 },
    { id: "0xusdc", label: "USDC", volume: 600_000_000 },
    { id: "0xusdt", label: "USDT", volume: 500_000_000 },
    { id: "0xwbtc", label: "WBTC", volume: 300_000_000 },
    { id: "0xdai",  label: "DAI",  volume: 200_000_000 },
    { id: "0xarb",  label: "ARB",  volume: 80_000_000 },
  ];

  const nodes: GraphNode[] = [
    ...tokens.map(t => ({ id: t.id, type: "token" as NodeType, label: t.label, volume: t.volume, txCount: 0, isSmartMoney: false, isFocused: false })),
    ...pools.map(p => ({ id: p.id, type: "dex_pool" as NodeType, label: p.label, volume: p.tvl, txCount: Math.floor(p.tvl / 1000), isSmartMoney: false, isFocused: false })),
  ];
  const links: GraphLink[] = [
    { source: "0xeth",  target: "0xpool1", volume: 125e6, txCount: 10000, direction: "both", timestamp: Date.now()/1e3 },
    { source: "0xusdc", target: "0xpool1", volume: 125e6, txCount: 10000, direction: "both", timestamp: Date.now()/1e3 },
    { source: "0xeth",  target: "0xpool2", volume: 90e6,  txCount: 7000,  direction: "both", timestamp: Date.now()/1e3 },
    { source: "0xusdt", target: "0xpool2", volume: 90e6,  txCount: 7000,  direction: "both", timestamp: Date.now()/1e3 },
    { source: "0xwbtc", target: "0xpool3", volume: 60e6,  txCount: 4000,  direction: "both", timestamp: Date.now()/1e3 },
    { source: "0xeth",  target: "0xpool3", volume: 60e6,  txCount: 4000,  direction: "both", timestamp: Date.now()/1e3 },
    { source: "0xdai",  target: "0xpool4", volume: 47e6,  txCount: 3000,  direction: "both", timestamp: Date.now()/1e3 },
    { source: "0xusdc", target: "0xpool4", volume: 47e6,  txCount: 3000,  direction: "both", timestamp: Date.now()/1e3 },
    { source: "0xarb",  target: "0xpool5", volume: 30e6,  txCount: 2000,  direction: "both", timestamp: Date.now()/1e3 },
    { source: "0xeth",  target: "0xpool5", volume: 30e6,  txCount: 2000,  direction: "both", timestamp: Date.now()/1e3 },
  ];

  return { nodes, links, fetchedAt: Date.now() };
}

export function mockContractGraph(address: string): GraphData {
  const center = checksumAddr(address || "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
  const callers = Array.from({ length: 40 }, (_, i) => ({
    id:           `0xcaller${i.toString(16).padStart(36, "0")}`,
    type:         i < 5 ? "exchange" as NodeType : "wallet" as NodeType,
    label:        i < 5 ? ["Binance", "Coinbase", "Kraken", "OKX", "Bybit"][i] : shortAddr(`0x${i.toString(16).padStart(40,"0")}`),
    volume:       Math.pow(Math.random(), 1.5) * 2_000_000,
    txCount:      Math.floor(Math.random() * 500) + 10,
    isSmartMoney: i < 8,
    isFocused:    false,
  }));

  return {
    nodes: [
      { id: center, type: "contract", label: "USDC Token", volume: 50_000_000_000, txCount: 485_000, isSmartMoney: false, isFocused: true },
      ...callers,
    ],
    links: callers.map(c => ({
      source: c.id, target: center,
      volume: c.volume, txCount: c.txCount,
      direction: "both" as const,
      timestamp: Date.now() / 1000,
    })),
    centerAddress: center,
    fetchedAt: Date.now(),
  };
}
