"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVizStore } from "../lib/store";
import { formatUSD } from "../lib/types";
import type { SimNode, SimLink } from "../lib/useForceGraph";

interface ControlsBarProps {
  nodes:   SimNode[];
  links:   SimLink[];
  settled: boolean;
}

export function ControlsBar({ nodes, links, settled }: ControlsBarProps) {
  const autoRotate      = useVizStore((s) => s.autoRotate);
  const toggleAutoRotate = useVizStore((s) => s.toggleAutoRotate);
  const [showKeys, setShowKeys] = useState(false);

  const totalVolume = nodes.reduce((s, n) => s + n.volume, 0);
  const totalTx     = nodes.reduce((s, n) => s + n.txCount, 0);

  return (
    <>
      {/* Barre de stats en bas */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-white/6">
        {/* Métriques */}
        <div className="flex items-center gap-4">
          <Metric label="nœuds"  value={nodes.length.toString()} />
          <Metric label="liens"   value={links.length.toString()} />
          <Metric label="volume"  value={formatUSD(totalVolume)} />
          <Metric label="tx"      value={totalTx > 1000 ? `${(totalTx/1000).toFixed(1)}K` : totalTx.toString()} />
        </div>

        {/* Indicateur simulation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${settled ? "bg-green-400" : "bg-amber-400 animate-pulse"}`} />
            <span className="text-xs font-mono text-white/30">
              {settled ? "stabilisé" : "simulation…"}
            </span>
          </div>

          {/* Contrôles */}
          <button
            onClick={toggleAutoRotate}
            className={`rounded-md border px-2.5 py-1 text-xs font-mono transition-all ${
              autoRotate
                ? "border-violet-500/40 text-violet-400 bg-violet-500/10"
                : "border-white/8 text-white/30 hover:text-white/50"
            }`}
          >
            ↻ rotation
          </button>

          <button
            onClick={() => setShowKeys((v) => !v)}
            className="rounded-md border border-white/8 px-2.5 py-1 text-xs font-mono text-white/30 hover:text-white/50 transition-colors"
          >
            ⚙ API keys
          </button>
        </div>
      </div>

      {/* Panel clés API */}
      <AnimatePresence>
        {showKeys && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <ApiKeyPanel onClose={() => setShowKeys(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-mono font-medium text-white/75">{value}</p>
      <p className="text-xs font-mono text-white/30">{label}</p>
    </div>
  );
}

function ApiKeyPanel({ onClose }: { onClose: () => void }) {
  const etherscanKey = useVizStore((s) => s.etherscanKey);
  const alchemyKey   = useVizStore((s) => s.alchemyKey);
  const graphApiKey  = useVizStore((s) => s.graphApiKey);
  const setApiKeys   = useVizStore((s) => s.setApiKeys);

  const [keys, setKeys] = useState({
    etherscanKey,
    alchemyKey,
    graphApiKey,
  });

  function handleSave() {
    setApiKeys(keys);
    onClose();
  }

  return (
    <div className="border-t border-white/6 px-4 py-4 bg-black/40">
      <p className="text-xs font-mono text-white/40 mb-3">
        Les clés sont stockées localement (localStorage) — jamais envoyées à un serveur.
        Sans clé, des données de démo sont affichées.
      </p>
      <div className="grid grid-cols-1 gap-2 mb-3">
        {[
          { key: "etherscanKey", label: "Etherscan API Key", placeholder: "Wallet graph mode", href: "https://etherscan.io/apis" },
          { key: "alchemyKey",   label: "Alchemy API Key",   placeholder: "Contract activity mode", href: "https://dashboard.alchemy.com" },
          { key: "graphApiKey",  label: "The Graph API Key",  placeholder: "DeFi liquidity mode", href: "https://thegraph.com/studio" },
        ].map(({ key, label, placeholder, href }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-mono text-white/50">{label}</label>
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-400/60 hover:text-violet-400 font-mono">
                Obtenir ↗
              </a>
            </div>
            <input
              type="password"
              value={(keys as any)[key]}
              onChange={(e) => setKeys((k) => ({ ...k, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full rounded-md border border-white/8 bg-white/4 px-3 py-1.5 text-xs font-mono text-white/70 placeholder-white/20 outline-none focus:border-violet-500/40"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 rounded-md bg-violet-600/70 py-1.5 text-xs font-mono text-white hover:bg-violet-500/80 transition-colors"
        >
          Sauvegarder
        </button>
        <button
          onClick={onClose}
          className="rounded-md border border-white/8 px-4 py-1.5 text-xs font-mono text-white/40 hover:text-white/60 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
