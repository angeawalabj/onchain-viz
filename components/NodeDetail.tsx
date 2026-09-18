"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useVizStore } from "../lib/store";
import { nodeColor, formatUSD, PALETTE } from "../lib/types";
import type { SimNode, SimLink } from "../lib/useForceGraph";
import { lookupEns } from "../lib/ens";

interface NodeDetailProps {
  nodes: SimNode[];
  links: SimLink[];
}

export function NodeDetail({ nodes, links }: NodeDetailProps) {
  const selectedId  = useVizStore((s) => s.selectedNode);
  const setSelected = useVizStore((s) => s.setSelected);

  const node = nodes.find((n) => n.id === selectedId);

  // Liens connectés au nœud sélectionné
  const connectedLinks = links.filter(
    (l) => l.source.id === selectedId || l.target.id === selectedId
  );

  // Lookup ENS name for the selected node (best-effort, async)
  const [ensName, setEnsName] = useState<string | null>(null);
  useEffect(() => {
    if (!node) { setEnsName(null); return; }
    setEnsName(null);
    lookupEns(node.id).then(setEnsName).catch(() => setEnsName(null));
  }, [node?.id]);

  const inflowVolume  = connectedLinks
    .filter((l) => l.target.id === selectedId)
    .reduce((s, l) => s + l.volume, 0);
  const outflowVolume = connectedLinks
    .filter((l) => l.source.id === selectedId)
    .reduce((s, l) => s + l.volume, 0);

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 12 }}
          transition={{ duration: 0.18 }}
          className="rounded-xl border border-white/8 bg-black/60 backdrop-blur-md overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: nodeColor(node.type), boxShadow: `0 0 6px ${nodeColor(node.type)}` }}
              />
              <span className="text-xs font-mono text-white/60 uppercase tracking-wider">
                {node.type}
              </span>
              {node.isSmartMoney && (
                <span className="rounded px-1.5 py-0.5 text-xs font-mono bg-violet-500/20 text-violet-300">
                  ✦ smart money
                </span>
              )}
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-white/30 hover:text-white/60 text-sm transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Adresse */}
          <div className="px-4 py-3 border-b border-white/6">
            <p className="text-xs text-white/40 font-mono mb-1">Adresse</p>
            <div className="flex items-center gap-2">
              <code className="text-xs text-white/80 font-mono truncate">
                {ensName ?? (node.label !== node.id.slice(0, 6) + "…" + node.id.slice(-4)
                  ? node.label
                  : node.id)}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(node.id)}
                className="shrink-0 text-white/20 hover:text-violet-400 text-xs transition-colors"
                title="Copier l'adresse"
              >
                ⎘
              </button>
            </div>
            <code className="text-xs text-white/30 font-mono mt-0.5 block">
              {node.id.slice(0, 10)}…{node.id.slice(-8)}
            </code>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-px bg-white/5">
            <StatCell label="Volume total"  value={formatUSD(node.volume)} />
            <StatCell label="Transactions"  value={node.txCount.toLocaleString()} />
            <StatCell label="Inflow"        value={formatUSD(inflowVolume)}  color="text-green-400" />
            <StatCell label="Outflow"       value={formatUSD(outflowVolume)} color="text-red-400" />
          </div>

          {/* Connexions */}
          {connectedLinks.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs text-white/40 font-mono mb-2">
                Connexions ({connectedLinks.length})
              </p>
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                {connectedLinks
                  .sort((a, b) => b.volume - a.volume)
                  .slice(0, 8)
                  .map((l, i) => {
                    const peer = l.source.id === selectedId ? l.target : l.source;
                    const isOut = l.source.id === selectedId;
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs font-mono"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={isOut ? "text-red-400" : "text-green-400"}>
                            {isOut ? "→" : "←"}
                          </span>
                          <span className="text-white/50 truncate">{peer.label}</span>
                        </div>
                        <span className="text-white/40 shrink-0 ml-2">
                          {formatUSD(l.volume)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Liens externes */}
          <div className="flex gap-2 px-4 py-3 border-t border-white/6">
            <ExternalLink
              href={`https://etherscan.io/address/${node.id}`}
              label="Etherscan"
            />
            <ExternalLink
              href={`https://app.zerion.io/${node.id}`}
              label="Zerion"
            />
            <ExternalLink
              href={`https://debank.com/profile/${node.id}`}
              label="DeBank"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatCell({
  label, value, color = "text-white/80",
}: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-black/30 px-4 py-2.5">
      <p className="text-xs text-white/35 font-mono mb-0.5">{label}</p>
      <p className={`text-sm font-mono font-medium ${color}`}>{value}</p>
    </div>
  );
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-1 text-center rounded-md border border-white/6 bg-white/4 py-1.5 text-xs text-white/40 font-mono hover:border-violet-500/30 hover:text-violet-300 transition-colors"
    >
      {label} ↗
    </a>
  );
}
