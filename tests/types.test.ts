import { describe, it, expect } from "vitest";
import {
  nodeRadius,
  nodeColor,
  formatUSD,
  shortAddr,
  PALETTE,
} from "../lib/types";
import type { NodeType } from "../lib/types";

// ─── nodeRadius ───────────────────────────────────────────────────────────────

describe("nodeRadius", () => {
  it("retourne le minimum pour un nœud à volume nul", () => {
    const r = nodeRadius(0, 1_000_000);
    expect(r).toBeCloseTo(0.25, 1);
  });

  it("retourne le maximum pour le nœud le plus gros", () => {
    const r = nodeRadius(1_000_000, 1_000_000);
    expect(r).toBeCloseTo(0.25 + 1.95, 1);
  });

  it("applique une échelle sqrt (non-linéaire)", () => {
    const r1 = nodeRadius(100_000,  1_000_000);
    const r2 = nodeRadius(400_000,  1_000_000);
    const r4 = nodeRadius(1_000_000, 1_000_000);

    // sqrt(0.4)/sqrt(0.1) = 2 — le nœud 4× plus gros n'est que 2× plus large
    expect(r2 - 0.25).toBeCloseTo((r1 - 0.25) * 2, 0);
    // Tous dans la plage [0.25, 2.2]
    expect(r1).toBeGreaterThanOrEqual(0.25);
    expect(r4).toBeLessThanOrEqual(2.25);
  });

  it("ne plante pas si maxVolume est 0", () => {
    expect(() => nodeRadius(0, 0)).not.toThrow();
  });
});

// ─── nodeColor ────────────────────────────────────────────────────────────────

describe("nodeColor", () => {
  it("retourne la couleur violet pour wallet", () => {
    expect(nodeColor("wallet")).toBe(PALETTE.nodeWallet);
  });

  it("retourne la couleur teal pour contract", () => {
    expect(nodeColor("contract")).toBe(PALETTE.nodeContract);
  });

  it("retourne la couleur amber pour exchange", () => {
    expect(nodeColor("exchange")).toBe(PALETTE.nodeExchange);
  });

  it("retourne une couleur valide pour tous les types", () => {
    const types: NodeType[] = ["wallet", "contract", "exchange", "dex_pool", "token", "unknown"];
    for (const t of types) {
      const c = nodeColor(t);
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

// ─── formatUSD ────────────────────────────────────────────────────────────────

describe("formatUSD", () => {
  it("formate les milliards", () => {
    expect(formatUSD(1_500_000_000)).toBe("$1.5B");
    expect(formatUSD(10_200_000_000)).toBe("$10.2B");
  });

  it("formate les millions", () => {
    expect(formatUSD(4_200_000)).toBe("$4.2M");
    expect(formatUSD(1_000_000)).toBe("$1.0M");
  });

  it("formate les milliers", () => {
    expect(formatUSD(42_500)).toBe("$42.5K");
    expect(formatUSD(1_000)).toBe("$1.0K");
  });

  it("formate les petites valeurs", () => {
    expect(formatUSD(999)).toBe("$999");
    expect(formatUSD(0)).toBe("$0");
  });
});

// ─── shortAddr ────────────────────────────────────────────────────────────────

describe("shortAddr", () => {
  it("tronque une adresse Ethereum", () => {
    const addr  = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";
    const short = shortAddr(addr);
    expect(short).toBe("0xd8da…6045");
  });

  it("garde le préfixe 0x + 4 chars et les 4 derniers", () => {
    const addr  = "0xabcdef1234567890abcdef1234567890abcdef12";
    const short = shortAddr(addr);
    expect(short.startsWith("0xabcd")).toBe(true);
    expect(short.endsWith("ef12")).toBe(true);
    expect(short).toContain("…");
  });
});
