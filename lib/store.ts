"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GraphData, ViewMode, VizStore } from "./types";

export const useVizStore = create<VizStore>()(
  persist(
    (set) => ({
      // Mode
      mode:    "wallet",
      setMode: (mode) => set({ mode, graph: null, error: null, selectedNode: null }),

      // Données
      graph:     null,
      setGraph:  (graph) => set({ graph, isLoading: false, error: null }),
      isLoading: false,
      error:     null,

      // Sélection
      selectedNode: null,
      setSelected:  (selectedNode) => set({ selectedNode }),
      hoveredNode:  null,
      setHovered:   (hoveredNode) => set({ hoveredNode }),

      // Caméra
      autoRotate:       false,
      toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),

      // Clés API (persistées dans localStorage)
      etherscanKey: "",
      alchemyKey:   "",
      graphApiKey:  "",
      setApiKeys:   (keys) => set(keys),
    }),
    {
      name:    "onchain-viz-store",
      // Ne persiste que les clés API et le mode — pas le graphe
      partialize: (s) => ({
        etherscanKey: s.etherscanKey,
        alchemyKey:   s.alchemyKey,
        graphApiKey:  s.graphApiKey,
        mode:         s.mode,
        autoRotate:   s.autoRotate,
      }),
    }
  )
);
