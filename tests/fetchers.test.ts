import { describe, it, expect } from "vitest";
import {
  mockWalletGraph,
  mockDefiGraph,
  mockContractGraph,
} from "../lib/fetchers";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assertGraphValid(graph: ReturnType<typeof mockWalletGraph>) {
  expect(graph.nodes.length).toBeGreaterThan(0);
  expect(graph.links.length).toBeGreaterThan(0);
  expect(graph.fetchedAt).toBeGreaterThan(0);

  // Tous les nœuds ont les champs obligatoires
  for (const node of graph.nodes) {
    expect(node.id).toBeTruthy();
    expect(node.type).toBeTruthy();
    expect(node.label).toBeTruthy();
    expect(typeof node.volume).toBe("number");
    expect(typeof node.txCount).toBe("number");
    expect(typeof node.isSmartMoney).toBe("boolean");
    expect(typeof node.isFocused).toBe("boolean");
  }

  // Les ids sont uniques
  const ids = new Set(graph.nodes.map((n) => n.id));
  expect(ids.size).toBe(graph.nodes.length);

  // Tous les liens référencent des nœuds existants
  for (const link of graph.links) {
    const srcId = typeof link.source === "string" ? link.source : link.source.id;
    const tgtId = typeof link.target === "string" ? link.target : link.target.id;
    expect(ids.has(srcId)).toBe(true);
    expect(ids.has(tgtId)).toBe(true);
  }
}

// ─── Tests mockWalletGraph ────────────────────────────────────────────────────

describe("mockWalletGraph", () => {
  it("retourne un graphe valide avec une adresse fournie", () => {
    const graph = mockWalletGraph("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
    assertGraphValid(graph);
  });

  it("retourne un graphe valide avec une adresse vide", () => {
    const graph = mockWalletGraph("");
    assertGraphValid(graph);
  });

  it("contient exactement 1 nœud focal (isFocused = true)", () => {
    const graph   = mockWalletGraph("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
    const focused = graph.nodes.filter((n) => n.isFocused);
    expect(focused).toHaveLength(1);
  });

  it("le nœud focal est l'adresse passée en paramètre", () => {
    const addr  = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";
    const graph = mockWalletGraph(addr);
    const focal = graph.nodes.find((n) => n.isFocused);
    expect(focal?.id).toBe(addr);
  });

  it("contient des nœuds smart money", () => {
    const graph      = mockWalletGraph("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
    const smartMoney = graph.nodes.filter((n) => n.isSmartMoney);
    expect(smartMoney.length).toBeGreaterThan(0);
  });

  it("tous les volumes sont positifs", () => {
    const graph = mockWalletGraph("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
    for (const node of graph.nodes) {
      expect(node.volume).toBeGreaterThanOrEqual(0);
    }
  });

  it("les liens ont une direction valide", () => {
    const graph = mockWalletGraph("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
    for (const link of graph.links) {
      expect(["in", "out", "both"]).toContain(link.direction);
    }
  });

  it("centerAddress est défini", () => {
    const addr  = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";
    const graph = mockWalletGraph(addr);
    expect(graph.centerAddress).toBe(addr);
  });
});

// ─── Tests mockDefiGraph ──────────────────────────────────────────────────────

describe("mockDefiGraph", () => {
  it("retourne un graphe valide", () => {
    const graph = mockDefiGraph();
    assertGraphValid(graph);
  });

  it("contient des nœuds dex_pool et token", () => {
    const graph = mockDefiGraph();
    const pools  = graph.nodes.filter((n) => n.type === "dex_pool");
    const tokens = graph.nodes.filter((n) => n.type === "token");
    expect(pools.length).toBeGreaterThan(0);
    expect(tokens.length).toBeGreaterThan(0);
  });

  it("tous les liens entre tokens et pools ont direction=both", () => {
    const graph = mockDefiGraph();
    for (const link of graph.links) {
      expect(link.direction).toBe("both");
    }
  });

  it("les pools ont un volume > 0", () => {
    const graph = mockDefiGraph();
    const pools = graph.nodes.filter((n) => n.type === "dex_pool");
    for (const pool of pools) {
      expect(pool.volume).toBeGreaterThan(0);
    }
  });

  it("les labels des pools contiennent un slash (paire de tokens)", () => {
    const graph = mockDefiGraph();
    const pools = graph.nodes.filter((n) => n.type === "dex_pool");
    for (const pool of pools) {
      expect(pool.label).toContain("/");
    }
  });
});

// ─── Tests mockContractGraph ──────────────────────────────────────────────────

describe("mockContractGraph", () => {
  it("retourne un graphe valide", () => {
    const addr  = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
    const graph = mockContractGraph(addr);
    assertGraphValid(graph);
  });

  it("contient exactement 1 nœud contract focal", () => {
    const graph    = mockContractGraph("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
    const contract = graph.nodes.filter((n) => n.type === "contract" && n.isFocused);
    expect(contract).toHaveLength(1);
  });

  it("le nœud focal est l'adresse passée en paramètre", () => {
    const addr  = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
    const graph = mockContractGraph(addr);
    const focal = graph.nodes.find((n) => n.isFocused);
    expect(focal?.id).toBe(addr);
  });

  it("tous les liens pointent vers le contrat", () => {
    const addr  = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
    const graph = mockContractGraph(addr);
    for (const link of graph.links) {
      const tgtId = typeof link.target === "string" ? link.target : link.target.id;
      expect(tgtId).toBe(addr);
    }
  });

  it("les exchanges (top callers) ont isSmartMoney=true", () => {
    const graph     = mockContractGraph("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
    const exchanges = graph.nodes.filter((n) => n.type === "exchange");
    const smart     = exchanges.filter((n) => n.isSmartMoney);
    expect(smart.length).toBeGreaterThan(0);
  });
});
