/**
 * Fetchers de données on-chain.
 * Chaque fetcher retourne un GraphData normalisé.
 * Fallback sur des données mockées si pas de clé API.
 */

import type {
  GraphData, GraphLink, GraphNode,
  WalletGraphParams, DefiGraphParams, ContractGraphParams,
  NodeType,
} from "./types";
import { shortAddr } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function checksumAddr(addr: string): string {
  return addr.toLowerCase();
}

/** Classe une adresse : exchange connu, contract, ou wallet */
const KNOWN_EXCHANGES: Record<string, string> = {
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": "Uniswap Router",
  "0x00000000219ab540356cbb839cbe05303d7705fa": "ETH2 Deposit",
  "0xd8da6bf26964af9d7eed9e03e53415d37aa96045": "vitalik.eth",
  "0x28c6c06298d514db089934071355e5743bf21d60": "Binance",
  "0x21a31ee1afc51d94c2efccaa2092ad1028285549": "Binance",
  "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be": "Binance",
};

function classifyAddress(addr: string): { type: NodeType; label: string } {
  const lower = addr.toLowerCase();
  if (KNOWN_EXCHANGES[lower]) {
    return { type: "exchange", label: KNOWN_EXCHANGES[lower] };
  }
  return { type: "wallet", label: shortAddr(addr) };
}

// ─── Mode Wallet — Etherscan API ──────────────────────────────────────────────

export async function fetchWalletGraph(
  params: WalletGraphParams,
  etherscanKey: string
): Promise<GraphData> {
  if (!etherscanKey) return mockWalletGraph(params.address);

  const { address, minVolume } = params;
  const base = "https://api.etherscan.io/api";

  // Récupère les 100 dernières transactions normales
  const url = `${base}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc&apikey=${etherscanKey}`;
  const res  = await fetch(url);
  const data = await res.json();

  if (data.status !== "1") throw new Error(data.message || "Etherscan error");

  const txs: EtherscanTx[] = data.result;

  // Construit le graphe
  const nodeMap = new Map<string, GraphNode>();
  const linkMap = new Map<string, GraphLink>();

  // Nœud central
  const { type: centerType, label: centerLabel } = classifyAddress(address);
  nodeMap.set(address, {
    id:           address,
    type:         centerType,
    label:        centerLabel,
    volume:       0,
    txCount:      0,
    isSmartMoney: false,
    isFocused:    true,
  });

  for (const tx of txs) {
    const valueEth = parseInt(tx.value) / 1e18;
    const valueUSD = valueEth * 3000; // approximation ETH~$3000
    if (valueUSD < minVolume) continue;

    const peer     = tx.from.toLowerCase() === address.toLowerCase() ? tx.to : tx.from;
    const peerAddr = checksumAddr(peer);
    const isOut    = tx.from.toLowerCase() === address.toLowerCase();

    // Nœud pair
    if (!nodeMap.has(peerAddr)) {
      const { type, label } = classifyAddress(peerAddr);
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
        timestamp: parseInt(tx.timeStamp),
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

export function mockWalletGraph(address: string): GraphData {
  const center = checksumAddr(address || "0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
  const peers  = Array.from({ length: 24 }, (_, i) => ({
    id:           `0x${i.toString(16).padStart(40, "0")}`,
    type:         (["wallet", "exchange", "contract"] as NodeType[])[i % 3],
    label:        i % 5 === 0 ? ["Binance", "Coinbase", "Uniswap", "Aave", "Curve"][Math.floor(i/5)] : shortAddr(`0x${i.toString(16).padStart(40,"0")}`),
    volume:       Math.pow(Math.random(), 2) * 5_000_000,
    txCount:      Math.floor(Math.random() * 200) + 1,
    isSmartMoney: i < 3,
    isFocused:    false,
  }));

  const nodes: GraphNode[] = [
    { id: center, type: "wallet", label: "vitalik.eth", volume: 12_000_000, txCount: 1847, isSmartMoney: true, isFocused: true },
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
