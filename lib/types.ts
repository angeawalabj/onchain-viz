// ─── Palette (ADR-0002) ───────────────────────────────────────────────────────

export const PALETTE = {
  bg:              "#060610",
  surface:         "#0d0d1a",
  border:          "rgba(255,255,255,0.08)",
  text:            "#e8e6f0",
  textMuted:       "rgba(232,230,240,0.45)",

  // Nœuds
  nodeWallet:      "#7c6df0",
  nodeContract:    "#14b8a6",
  nodeExchange:    "#f59e0b",
  nodeDexPool:     "#10b981",
  nodeUnknown:     "#64748b",

  // Liens
  linkInflow:      "#4ade80",
  linkOutflow:     "#f87171",
  linkNeutral:     "rgba(148,163,184,0.18)",

  // Accents
  accent:          "#818cf8",
  bloom:           "#c4b5fd",
  selected:        "#ffffff",
} as const;

// ─── Types de nœuds ───────────────────────────────────────────────────────────

export type NodeType =
  | "wallet"
  | "contract"
  | "exchange"
  | "dex_pool"
  | "token"
  | "unknown";

export type ViewMode = "wallet" | "defi" | "contract";

// ─── Structures de données graphe ─────────────────────────────────────────────

export interface GraphNode {
  id:          string;           // adresse Ethereum checksummed
  type:        NodeType;
  label:       string;           // ENS ou adresse tronquée
  volume:      number;           // en USD
  txCount:     number;
  isSmartMoney: boolean;
  isFocused:   boolean;          // nœud central de la recherche
  // Injecté par d3-force-3d
  x?: number; y?: number; z?: number;
  vx?: number; vy?: number; vz?: number;
}

export interface GraphLink {
  source:    string | GraphNode;
  target:    string | GraphNode;
  volume:    number;             // en USD
  txCount:   number;
  direction: "in" | "out" | "both";
  timestamp: number;             // last tx unix
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  centerAddress?: string;
  fetchedAt:      number;
}

// ─── Modes de visualisation ────────────────────────────────────────────────────

export interface WalletGraphParams {
  address:   string;
  depth:     1 | 2;             // 1 = voisins directs, 2 = voisins de voisins
  minVolume: number;            // filtre les tx sous ce seuil USD
}

export interface DefiGraphParams {
  protocol:  "uniswap_v3" | "aave_v3" | "curve";
  topN:      number;            // top N pools par TVL
}

export interface ContractGraphParams {
  address:   string;
  eventName?: string;
  fromBlock:  number;
  toBlock:    number;
}

// ─── Store Zustand ────────────────────────────────────────────────────────────

export interface VizStore {
  // Mode actif
  mode:         ViewMode;
  setMode:      (m: ViewMode) => void;

  // Données graphe
  graph:        GraphData | null;
  setGraph:     (g: GraphData) => void;
  isLoading:    boolean;
  error:        string | null;

  // Sélection
  selectedNode: string | null;
  setSelected:  (id: string | null) => void;
  hoveredNode:  string | null;
  setHovered:   (id: string | null) => void;

  // Paramètres caméra
  autoRotate:   boolean;
  toggleAutoRotate: () => void;

  // Config clés API
  etherscanKey: string;
  alchemyKey:   string;
  graphApiKey:  string;
  setApiKeys:   (keys: Partial<Pick<VizStore, "etherscanKey" | "alchemyKey" | "graphApiKey">>) => void;
}

// ─── Helpers adresses ─────────────────────────────────────────────────────────

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function nodeColor(type: NodeType): string {
  const map: Record<NodeType, string> = {
    wallet:    PALETTE.nodeWallet,
    contract:  PALETTE.nodeContract,
    exchange:  PALETTE.nodeExchange,
    dex_pool:  PALETTE.nodeDexPool,
    token:     PALETTE.nodeDexPool,
    unknown:   PALETTE.nodeUnknown,
  };
  return map[type];
}

export function nodeRadius(volume: number, maxVolume: number): number {
  // sqrt-scale pour éviter les outliers — min 0.25, max 2.2
  const scale = Math.sqrt(volume / Math.max(maxVolume, 1));
  return 0.25 + scale * 1.95;
}

export function formatUSD(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
