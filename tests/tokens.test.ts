import { describe, it, expect, vi, afterEach } from "vitest";
import { CHAIN_IDS, CHAINS } from "../lib/chains";
import { NATIVE, TOKENS, tokenInfo, toUnits } from "../lib/tokens";
import { getAssetPrices } from "../lib/prices";
import { fetchEtherscanTransfers } from "../lib/fetchers";

afterEach(() => vi.unstubAllGlobals());

// ─── Registre ─────────────────────────────────────────────────────────────────

describe("TOKENS", () => {
  it("chaque jeton a un prix possible (fixe ou CoinGecko) et des décimales valides", () => {
    for (const chain of CHAIN_IDS) {
      for (const t of Object.values(TOKENS[chain])) {
        expect(t.usd !== undefined || !!t.coingeckoId).toBe(true);
        expect(Number.isInteger(t.decimals) && t.decimals >= 0 && t.decimals <= 18).toBe(true);
      }
    }
  });

  it("les identifiants Ethereum sont des adresses en minuscules", () => {
    for (const id of Object.keys(TOKENS.ethereum)) {
      expect(CHAINS.ethereum.isValidAddress(id)).toBe(true);
      expect(id).toBe(id.toLowerCase());
    }
  });

  it("les mints Solana sont des adresses base58 valides", () => {
    for (const id of Object.keys(TOKENS.solana)) expect(CHAINS.solana.isValidAddress(id)).toBe(true);
  });

  it("tokenInfo : natif depuis la config de chaîne, undefined hors registre", () => {
    expect(tokenInfo("sui", NATIVE)).toMatchObject({ symbol: "SUI", decimals: 9 });
    expect(tokenInfo("hedera", "0.0.456858")?.symbol).toBe("USDC");
    expect(tokenInfo("hedera", "0.0.1")).toBeUndefined();
  });

  it("toUnits divise par 10^decimals", () => {
    expect(toUnits("93012024", 6)).toBeCloseTo(93.012024);
    expect(toUnits(150_000_000, 8)).toBe(1.5);
  });
});

// ─── Prix ─────────────────────────────────────────────────────────────────────

describe("getAssetPrices", () => {
  it("stablecoins à $1, autres via CoinGecko en une seule requête", async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ "hedera-hashgraph": { usd: 0.105 }, saucerswap: { usd: 0.014 } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const prices = await getAssetPrices("hedera");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prices[NATIVE]).toBe(0.105);
    expect(prices["0.0.456858"]).toBe(1);
    expect(prices["0.0.731861"]).toBe(0.014);
  });

  it("API indisponible → natif au prix de secours, stablecoins conservés", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const prices = await getAssetPrices("solana");
    expect(prices[NATIVE]).toBe(CHAINS.solana.fallbackPriceUSD);
    expect(prices["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"]).toBe(1);
    expect(prices["JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"]).toBeUndefined();
  });
});

// ─── Etherscan V2 ─────────────────────────────────────────────────────────────

describe("fetchEtherscanTransfers", () => {
  const ME   = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";
  const PEER = "0x28c6c06298d514db089934071355e5743bf21d60";

  function stubEtherscan(byAction: Record<string, unknown>) {
    const fetchMock = vi.fn(async (url: string) => {
      const action = new URL(url).searchParams.get("action")!;
      return { json: async () => byAction[action] };
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("utilise l'API V2 et fusionne ETH + ERC-20 du registre", async () => {
    const fetchMock = stubEtherscan({
      txlist: { status: "1", message: "OK", result: [
        { from: ME, to: PEER, value: "2000000000000000000", timeStamp: "100", hash: "0x1" },
      ] },
      tokentx: { status: "1", message: "OK", result: [
        // USDC réel
        { from: PEER, to: ME, value: "5000000", timeStamp: "200", hash: "0x2",
          contractAddress: "0xA0b86991c6218b36c1d19d4a2e9eB0cE3606eB48" },
        // faux jeton : ignoré
        { from: PEER, to: ME, value: "1", timeStamp: "300", hash: "0x3",
          contractAddress: "0x000000000000000000000000000000000000dead" },
      ] },
    });

    const transfers = await fetchEtherscanTransfers(ME, "KEY");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v2/api?chainid=1");
    expect(transfers).toEqual([
      { peer: PEER, isOut: true,  asset: NATIVE, amount: 2, timestamp: 100 },
      { peer: PEER, isOut: false, asset: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", amount: 5, timestamp: 200 },
    ]);
  });

  it("'No transactions found' → liste vide, pas d'erreur", async () => {
    stubEtherscan({
      txlist:  { status: "0", message: "No transactions found", result: [] },
      tokentx: { status: "0", message: "No transactions found", result: [] },
    });
    expect(await fetchEtherscanTransfers(ME, "KEY")).toEqual([]);
  });

  it("erreur Etherscan → message détaillé de `result`", async () => {
    stubEtherscan({
      txlist:  { status: "0", message: "NOTOK", result: "Invalid API Key" },
      tokentx: { status: "0", message: "NOTOK", result: "Invalid API Key" },
    });
    await expect(fetchEtherscanTransfers(ME, "BAD")).rejects.toThrow("Invalid API Key");
  });
});
