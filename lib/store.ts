"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { VizStore } from "./types";
import { isModeSupported } from "./chains";

export const useVizStore = create<VizStore>()(
  persist(
    (set) => ({
      // Chaîne — repasse en mode wallet si le mode actif n'y est pas disponible
      chain:    "ethereum",
      setChain: (chain) => set((s) => ({
        chain,
        mode:         isModeSupported(chain, s.mode) ? s.mode : "wallet",
        graph:        null,
        error:        null,
        selectedNode: null,
      })),

      // Mode
      mode:    "wallet",
      setMode: (mode) => set((s) => isModeSupported(s.chain, mode)
        ? { mode, graph: null, error: null, selectedNode: null }
        : {}),

      // Données
      graph:     null,
      setGraph:  (graph) => set({ graph, isLoading: false, error: null, replayTime: null }),
      isLoading: false,
      error:     null,

      // Sélection
      selectedNode: null,
      setSelected:  (selectedNode) => set({ selectedNode }),
      hoveredNode:  null,
      setHovered:   (hoveredNode) => set({ hoveredNode }),

      // Rejeu
      replayTime:    null,
      setReplayTime: (replayTime) => set({ replayTime }),

      // Caméra
      autoRotate:       false,
      toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),

      // Clés API (persistées dans localStorage)
      etherscanKey: "",
      alchemyKey:   "",
      graphApiKey:  "",
      heliusKey:    "",
      setApiKeys:   (keys) => set(keys),
    }),
    {
      name:    "onchain-viz-store",
      // Ne persiste que les clés API, la chaîne et le mode — pas le graphe
      partialize: (s) => ({
        etherscanKey: s.etherscanKey,
        alchemyKey:   s.alchemyKey,
        graphApiKey:  s.graphApiKey,
        heliusKey:    s.heliusKey,
        chain:        s.chain,
        mode:         s.mode,
        autoRotate:   s.autoRotate,
      }),
    }
  )
);
