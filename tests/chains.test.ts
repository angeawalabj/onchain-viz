import { describe, it, expect } from "vitest";
import { CHAINS, CHAIN_IDS, isModeSupported } from "../lib/chains";
import { buildWalletGraph, mockWalletGraph } from "../lib/fetchers";

// ─── Validation d'adresses ────────────────────────────────────────────────────

describe("CHAINS.isValidAddress", () => {
  it("Ethereum : 0x + 40 hex", () => {
    expect(CHAINS.ethereum.isValidAddress("0xd8da6bf26964af9d7eed9e03e53415d37aa96045")).toBe(true);
    expect(CHAINS.ethereum.isValidAddress("0.0.1234")).toBe(false);
  });

  it("Solana : base58 32–44 caractères (pas de 0, O, I, l)", () => {
    expect(CHAINS.solana.isValidAddress("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM")).toBe(true);
    expect(CHAINS.solana.isValidAddress("0xd8da6bf26964af9d7eed9e03e53415d37aa96045")).toBe(false);
  });

  it("Sui : 0x + jusqu'à 64 hex, normalisé sur 64", () => {
    expect(CHAINS.sui.isValidAddress("0x2")).toBe(true);
    expect(CHAINS.sui.normalize("0x2")).toBe("0x" + "0".repeat(63) + "2");
    expect(CHAINS.sui.isValidAddress("example.sui")).toBe(false);
  });

  it("Hedera : shard.realm.num", () => {
    expect(CHAINS.hedera.isValidAddress("0.0.10881452")).toBe(true);
    expect(CHAINS.hedera.isValidAddress("0.0")).toBe(false);
  });

  it("chaque preset wallet est valide sur sa chaîne (hors noms ENS/SuiNS)", () => {
    for (const id of CHAIN_IDS) {
      for (const p of CHAINS[id].presets) {
        if (p.address.endsWith(".sui")) continue;
        expect(CHAINS[id].isValidAddress(p.address)).toBe(true);
      }
    }
  });
});

describe("isModeSupported", () => {
  it("Ethereum supporte les 3 modes, les autres chaînes le mode wallet", () => {
    expect(isModeSupported("ethereum", "defi")).toBe(true);
    expect(isModeSupported("solana", "wallet")).toBe(true);
    expect(isModeSupported("hedera", "contract")).toBe(false);
  });
});

// ─── Graphe wallet ────────────────────────────────────────────────────────────

describe("buildWalletGraph", () => {
  const transfers = [
    { peer: "0.0.2000", isOut: true,  amount: 1000, timestamp: 1 },
    { peer: "0.0.2000", isOut: true,  amount: 500,  timestamp: 2 },
    { peer: "0.0.3000", isOut: false, amount: 2000, timestamp: 3 },
    { peer: "0.0.4000", isOut: false, amount: 1,    timestamp: 4 },   // < minVolume
  ];

  it("agrège les transferts par pair et par sens, filtre sous minVolume", () => {
    const g = buildWalletGraph("hedera", "0.0.1000", transfers, 0.1, 50);
    expect(g.nodes).toHaveLength(3);
    expect(g.links).toHaveLength(2);
    const out = g.links.find((l) => l.target === "0.0.2000")!;
    expect(out.direction).toBe("out");
    expect(out.txCount).toBe(2);
    expect(out.volume).toBeCloseTo(150);
  });

  it("le nœud focal cumule le volume de tous ses liens", () => {
    const g     = buildWalletGraph("hedera", "0.0.1000", transfers, 0.1, 50);
    const focal = g.nodes.find((n) => n.isFocused)!;
    expect(focal.id).toBe("0.0.1000");
    expect(focal.volume).toBeCloseTo(350);
  });

  it("préserve la casse des adresses Solana", () => {
    const addr = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
    const g    = buildWalletGraph("solana", addr, [
      { peer: "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS", isOut: true, amount: 10, timestamp: 1 },
    ], 100, 1);
    expect(g.nodes.map((n) => n.id)).toContain("H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS");
    expect(g.nodes.find((n) => n.isFocused)!.label).toBe("Binance");
  });
});

describe("mockWalletGraph par chaîne", () => {
  it.each(CHAIN_IDS)("%s : ids au format de la chaîne, focal = preset par défaut", (chain) => {
    const cfg   = CHAINS[chain];
    const graph = mockWalletGraph("", chain);
    const focal = graph.nodes.find((n) => n.isFocused)!;
    expect(focal.label).toBe(cfg.presets[0].label);
    expect(new Set(graph.nodes.map((n) => n.id)).size).toBe(graph.nodes.length);
    for (const n of graph.nodes) expect(cfg.isValidAddress(n.id)).toBe(true);
  });
});
