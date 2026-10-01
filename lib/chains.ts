/**
 * Configuration par chaîne : format d'adresse, presets, explorateurs, labels connus.
 * Ajouter une chaîne = ajouter une entrée ici + un adapter dans lib/adapters/.
 */

import type { Chain, ViewMode } from "./types";

export interface ChainConfig {
  label:            string;
  symbol:           string;          // jeton natif
  decimals:         number;
  color:            string;          // pastille du sélecteur
  coingeckoId:      string;
  fallbackPriceUSD: number;          // si CoinGecko est indisponible
  supportedModes:   ViewMode[];
  placeholder:      string;
  addressHint:      string;          // message d'erreur si format invalide
  isValidAddress:   (addr: string) => boolean;
  normalize:        (addr: string) => string;
  presets:          { label: string; address: string }[];
  knownLabels:      Record<string, string>;   // adresse normalisée → nom (type exchange)
  explorerLinks:    (addr: string) => { label: string; href: string }[];
}

const EVM_RE    = /^0x[0-9a-fA-F]{40}$/;
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SUI_RE    = /^0x[0-9a-fA-F]{1,64}$/;
const HEDERA_RE = /^\d+\.\d+\.\d+$/;

export const CHAINS: Record<Chain, ChainConfig> = {
  ethereum: {
    label:            "Ethereum",
    symbol:           "ETH",
    decimals:         18,
    color:            "#818cf8",
    coingeckoId:      "ethereum",
    fallbackPriceUSD: 3000,
    supportedModes:   ["wallet", "defi", "contract"],
    placeholder:      "Adresse ou ENS (ex: vitalik.eth)",
    addressHint:      "adresse 0x… (40 hex) ou nom ENS",
    isValidAddress:   (a) => EVM_RE.test(a),
    normalize:        (a) => a.toLowerCase(),
    presets: [
      { label: "vitalik.eth", address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" },
      { label: "Binance Hot", address: "0x28c6c06298d514db089934071355e5743bf21d60" },
      { label: "Wintermute",  address: "0x0000006daea1723962647b7e189d311d757fb793" },
    ],
    knownLabels: {
      "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": "Uniswap Router",
      "0x00000000219ab540356cbb839cbe05303d7705fa": "ETH2 Deposit",
      "0xd8da6bf26964af9d7eed9e03e53415d37aa96045": "vitalik.eth",
      "0x28c6c06298d514db089934071355e5743bf21d60": "Binance",
      "0x21a31ee1afc51d94c2efccaa2092ad1028285549": "Binance",
      "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be": "Binance",
    },
    explorerLinks: (a) => [
      { label: "Etherscan", href: `https://etherscan.io/address/${a}` },
      { label: "Zerion",    href: `https://app.zerion.io/${a}` },
      { label: "DeBank",    href: `https://debank.com/profile/${a}` },
    ],
  },

  solana: {
    label:            "Solana",
    symbol:           "SOL",
    decimals:         9,
    color:            "#14f195",
    coingeckoId:      "solana",
    fallbackPriceUSD: 150,
    supportedModes:   ["wallet"],
    placeholder:      "Adresse Solana (base58)",
    addressHint:      "adresse base58 (32 à 44 caractères)",
    isValidAddress:   (a) => BASE58_RE.test(a),
    normalize:        (a) => a,      // base58 : sensible à la casse
    presets: [
      { label: "Coinbase",  address: "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS" },
      { label: "Binance 2", address: "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9" },
      { label: "Binance",   address: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" },
    ],
    knownLabels: {
      "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": "Binance",
      "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9": "Binance",
      "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS": "Coinbase",
    },
    explorerLinks: (a) => [
      { label: "Solscan",  href: `https://solscan.io/account/${a}` },
      { label: "Explorer", href: `https://explorer.solana.com/address/${a}` },
    ],
  },

  sui: {
    label:            "Sui",
    symbol:           "SUI",
    decimals:         9,
    color:            "#4da2ff",
    coingeckoId:      "sui",
    fallbackPriceUSD: 1.2,
    supportedModes:   ["wallet"],
    placeholder:      "Adresse Sui ou nom SuiNS (ex: example.sui)",
    addressHint:      "adresse 0x… (64 hex) ou nom .sui",
    isValidAddress:   (a) => SUI_RE.test(a),
    normalize:        (a) => "0x" + a.slice(2).toLowerCase().padStart(64, "0"),
    presets: [
      { label: "Hot wallet CEX", address: "0x935029ca5219502a47ac9b69f556ccf6e2198b5e7815cf50f68846f723739cbd" },
      { label: "example.sui",    address: "example.sui" },
    ],
    knownLabels: {},
    explorerLinks: (a) => [
      { label: "Suiscan",   href: `https://suiscan.xyz/mainnet/account/${a}` },
      { label: "SuiVision", href: `https://suivision.xyz/account/${a}` },
    ],
  },

  hedera: {
    label:            "Hedera",
    symbol:           "HBAR",
    decimals:         8,
    color:            "#a3a3a3",
    coingeckoId:      "hedera-hashgraph",
    fallbackPriceUSD: 0.1,
    supportedModes:   ["wallet"],
    placeholder:      "Compte Hedera (ex: 0.0.1030878)",
    addressHint:      "identifiant de compte shard.realm.num (ex: 0.0.12345)",
    isValidAddress:   (a) => HEDERA_RE.test(a),
    normalize:        (a) => a,
    presets: [
      // Comptes choisis pour leur activité (nombreux transferts > 1000 HBAR)
      { label: "Compte actif #1", address: "0.0.1030878" },
      { label: "Compte actif #2", address: "0.0.1133968" },
    ],
    knownLabels: {},
    explorerLinks: (a) => [
      { label: "HashScan", href: `https://hashscan.io/mainnet/account/${a}` },
    ],
  },
};

export const CHAIN_IDS = Object.keys(CHAINS) as Chain[];

export function isModeSupported(chain: Chain, mode: ViewMode): boolean {
  return CHAINS[chain].supportedModes.includes(mode);
}
