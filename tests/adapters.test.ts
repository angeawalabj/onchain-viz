import { describe, it, expect } from "vitest";
import { deltasToTransfers } from "../lib/adapters/deltas";
import { solanaTxToDeltas, type SolanaTx } from "../lib/adapters/solana";
import { suiTxToDeltas, type SuiTx } from "../lib/adapters/sui";
import { hederaTxToDeltas } from "../lib/adapters/hedera";
import { NATIVE } from "../lib/tokens";

const n = (owner: string, amount: number) => ({ owner, asset: NATIVE, amount });

// ─── deltasToTransfers ────────────────────────────────────────────────────────

describe("deltasToTransfers", () => {
  it("focal qui envoie → transferts sortants vers les pairs crédités", () => {
    const out = deltasToTransfers("A", {
      timestamp: 100,
      deltas: [n("A", -10), n("B", 10)],
    });
    expect(out).toEqual([{ peer: "B", isOut: true, asset: NATIVE, amount: 10, timestamp: 100 }]);
  });

  it("focal qui reçoit → transferts entrants depuis les pairs débités", () => {
    const out = deltasToTransfers("A", {
      timestamp: 100,
      deltas: [n("B", -5), n("A", 5), n("C", 3)],
    });
    expect(out).toEqual([{ peer: "B", isOut: false, asset: NATIVE, amount: 5, timestamp: 100 }]);
  });

  it("ramène les montants des pairs à la variation du focal", () => {
    // A envoie 10, mais B et C reçoivent 40 au total (autre émetteur D)
    const out = deltasToTransfers("A", {
      timestamp: 0,
      deltas: [
        n("A", -10),
        n("D", -30),
        n("B", 30),
        n("C", 10),
      ],
    });
    const total = out.reduce((s, t) => s + t.amount, 0);
    expect(total).toBeCloseTo(10);
    expect(out.find((t) => t.peer === "B")!.amount).toBeCloseTo(7.5);
  });

  it("retourne [] si le focal n'est pas concerné", () => {
    expect(deltasToTransfers("Z", {
      timestamp: 0,
      deltas: [n("A", -1), n("B", 1)],
    })).toEqual([]);
  });

  it("traite chaque actif séparément (swap SOL → USDC = 2 transferts)", () => {
    const out = deltasToTransfers("A", {
      timestamp: 0,
      deltas: [
        n("A", -10), n("POOL", 10),
        { owner: "A", asset: "USDC", amount: 1500 }, { owner: "POOL", asset: "USDC", amount: -1500 },
      ],
    });
    expect(out).toEqual([
      { peer: "POOL", isOut: true,  asset: NATIVE, amount: 10,   timestamp: 0 },
      { peer: "POOL", isOut: false, asset: "USDC", amount: 1500, timestamp: 0 },
    ]);
  });
});

// ─── Solana ───────────────────────────────────────────────────────────────────

describe("solanaTxToDeltas", () => {
  const tx: SolanaTx = {
    blockTime: 1790827457,
    transaction: { message: { accountKeys: [
      "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS",
      "2ERPB2PMp4WaaUNFwb2EU4Exmv9hheydj5ekCV3w9P8n",
      "11111111111111111111111111111111",
    ] } },
    meta: {
      err: null,
      preBalances:  [11435897396563, 0,       1],
      postBalances: [11435895701623, 1488440, 1],
      loadedAddresses: { writable: [], readonly: [] },
    },
  };

  it("calcule les variations en SOL et ignore les comptes inchangés", () => {
    const { timestamp, deltas } = solanaTxToDeltas(tx);
    expect(timestamp).toBe(1790827457);
    expect(deltas).toHaveLength(2);
    expect(deltas[0].amount).toBeCloseTo(-0.00169494);
    expect(deltas[1]).toEqual(n("2ERPB2PMp4WaaUNFwb2EU4Exmv9hheydj5ekCV3w9P8n", 0.00148844));
  });

  it("inclut les comptes des lookup tables (transactions v0)", () => {
    const v0: SolanaTx = {
      blockTime: 1,
      transaction: { message: { accountKeys: ["A"] } },
      meta: { err: null, preBalances: [2e9, 0], postBalances: [1e9, 1e9], loadedAddresses: { writable: ["B"], readonly: [] } },
    };
    expect(solanaTxToDeltas(v0).deltas).toEqual([n("A", -1), n("B", 1)]);
  });

  it("ajoute les jetons du registre par propriétaire (USDC réel), ignore les autres mints", () => {
    const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const bal  = (accountIndex: number, mint: string, owner: string, amount: string) =>
      ({ accountIndex, mint, owner, uiTokenAmount: { amount } });
    const withTokens: SolanaTx = {
      blockTime: 1,
      transaction: { message: { accountKeys: ["X", "Y", "Z", "W"] } },
      meta: {
        err: null, preBalances: [0, 0, 0, 0], postBalances: [0, 0, 0, 0],
        preTokenBalances: [
          bal(2, USDC, "4MRUK7wYQ5QkvYkVDdMffyaURLQijAogViCQUmwrqaxJ", "905076313"),
          bal(3, USDC, "HHfJ8aaKoYFzoddDVnW4aommW6HQSnEdQf6R4d8w2E8S", "105654430"),
          bal(1, "SpamMint1111111111111111111111111111111111", "HHfJ8aaKoYFzoddDVnW4aommW6HQSnEdQf6R4d8w2E8S", "5"),
        ],
        postTokenBalances: [
          bal(2, USDC, "4MRUK7wYQ5QkvYkVDdMffyaURLQijAogViCQUmwrqaxJ", "905151309"),
          bal(3, USDC, "HHfJ8aaKoYFzoddDVnW4aommW6HQSnEdQf6R4d8w2E8S", "105774424"),
          bal(1, "SpamMint1111111111111111111111111111111111", "HHfJ8aaKoYFzoddDVnW4aommW6HQSnEdQf6R4d8w2E8S", "999"),
        ],
      },
    };
    const { deltas } = solanaTxToDeltas(withTokens);
    expect(deltas).toHaveLength(2);
    expect(deltas.every((d) => d.asset === USDC)).toBe(true);
    expect(deltas[0].amount).toBeCloseTo(0.074996);
  });

  it("compte de jetons créé dans la tx (absent de pre) → variation = solde post", () => {
    const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
    const tx2: SolanaTx = {
      blockTime: 1,
      transaction: { message: { accountKeys: ["A"] } },
      meta: {
        err: null, preBalances: [0], postBalances: [0],
        preTokenBalances: [],
        postTokenBalances: [{ accountIndex: 0, mint: USDT, owner: "B", uiTokenAmount: { amount: "2500000" } }],
      },
    };
    expect(solanaTxToDeltas(tx2).deltas).toEqual([{ owner: "B", asset: USDT, amount: 2.5 }]);
  });

  it("ignore les transactions en échec", () => {
    expect(solanaTxToDeltas({ ...tx, meta: { ...tx.meta!, err: { InstructionError: [0, "x"] } } }).deltas).toEqual([]);
  });
});

// ─── Sui ──────────────────────────────────────────────────────────────────────

describe("suiTxToDeltas", () => {
  const SUI  = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";
  const USDC = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
  const tx: SuiTx = {
    effects: {
      timestamp: "2026-10-01T04:01:48.872Z",
      balanceChanges: { nodes: [
        { owner: { address: "0xaaa" }, coinType: { repr: SUI },  amount: "-7236542087880" },
        { owner: { address: "0xbbb" }, coinType: { repr: SUI },  amount: "6824200000000" },
        { owner: { address: "0xaaa" }, coinType: { repr: USDC }, amount: "-3906585901" },
        { owner: null,                 coinType: { repr: SUI },  amount: "1000" },
      ] },
    },
  };

  it("garde SUI natif + coins du registre détenus par des adresses", () => {
    const { timestamp, deltas } = suiTxToDeltas(tx);
    expect(timestamp).toBe(Date.parse("2026-10-01T04:01:48.872Z") / 1000);
    expect(deltas).toEqual([
      n("0xaaa", -7236.54208788),
      n("0xbbb", 6824.2),
      { owner: "0xaaa", asset: USDC, amount: -3906.585901 },
    ]);
  });

  it("ignore les coins hors registre", () => {
    const spam: SuiTx = { effects: { timestamp: null, balanceChanges: { nodes: [
      { owner: { address: "0xaaa" }, coinType: { repr: "0xdead::fake::USDC" }, amount: "1000000" },
    ] } } };
    expect(suiTxToDeltas(spam).deltas).toEqual([]);
  });
});

// ─── Hedera ───────────────────────────────────────────────────────────────────

describe("hederaTxToDeltas", () => {
  const tx = {
    consensus_timestamp: "1790708548.574814721",
    result: "SUCCESS",
    transfers: [
      { account: "0.0.800",      amount: -438477832800 },
      { account: "0.0.802",      amount: 177993 },
      { account: "0.0.10521365", amount: -7372273722345193 },
      { account: "0.0.10881452", amount: 7372712200000000 },
    ],
  };

  it("exclut les comptes système (frais, staking) et convertit en HBAR", () => {
    const { timestamp, deltas } = hederaTxToDeltas(tx, "0.0.10881452");
    expect(timestamp).toBe(1790708548);
    expect(deltas.map((d) => d.owner)).toEqual(["0.0.10521365", "0.0.10881452"]);
    expect(deltas[1].amount).toBeCloseTo(73_727_122);
  });

  it("garde le compte focal même s'il est un compte système", () => {
    const { deltas } = hederaTxToDeltas(tx, "0.0.800");
    expect(deltas.some((d) => d.owner === "0.0.800")).toBe(true);
  });

  it("ignore les transactions en échec", () => {
    expect(hederaTxToDeltas({ ...tx, result: "INSUFFICIENT_PAYER_BALANCE" }, "0.0.10881452").deltas).toEqual([]);
  });

  it("ajoute les token_transfers du registre (USDC réel), ignore les autres tokens", () => {
    const withTokens = {
      ...tx,
      token_transfers: [
        { token_id: "0.0.456858", account: "0.0.3964804",  amount: 93012024 },
        { token_id: "0.0.456858", account: "0.0.10789302", amount: -93012024 },
        { token_id: "0.0.9999999", account: "0.0.3964804", amount: 1 },
      ],
    };
    const tokenDeltas = hederaTxToDeltas(withTokens, "0.0.3964804").deltas.filter((d) => d.asset !== NATIVE);
    expect(tokenDeltas).toEqual([
      { owner: "0.0.3964804",  asset: "0.0.456858", amount: 93.012024 },
      { owner: "0.0.10789302", asset: "0.0.456858", amount: -93.012024 },
    ]);
  });

  it("produit un transfert entrant de bout en bout", () => {
    const transfers = deltasToTransfers("0.0.10881452", hederaTxToDeltas(tx, "0.0.10881452"));
    expect(transfers).toHaveLength(1);
    expect(transfers[0].peer).toBe("0.0.10521365");
    expect(transfers[0].isOut).toBe(false);
  });
});
