"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { useVizStore } from "../lib/store";
import { resolveAddress } from "../lib/ens";
import {
  fetchWalletGraph,
  fetchDefiGraph,
  fetchContractGraph,
  mockWalletGraph,
  mockDefiGraph,
  mockContractGraph,
} from "../lib/fetchers";
import type { ViewMode } from "../lib/types";

const MODE_CONFIG: Record<ViewMode, {
  label:       string;
  icon:        string;
  placeholder: string;
  hasAddress:  boolean;
}> = {
  wallet: {
    label:       "Wallet Graph",
    icon:        "◈",
    placeholder: "Adresse ou ENS (ex: vitalik.eth)",
    hasAddress:  true,
  },
  defi: {
    label:       "DeFi Liquidity",
    icon:        "⬡",
    placeholder: "Protocole sélectionnable ci-dessous",
    hasAddress:  false,
  },
  contract: {
    label:       "Contract Activity",
    icon:        "⬟",
    placeholder: "Adresse du smart contract",
    hasAddress:  true,
  },
};

const DEFI_PROTOCOLS = [
  { value: "uniswap_v3", label: "Uniswap V3" },
  { value: "aave_v3",    label: "Aave V3" },
  { value: "curve",      label: "Curve" },
] as const;

const PRESET_ADDRESSES: Record<ViewMode, { label: string; address: string }[]> = {
  wallet: [
    { label: "vitalik.eth", address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" },
    { label: "Binance Hot", address: "0x28c6c06298d514db089934071355e5743bf21d60" },
    { label: "Wintermute", address: "0x0000006daea1723962647b7e189d311d757fb793" },
  ],
  defi: [],
  contract: [
    { label: "USDC",      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
    { label: "Uniswap V3", address: "0x1f98431c8ad98523631ae4a59f267346ea31f984" },
    { label: "USDT",      address: "0xdac17f958d2ee523a2206206994597c13d831ec7" },
  ],
};

export function SearchPanel() {
  const mode           = useVizStore((s) => s.mode);
  const setMode        = useVizStore((s) => s.setMode);
  const etherscanKey   = useVizStore((s) => s.etherscanKey);
  const alchemyKey     = useVizStore((s) => s.alchemyKey);
  const graphApiKey    = useVizStore((s) => s.graphApiKey);
  const setGraph       = useVizStore((s) => s.setGraph);

  const [address,    setAddress]   = useState("");
  const [protocol,   setProtocol]  = useState<"uniswap_v3" | "aave_v3" | "curve">("uniswap_v3");
  const [isPending,  startTransition] = useTransition();
  const [error,      setError]     = useState<string | null>(null);

  const cfg = MODE_CONFIG[mode];

  async function handleFetch() {
    setError(null);
    startTransition(async () => {
      try {
        let graph;
        if (mode === "wallet") {
          if (address) {
            // Résolution ENS si nécessaire (ex: vitalik.eth → 0x...)
            const resolved = await resolveAddress(address.trim());
            graph = await fetchWalletGraph(
              { address: resolved, depth: 1, minVolume: 100 },
              etherscanKey
            );
          } else {
            graph = mockWalletGraph("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
          }
        } else if (mode === "defi") {
          graph = await fetchDefiGraph({ protocol, topN: 20 }, graphApiKey);
        } else {
          if (address) {
            const resolved    = await resolveAddress(address.trim());
            const latestBlock = 20_000_000;
            graph = await fetchContractGraph(
              { address: resolved, fromBlock: latestBlock - 5000, toBlock: latestBlock },
              alchemyKey
            );
          } else {
            graph = mockContractGraph("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
          }
        }
        setGraph(graph);
      } catch (e: any) {
        setError(e.message || "Erreur de chargement");
        // Fallback sur mock
        const mock = mode === "defi"
          ? mockDefiGraph()
          : mode === "wallet"
          ? mockWalletGraph(address || "0xd8da6bf26964af9d7eed9e03e53415d37aa96045")
          : mockContractGraph(address || "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
        setGraph(mock);
      }
    });
  }

  function handlePreset(addr: string) {
    setAddress(addr);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mode selector */}
      <div className="flex gap-1 rounded-lg bg-white/5 p-1">
        {(Object.keys(MODE_CONFIG) as ViewMode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setAddress(""); setError(null); }}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-mono transition-all ${
              mode === m
                ? "bg-violet-500/20 text-violet-300 shadow-inner"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            <span className="mr-1.5">{MODE_CONFIG[m].icon}</span>
            {MODE_CONFIG[m].label}
          </button>
        ))}
      </div>

      {/* Input */}
      {cfg.hasAddress ? (
        <div className="relative">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFetch()}
            placeholder={cfg.placeholder}
            spellCheck={false}
            className="w-full rounded-lg border border-white/8 bg-white/4 px-3 py-2.5 pr-10 text-xs font-mono text-white/80 placeholder-white/25 outline-none transition focus:border-violet-500/50 focus:bg-white/6"
          />
          {address && (
            <button
              onClick={() => setAddress("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      ) : (
        /* Sélecteur protocole DeFi */
        <select
          value={protocol}
          onChange={(e) => setProtocol(e.target.value as any)}
          className="rounded-lg border border-white/8 bg-white/4 px-3 py-2.5 text-xs font-mono text-white/80 outline-none focus:border-violet-500/50"
        >
          {DEFI_PROTOCOLS.map((p) => (
            <option key={p.value} value={p.value} className="bg-gray-900">
              {p.label}
            </option>
          ))}
        </select>
      )}

      {/* Presets */}
      {PRESET_ADDRESSES[mode].length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {PRESET_ADDRESSES[mode].map((p) => (
            <button
              key={p.address}
              onClick={() => handlePreset(p.address)}
              className="rounded-md border border-white/6 bg-white/4 px-2 py-1 text-xs text-white/40 font-mono hover:border-violet-500/30 hover:text-violet-300 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Bouton fetch */}
      <button
        onClick={handleFetch}
        disabled={isPending}
        className="relative overflow-hidden rounded-lg bg-violet-600/80 px-4 py-2.5 text-xs font-mono font-medium text-white transition-all hover:bg-violet-500/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
            Chargement…
          </span>
        ) : (
          `Visualiser ${MODE_CONFIG[mode].icon}`
        )}
      </button>

      {/* Erreur */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300/80 font-mono"
        >
          ⚠ {error} — données de démo affichées
        </motion.p>
      )}
    </div>
  );
}
