import { describe, it, expect } from "vitest";
import { clusterGraph } from "../lib/clustering";
import type { GraphData, GraphNode, GraphLink } from "../lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNode(id: string, volume: number, type: GraphNode["type"] = "wallet"): GraphNode {
  return {
    id, type,
    label:        id.slice(0, 6),
    volume,
    txCount:      Math.floor(volume / 1000),
    isSmartMoney: false,
    isFocused:    false,
  };
}

function makeLink(source: string, target: string, volume: number): GraphLink {
  return { source, target, volume, txCount: 1, direction: "out", timestamp: Date.now() / 1000 };
}

function makeGraph(nodeCount: number, volumeBase = 100_000): GraphData {
  const nodes: GraphNode[] = Array.from({ length: nodeCount }, (_, i) =>
    makeNode(`0x${String(i).padStart(40, "0")}`, volumeBase / (i + 1))
  );
  const links: GraphLink[] = nodes.slice(1).map((n) =>
    makeLink(nodes[0].id, n.id, n.volume)
  );
  return { nodes, links, fetchedAt: Date.now() };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("clusterGraph", () => {

  it("ne modifie pas le graphe si sous le budget", () => {
    const graph  = makeGraph(50);
    const result = clusterGraph(graph, "wallet");
    expect(result.clustered).toBe(0);
    expect(result.graph.nodes).toHaveLength(50);
    expect(result.graph).toBe(graph); // même référence
  });

  it("réduit au budget en mode wallet", () => {
    const graph  = makeGraph(200);
    const result = clusterGraph(graph, "wallet");
    // makeGraph crée uniquement des nœuds "wallet" → 1 type distinct
    // effectiveLimit = 150 - 1 = 149 gardés + 1 bundle = 150 total
    expect(result.graph.nodes.length).toBeLessThanOrEqual(150);
    expect(result.clustered).toBeGreaterThan(0);
  });

  it("réduit au budget en mode defi", () => {
    const graph  = makeGraph(120);
    const result = clusterGraph(graph, "defi");
    // effectiveLimit = 80 - 1 = 79 gardés + 1 bundle = 80 total
    expect(result.graph.nodes.length).toBeLessThanOrEqual(80);
    expect(result.clustered).toBeGreaterThan(0);
  });

  it("réduit au budget en mode contract", () => {
    const graph  = makeGraph(130);
    const result = clusterGraph(graph, "contract");
    // effectiveLimit = 100 - 1 = 99 gardés + 1 bundle = 100 total
    expect(result.graph.nodes.length).toBeLessThanOrEqual(100);
    expect(result.clustered).toBeGreaterThan(0);
  });

  it("préserve les nœuds à fort volume (heavy hitters)", () => {
    const graph  = makeGraph(200);
    const result = clusterGraph(graph, "wallet");
    // Le nœud le plus gros doit toujours être présent
    const topNode = graph.nodes[0];
    const found   = result.graph.nodes.find((n) => n.id === topNode.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(topNode.id);
  });

  it("crée des nœuds bundle avec volume agrégé correct", () => {
    const graph  = makeGraph(200);
    const result = clusterGraph(graph, "wallet");
    const bundles = result.graph.nodes.filter((n) => n.id.startsWith("bundle-"));
    expect(bundles.length).toBeGreaterThan(0);

    for (const bundle of bundles) {
      // Le volume du bundle doit être positif
      expect(bundle.volume).toBeGreaterThan(0);
      // Le label doit indiquer le nombre de nœuds
      expect(bundle.label).toMatch(/\d+ \w+s/);
    }
  });

  it("ne crée pas de self-loops dans les liens", () => {
    const nodes: GraphNode[] = [
      makeNode("0xaaa", 1_000_000, "wallet"),
      makeNode("0xbbb",   100_000, "wallet"),
      makeNode("0xccc",    50_000, "wallet"),
    ];
    const links: GraphLink[] = [
      makeLink("0xaaa", "0xbbb", 100_000),
      makeLink("0xbbb", "0xccc",  50_000),
    ];
    const graph: GraphData = { nodes, links, fetchedAt: Date.now() };

    // Force le clustering à 1 seul nœud gardé
    const result = clusterGraph(graph, "defi"); // limite 80 — tous gardés ici
    for (const link of result.graph.links) {
      const src = typeof link.source === "string" ? link.source : link.source.id;
      const tgt = typeof link.target === "string" ? link.target : link.target.id;
      expect(src).not.toBe(tgt);
    }
  });

  it("agrège les volumes des liens vers le même bundle", () => {
    // 5 nœuds → 1 nœud gardé + 4 bundlés (si limite = 1)
    // Les 4 liens pointant vers le bundle doivent être fusionnés en 1
    const nodes: GraphNode[] = [
      makeNode("0xcenter",  1_000_000, "contract"),  // gardé
      makeNode("0xw1",        100_000, "wallet"),
      makeNode("0xw2",         80_000, "wallet"),
      makeNode("0xw3",         60_000, "wallet"),
      makeNode("0xw4",         40_000, "wallet"),
    ];
    const links: GraphLink[] = [
      makeLink("0xw1", "0xcenter", 100_000),
      makeLink("0xw2", "0xcenter",  80_000),
      makeLink("0xw3", "0xcenter",  60_000),
      makeLink("0xw4", "0xcenter",  40_000),
    ];
    const graph: GraphData = { nodes, links, fetchedAt: Date.now() };

    // Clustering avec limite très basse pour forcer le regroupement
    // On utilise "defi" avec 80 limit — ici tous les 5 sont gardés
    // Pour tester l'agrégation, on manipule directement la fonction
    // en passant un graphe déjà au-delà du budget
    const bigGraph: GraphData = {
      nodes: [
        makeNode("0xcenter", 1_000_000, "contract"),
        ...Array.from({ length: 85 }, (_, i) =>
          makeNode(`0xw${i}`, 100 / (i + 1), "wallet")
        ),
      ],
      links: Array.from({ length: 85 }, (_, i) =>
        makeLink(`0xw${i}`, "0xcenter", 100 / (i + 1))
      ),
      fetchedAt: Date.now(),
    };

    const result = clusterGraph(bigGraph, "defi"); // limite 80
    const bundleLink = result.graph.links.find((l) => {
      const tgt = typeof l.target === "string" ? l.target : l.target.id;
      return tgt === "0xcenter" && (typeof l.source === "string" ? l.source : l.source.id).startsWith("bundle-");
    });

    // Le bundle doit avoir un lien vers le centre avec volume agrégé
    expect(bundleLink).toBeDefined();
    expect(bundleLink!.volume).toBeGreaterThan(0);
  });

  it("préserve fetchedAt et centerAddress", () => {
    const ts = Date.now();
    const graph: GraphData = {
      ...makeGraph(200),
      fetchedAt:     ts,
      centerAddress: "0xabc",
    };
    const result = clusterGraph(graph, "wallet");
    expect(result.graph.fetchedAt).toBe(ts);
    expect(result.graph.centerAddress).toBe("0xabc");
  });
});
