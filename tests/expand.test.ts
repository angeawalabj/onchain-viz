import { describe, it, expect } from "vitest";
import { mergeExpansion, expandBlocker } from "../lib/expand";
import { initialPositions } from "../lib/useForceGraph";
import { mockWalletGraph } from "../lib/fetchers";
import type { GraphData, GraphNode } from "../lib/types";

const node = (id: string, extra: Partial<GraphNode> = {}): GraphNode => ({
  id, type: "wallet", label: id, volume: 100, txCount: 1, isSmartMoney: false, isFocused: false, ...extra,
});
const link = (source: string, target: string, volume: number, assets?: string[]) => ({
  source, target, volume, txCount: 1, direction: "out" as const, timestamp: 0, assets,
});

// Graphe de départ : A (focal) → B, A → C
const base: GraphData = {
  nodes: [node("A", { isFocused: true, volume: 300 }), node("B"), node("C")],
  links: [link("A", "B", 100, ["SOL"]), link("A", "C", 200)],
  centerAddress: "A",
  fetchedAt: 0,
};

// Graphe de B (focal B) : A → B (même lien vu de B), B → D
const ofB: GraphData = {
  nodes: [node("B", { isFocused: true, volume: 900, txCount: 9 }), node("A"), node("D")],
  links: [link("A", "B", 100, ["USDC"]), link("B", "D", 800)],
  centerAddress: "B",
  fetchedAt: 1,
};

describe("mergeExpansion", () => {
  const merged = mergeExpansion(base, ofB, "B");

  it("ajoute les nouveaux nœuds et liens sans doublon", () => {
    expect(merged.nodes.map((n) => n.id).sort()).toEqual(["A", "B", "C", "D"]);
    expect(merged.links).toHaveLength(3);
  });

  it("le focal d'origine reste le seul nœud focal", () => {
    expect(merged.nodes.filter((n) => n.isFocused).map((n) => n.id)).toEqual(["A"]);
    expect(merged.centerAddress).toBe("A");
  });

  it("le nœud déplié est marqué expanded et prend le max des volumes", () => {
    const b = merged.nodes.find((n) => n.id === "B")!;
    expect(b.expanded).toBe(true);
    expect(b.volume).toBe(900);
    expect(b.txCount).toBe(9);
  });

  it("le lien vu des deux côtés n'est pas doublé, ses actifs sont réunis", () => {
    const ab = merged.links.find((l) => l.source === "A" && l.target === "B")!;
    expect(ab.volume).toBe(100);
    expect(ab.assets).toEqual(["SOL", "USDC"]);
  });

  it("ne modifie pas le graphe d'origine", () => {
    expect(base.nodes.find((n) => n.id === "B")!.expanded).toBeUndefined();
    expect(base.links[0].assets).toEqual(["SOL"]);
  });
});

describe("expandBlocker", () => {
  const real = { isDemo: false };
  const sol  = "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS";

  it("autorise un wallet réel non exploré en mode wallet", () => {
    expect(expandBlocker(node(sol), real, "solana", "wallet")).toBeNull();
  });

  it("bloque les données de démo", () => {
    expect(expandBlocker(node(sol), mockWalletGraph("", "solana"), "solana", "wallet")).toBe("demo");
  });

  it("bloque hors mode wallet, le focal, les nœuds déjà explorés et les bundles", () => {
    expect(expandBlocker(node(sol), real, "solana", "contract")).toBe("mode");
    expect(expandBlocker(node(sol, { isFocused: true }), real, "solana", "wallet")).toBe("expanded");
    expect(expandBlocker(node(sol, { expanded: true }), real, "solana", "wallet")).toBe("expanded");
    expect(expandBlocker(node("bundle-wallet"), real, "solana", "wallet")).toBe("address");
  });
});

describe("initialPositions", () => {
  it("garde les positions connues et place un nouveau nœud près de son voisin", () => {
    const known = new Map([["A", { x: 100, y: 100, z: 100 }]]);
    const pos   = initialPositions(["A", "B"], [{ source: "A", target: "B" }], known);
    expect(pos.get("A")).toEqual({ x: 100, y: 100, z: 100 });
    const b = pos.get("B")!;
    expect(Math.abs(b.x - 100)).toBeLessThanOrEqual(2);
    expect(Math.abs(b.z - 100)).toBeLessThanOrEqual(2);
  });

  it("nœud isolé sans voisin connu : position aléatoire dans le cube initial", () => {
    const p = initialPositions(["Z"], [], new Map()).get("Z")!;
    expect(Math.abs(p.x)).toBeLessThanOrEqual(10);
  });
});
