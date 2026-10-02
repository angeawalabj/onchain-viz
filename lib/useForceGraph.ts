"use client";

import { useEffect, useRef, useState } from "react";
import type { GraphData, GraphNode, GraphLink, LinkEvent } from "./types";

// d3-force-3d exporte des fonctions nommées (pas de default export)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} = require("d3-force-3d") as any;

export interface SimNode extends GraphNode {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  index?: number;
}

export interface SimLink {
  source: SimNode;
  target: SimNode;
  volume:    number;
  txCount:   number;
  direction: "in" | "out" | "both";
  timestamp: number;
  assets?:   string[];
  events?:   LinkEvent[];
}

export interface SimResult {
  nodes:   SimNode[];
  links:   SimLink[];
  settled: boolean;
}

type Vec3 = { x: number; y: number; z: number };

const jitter = (r: number) => (Math.random() - 0.5) * r;

/**
 * Position de départ : la dernière connue (le graphe ne "saute" pas quand on
 * déplie un nœud), sinon près d'un voisin déjà placé, sinon aléatoire.
 */
export function initialPositions(
  ids: string[],
  links: { source: string; target: string }[],
  known: Map<string, Vec3>
): Map<string, Vec3> {
  const out = new Map<string, Vec3>();
  for (const id of ids) {
    const prev = known.get(id);
    if (prev) { out.set(id, { ...prev }); continue; }

    const neighbor = links
      .map((l) => (l.source === id ? l.target : l.target === id ? l.source : null))
      .map((nid) => (nid ? known.get(nid) : undefined))
      .find((p): p is Vec3 => !!p);

    out.set(id, neighbor
      ? { x: neighbor.x + jitter(4), y: neighbor.y + jitter(4), z: neighbor.z + jitter(4) }
      : { x: jitter(20), y: jitter(20), z: jitter(20) });
  }
  return out;
}

/**
 * Lance la simulation d3-force-3d et retourne les positions stabilisées.
 * La simulation est relancée à chaque changement de graphData, en repartant
 * des positions précédentes des nœuds déjà affichés.
 * Une fois stabilisée (alpha < threshold), elle est mise en pause.
 */
export function useForceGraph(graphData: GraphData | null): SimResult {
  const [result, setResult] = useState<SimResult>({
    nodes: [], links: [], settled: false,
  });
  const simRef = useRef<any>(null);
  const posRef = useRef<Map<string, Vec3>>(new Map());

  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0) {
      setResult({ nodes: [], links: [], settled: false });
      return;
    }

    // Stop previous simulation
    if (simRef.current) simRef.current.stop();

    const links: any[] = graphData.links.map((l) => ({
      ...l,
      source: typeof l.source === "string" ? l.source : (l.source as GraphNode).id,
      target: typeof l.target === "string" ? l.target : (l.target as GraphNode).id,
    }));

    // Copie profonde des nœuds pour que d3 puisse muter x/y/z
    const known  = posRef.current;
    const start  = initialPositions(graphData.nodes.map((n) => n.id), links, known);
    const reused = graphData.nodes.filter((n) => known.has(n.id)).length;
    const nodes: SimNode[] = graphData.nodes.map((n) => ({
      ...n,
      ...start.get(n.id)!,
      vx: 0, vy: 0, vz: 0,
    }));

    const savePositions = () => {
      posRef.current = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y, z: n.z }]));
    };

    // Calcul du volume max pour normaliser la force des liens
    const maxVolume = Math.max(...links.map((l) => l.volume), 1);

    const sim = forceSimulation(3)                // 3D
      .nodes(nodes)
      .numDimensions(3)
      .force("link",
        forceLink(links)
          .id((d: any) => (d as SimNode).id)
          .distance((l: any) => {
            // Plus le volume est élevé, plus les nœuds sont proches
            const normalized = l.volume / maxVolume;
            return 8 - normalized * 4;             // 4–8 unités
          })
          .strength(0.6)
      )
      .force("charge",
        forceManyBody()
          .strength(-120)                          // répulsion forte
          .theta(0.9)                              // Barnes-Hut approximation
      )
      .force("center",
        forceCenter(0, 0, 0).strength(0.05)
      )
      .force("collision",
        forceCollide()
          .radius((d: SimNode) => {
            const maxVol = Math.max(...nodes.map((n) => n.volume), 1);
            return 0.3 + Math.sqrt(d.volume / maxVol) * 2.5;
          })
          .strength(0.7)
      )
      .alphaDecay(0.02)                           // convergence plus lente = meilleur layout
      .velocityDecay(0.4)
      .on("tick", () => {
        // Mise à jour progressive — chaque 10 ticks
        if (sim.alpha() < 0.3) {
          setResult({
            nodes: [...nodes],
            links: [...links] as SimLink[],
            settled: false,
          });
        }
      })
      .on("end", () => {
        savePositions();
        setResult({
          nodes: [...nodes],
          links: [...links] as SimLink[],
          settled: true,
        });
      });

    // Graphe en grande partie déjà placé (nœud déplié) : on part d'une
    // énergie plus basse pour ne pas réorganiser toute la scène.
    if (reused > graphData.nodes.length / 2) sim.alpha(0.5);

    simRef.current = sim;

    // Cleanup
    return () => {
      sim.stop();
      savePositions();
    };
  }, [graphData]);

  return result;
}
