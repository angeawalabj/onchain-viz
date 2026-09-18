/**
 * Clustering des nœuds — ADR-0002 : budget 150 nœuds max.
 * Au-delà, les nœuds à faible volume sont regroupés en nœuds "bundle".
 *
 * Algorithme :
 * 1. Trie les nœuds par volume décroissant
 * 2. Garde les N premiers intacts (heavy hitters)
 * 3. Groupe le reste par type en nœuds synthétiques "bundle"
 * 4. Fusionne les liens des nœuds clusterisés vers le bundle
 */

import type { GraphData, GraphNode, GraphLink } from "./types";

const MAX_NODES: Record<string, number> = {
  wallet:   150,
  defi:      80,
  contract: 100,
};

interface ClusterResult {
  graph:     GraphData;
  clustered: number;   // nombre de nœuds regroupés
}

export function clusterGraph(
  graph: GraphData,
  mode: string
): ClusterResult {
  const limit = MAX_NODES[mode] ?? 150;

  if (graph.nodes.length <= limit) {
    return { graph, clustered: 0 };
  }

  // Trie par volume décroissant — les plus actifs restent visibles
  const sorted = [...graph.nodes].sort((a, b) => b.volume - a.volume);

  // Pré-calcul : combien de types distincts parmi les nœuds à clusteriser ?
  // On réserve 1 slot par type pour le bundle node
  const allTypes = new Set(sorted.map((n) => n.type));
  const effectiveLimit = Math.max(1, limit - allTypes.size);

  const kept     = new Set(sorted.slice(0, effectiveLimit).map((n) => n.id));
  const clustered = sorted.slice(effectiveLimit);
  const byType    = new Map<string, GraphNode[]>();
  for (const n of clustered) {
    const group = byType.get(n.type) ?? [];
    group.push(n);
    byType.set(n.type, group);
  }

  // Crée un nœud bundle par type
  const bundleNodes: GraphNode[] = [];
  const bundleMap = new Map<string, string>(); // nodeId → bundleId

  for (const [type, nodes] of byType.entries()) {
    const bundleId = `bundle-${type}`;
    const totalVol = nodes.reduce((s, n) => s + n.volume, 0);
    const totalTx  = nodes.reduce((s, n) => s + n.txCount, 0);

    bundleNodes.push({
      id:           bundleId,
      type:         type as GraphNode["type"],
      label:        `${nodes.length} ${type}s`,
      volume:       totalVol,
      txCount:      totalTx,
      isSmartMoney: false,
      isFocused:    false,
    });

    for (const n of nodes) {
      bundleMap.set(n.id, bundleId);
    }
  }

  // Réécrit les liens : si source ou target est clusterisé → pointe vers le bundle
  const linkMap = new Map<string, GraphLink>();

  for (const link of graph.links) {
    const srcId = typeof link.source === "string" ? link.source : link.source.id;
    const tgtId = typeof link.target === "string" ? link.target : link.target.id;

    const newSrc = bundleMap.get(srcId) ?? srcId;
    const newTgt = bundleMap.get(tgtId) ?? tgtId;

    // Évite les self-loops (bundle → bundle même type)
    if (newSrc === newTgt) continue;

    const key = `${newSrc}→${newTgt}`;
    if (linkMap.has(key)) {
      const existing   = linkMap.get(key)!;
      existing.volume  += link.volume;
      existing.txCount += link.txCount;
    } else {
      linkMap.set(key, {
        ...link,
        source: newSrc,
        target: newTgt,
      });
    }
  }

  const finalNodes = [
    ...graph.nodes.filter((n) => kept.has(n.id)),
    ...bundleNodes,
  ];

  return {
    graph: {
      ...graph,
      nodes: finalNodes,
      links: Array.from(linkMap.values()),
    },
    clustered: sorted.slice(effectiveLimit).length,
  };
}
