"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { useVizStore } from "../lib/store";
import { useForceGraph } from "../lib/useForceGraph";
import { SearchPanel } from "../components/SearchPanel";
import { NodeDetail } from "../components/NodeDetail";
import { ControlsBar } from "../components/ControlsBar";
import { mockWalletGraph } from "../lib/fetchers";
import { clusterGraph } from "../lib/clustering";

// Canvas WebGL doit être chargé côté client uniquement
const Scene3D = dynamic(
  () => import("../components/Scene3D").then((m) => m.Scene3D),
  {
    ssr:     false,
    loading: () => <SceneLoaderFallback />,
  }
);

function SceneLoaderFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-400 mx-auto" />
        <p className="text-sm text-white/40 font-mono">Chargement Three.js…</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const graph      = useVizStore((s) => s.graph);
  const setGraph   = useVizStore((s) => s.setGraph);
  const mode = useVizStore((s) => s.mode);

  // Charge les données de démo au premier rendu
  useEffect(() => {
    if (!graph) {
      setGraph(mockWalletGraph("0xd8da6bf26964af9d7eed9e03e53415d37aa96045"));
    }
  }, []);

  // Applique le clustering si le graphe dépasse le budget de nœuds (ADR-0002)
  const displayGraph = graph ? clusterGraph(graph, mode).graph : null;
  const { nodes, links, settled } = useForceGraph(displayGraph);

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: "#060610" }}>

      {/* ── Sidebar gauche ─────────────────────────────────────────────────── */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0,   opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="relative z-10 flex w-72 flex-col border-r border-white/6 bg-black/50 backdrop-blur-xl"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/6">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-500/20 border border-violet-500/30">
            <span className="text-violet-400 text-sm">⬡</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white/90 font-mono">OnChain Viz</h1>
            <p className="text-xs text-white/30 font-mono">3D blockchain explorer</p>
          </div>
        </div>

        {/* Panneau de recherche */}
        <div className="flex-1 overflow-y-auto p-4">
          <SearchPanel />

          {/* Légende */}
          <div className="mt-6">
            <p className="text-xs font-mono text-white/30 mb-2 uppercase tracking-wider">Légende</p>
            <div className="flex flex-col gap-1.5">
              {[
                { color: "#7c6df0", label: "Wallet" },
                { color: "#14b8a6", label: "Smart contract" },
                { color: "#f59e0b", label: "Exchange" },
                { color: "#10b981", label: "DEX / Pool" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}60` }}
                  />
                  <span className="text-xs font-mono text-white/45">{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-1">
                <span className="h-2 w-2 rounded-full bg-violet-300 shrink-0 animate-pulse" />
                <span className="text-xs font-mono text-white/45">Smart money (glow)</span>
              </div>
            </div>
          </div>

          {/* Contrôles clavier */}
          <div className="mt-5">
            <p className="text-xs font-mono text-white/30 mb-2 uppercase tracking-wider">Navigation</p>
            <div className="flex flex-col gap-1">
              {[
                ["Scroll", "Zoom"],
                ["Glisser", "Orbiter"],
                ["Clic droit", "Panoramique"],
                ["Clic nœud", "Sélectionner"],
                ["Échap", "Désélectionner"],
              ].map(([key, action]) => (
                <div key={key} className="flex items-center justify-between">
                  <kbd className="text-xs font-mono text-white/25 bg-white/5 border border-white/8 rounded px-1.5 py-0.5">{key}</kbd>
                  <span className="text-xs text-white/30 font-mono">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats en bas */}
        <ControlsBar nodes={nodes} links={links} settled={settled} />
      </motion.aside>

      {/* ── Canvas 3D ───────────────────────────────────────────────────────── */}
      <div className="relative flex-1">
        <Scene3D />

        {/* Watermark discret */}
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
          <p className="text-xs font-mono text-white/15">
            données démo — connecte une clé API pour les données réelles
          </p>
        </div>
      </div>

      {/* ── Panel détail nœud (droite) ─────────────────────────────────────── */}
      <motion.div
        className="absolute right-4 top-4 w-72 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <NodeDetail nodes={nodes} links={links} />
      </motion.div>
    </div>
  );
}
