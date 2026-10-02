import { describe, it, expect } from "vitest";
import { filterAtTime, linkEvents, timeRange } from "../lib/replay";
import { buildWalletGraph, mockWalletGraph } from "../lib/fetchers";
import { clusterGraph } from "../lib/clustering";
import { mergeExpansion } from "../lib/expand";
import { NATIVE } from "../lib/tokens";
import type { GraphData, GraphNode } from "../lib/types";

const node = (id: string, isFocused = false): GraphNode => ({
  id, type: "wallet", label: id, volume: 0, txCount: 0, isSmartMoney: false, isFocused,
});

// A (focal) → B à t=100 ($10) et t=300 ($30) ; C → A à t=200 ($5)
const nodes = [node("A", true), node("B"), node("C"), node("D")];
const links = [
  { source: "A", target: "B", volume: 40, txCount: 2, direction: "out" as const, timestamp: 300,
    events: [{ t: 300, usd: 30 }, { t: 100, usd: 10 }] },
  { source: "C", target: "A", volume: 5, txCount: 1, direction: "in" as const, timestamp: 200,
    events: [{ t: 200, usd: 5 }] },
];

describe("timeRange", () => {
  it("bornes min/max de tous les événements", () => {
    expect(timeRange(links)).toEqual({ min: 100, max: 300 });
  });

  it("null si un seul instant (rien à rejouer)", () => {
    expect(timeRange([links[1]])).toBeNull();
    expect(timeRange([])).toBeNull();
  });
});

describe("linkEvents", () => {
  it("lien sans détail = un événement à sa date avec tout son volume", () => {
    expect(linkEvents({ timestamp: 50, volume: 7, txCount: 3 })).toEqual([{ t: 50, usd: 7 }]);
  });
});

describe("filterAtTime", () => {
  it("null → graphe inchangé (mêmes objets)", () => {
    const r = filterAtTime(nodes, links, null);
    expect(r.nodes).toBe(nodes);
    expect(r.links).toBe(links);
  });

  it("à t=150 : seul A→B est visible, avec le volume cumulé jusque-là", () => {
    const r = filterAtTime(nodes, links, 150);
    expect(r.links).toHaveLength(1);
    expect(r.links[0].volume).toBe(10);
    expect(r.links[0].txCount).toBe(1);
    expect(r.nodes.map((n) => n.id)).toEqual(["A", "B"]);
  });

  it("à t=300 : tout est visible, volumes complets", () => {
    const r = filterAtTime(nodes, links, 300);
    expect(r.links.map((l) => l.volume)).toEqual([40, 5]);
    expect(r.nodes.map((n) => n.id)).toEqual(["A", "B", "C"]);   // D n'a aucun lien
  });

  it("avant tout transfert : seul le focal reste", () => {
    const r = filterAtTime(nodes, links, 0);
    expect(r.links).toEqual([]);
    expect(r.nodes.map((n) => n.id)).toEqual(["A"]);
  });

  it("garde les objets nœuds d'origine (positions conservées)", () => {
    expect(filterAtTime(nodes, links, 150).nodes[0]).toBe(nodes[0]);
  });
});

describe("événements de bout en bout", () => {
  it("buildWalletGraph date chaque transfert", () => {
    const g = buildWalletGraph("hedera", "0.0.1000", [
      { peer: "0.0.2000", isOut: true, asset: NATIVE, amount: 1000, timestamp: 10 },
      { peer: "0.0.2000", isOut: true, asset: NATIVE, amount: 2000, timestamp: 20 },
    ], { [NATIVE]: 0.1 }, 1);
    expect(g.links[0].events).toEqual([{ t: 10, usd: 100 }, { t: 20, usd: 200 }]);
  });

  it("le clustering réunit les événements des liens fusionnés", () => {
    const base = mockWalletGraph("", "solana");
    const many: GraphData = {
      ...base,
      nodes: [...base.nodes, ...Array.from({ length: 200 }, (_, i) => ({ ...node(`X${i}`), volume: 1 }))],
      links: [...base.links, ...Array.from({ length: 200 }, (_, i) => ({
        source: base.centerAddress!, target: `X${i}`, volume: 1, txCount: 1,
        direction: "out" as const, timestamp: 1000 + i,
      }))],
    };
    const bundled = clusterGraph(many, "wallet").graph;
    const toBundle = bundled.links.find((l) => String(l.target).startsWith("bundle-"))!;
    expect(toBundle.events!.length).toBeGreaterThan(1);
    expect(toBundle.events!.reduce((s, e) => s + e.usd, 0)).toBeCloseTo(toBundle.volume);
  });

  it("nœud déplié : le lien vu des deux côtés garde les événements de la vue la plus complète", () => {
    const base: GraphData = { nodes: [node("A", true), node("B")], fetchedAt: 0,
      links: [{ ...links[0], events: [{ t: 300, usd: 30 }], volume: 30 }] };
    const ofB: GraphData = { nodes: [node("B", true), node("A")], fetchedAt: 0, links: [links[0]] };
    const merged = mergeExpansion(base, ofB, "B");
    expect(merged.links[0].events).toHaveLength(2);
  });
});
