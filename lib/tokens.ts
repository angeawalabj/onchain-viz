/**
 * Registre des jetons suivis par chaîne (liste blanche).
 *
 * N'importe qui peut créer un faux "USDC" : on identifie donc les jetons par
 * leur identifiant on-chain exact (contrat, mint, coin type, token id), jamais
 * par leur symbole. Les jetons hors registre sont ignorés (pas de prix fiable).
 * Identifiants et décimales vérifiés on-chain le 2026-10-01 (ADR-0004).
 */

import type { Chain } from "./types";
import { CHAINS } from "./chains";

/** Clé d'actif du jeton natif de chaque chaîne (ETH, SOL, SUI, HBAR). */
export const NATIVE = "native";

export interface TokenInfo {
  symbol:       string;
  decimals:     number;
  coingeckoId?: string;
  usd?:         number;        // prix fixe (stablecoins)
}

export const TOKENS: Record<Chain, Record<string, TokenInfo>> = {
  // Clé : adresse de contrat ERC-20 en minuscules
  ethereum: {
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC",  decimals: 6,  usd: 1 },
    "0xdac17f958d2ee523a2206206994597c13d831ec7": { symbol: "USDT",  decimals: 6,  usd: 1 },
    "0x6b175474e89094c44da98b954eedeac495271d0f": { symbol: "DAI",   decimals: 18, usd: 1 },
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { symbol: "WETH",  decimals: 18, coingeckoId: "weth" },
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": { symbol: "WBTC",  decimals: 8,  coingeckoId: "wrapped-bitcoin" },
    "0xae7ab96520de3a18e5e111b5eaab095312d7fe84": { symbol: "stETH", decimals: 18, coingeckoId: "staked-ether" },
    "0x514910771af9ca656af840dff83e8264ecf986ca": { symbol: "LINK",  decimals: 18, coingeckoId: "chainlink" },
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": { symbol: "UNI",   decimals: 18, coingeckoId: "uniswap" },
  },

  // Clé : mint SPL. wSOL volontairement absent : il double-compterait le SOL natif
  // (wrap/unwrap = mouvements de lamports déjà comptés).
  solana: {
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC",    decimals: 6, usd: 1 },
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": { symbol: "USDT",    decimals: 6, usd: 1 },
    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN":  { symbol: "JUP",     decimals: 6, coingeckoId: "jupiter-exchange-solana" },
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": { symbol: "BONK",    decimals: 5, coingeckoId: "bonk" },
    "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn": { symbol: "JitoSOL", decimals: 9, coingeckoId: "jito-staked-sol" },
  },

  // Clé : coin type complet
  sui: {
    "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC":  { symbol: "USDC",  decimals: 6, usd: 1 },
    "0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN":  { symbol: "USDT",  decimals: 6, usd: 1 },
    "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP":  { symbol: "DEEP",  decimals: 6, coingeckoId: "deep" },
    "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS": { symbol: "CETUS", decimals: 9, coingeckoId: "cetus-protocol" },
    "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL":    { symbol: "WAL",   decimals: 9, coingeckoId: "walrus-2" },
  },

  // Clé : token id HTS
  hedera: {
    "0.0.456858": { symbol: "USDC",  decimals: 6, usd: 1 },
    "0.0.731861": { symbol: "SAUCE", decimals: 6, coingeckoId: "saucerswap" },
  },
};

/** Infos d'un actif (natif ou jeton du registre) ; undefined si non suivi. */
export function tokenInfo(chain: Chain, asset: string): TokenInfo | undefined {
  if (asset === NATIVE) {
    const c = CHAINS[chain];
    return { symbol: c.symbol, decimals: c.decimals, coingeckoId: c.coingeckoId };
  }
  return TOKENS[chain][asset];
}

/** Convertit un montant entier brut (string ou number) en unités du jeton. */
export function toUnits(raw: string | number, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}
