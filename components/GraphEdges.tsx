"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SimLink } from "../lib/useForceGraph";
import { PALETTE } from "../lib/types";

interface GraphEdgesProps {
  links:      SimLink[];
  maxVolume:  number;
  selectedId: string | null;
}

/**
 * Rendu de tous les liens en BufferGeometry pour performance optimale.
 * Un seul draw call pour toutes les arêtes via LineSegments.
 * Les particules de flux sont séparées pour les liens importants.
 */
export function GraphEdges({ links, maxVolume, selectedId }: GraphEdgesProps) {
  const lineRef = useRef<THREE.LineSegments>(null!);

  // Construit positions + couleurs pour tous les liens en une seule géométrie
  const { positions, colors } = useMemo(() => {
    const positions: number[] = [];
    const colors:    number[] = [];

    for (const link of links) {
      if (!link.source || !link.target) continue;

      const sx = link.source.x ?? 0;
      const sy = link.source.y ?? 0;
      const sz = link.source.z ?? 0;
      const tx = link.target.x ?? 0;
      const ty = link.target.y ?? 0;
      const tz = link.target.z ?? 0;

      positions.push(sx, sy, sz, tx, ty, tz);

      // Couleur selon direction + opacité selon volume
      const volumeRatio = link.volume / Math.max(maxVolume, 1);
      const opacity = 0.08 + volumeRatio * 0.55;

      const isHighlighted =
        selectedId &&
        (link.source.id === selectedId || link.target.id === selectedId);

      let r: number, g: number, b: number;
      if (isHighlighted) {
        const col = new THREE.Color(PALETTE.accent);
        r = col.r; g = col.g; b = col.b;
      } else if (link.direction === "in") {
        const col = new THREE.Color(PALETTE.linkInflow);
        r = col.r * opacity; g = col.g * opacity; b = col.b * opacity;
      } else if (link.direction === "out") {
        const col = new THREE.Color(PALETTE.linkOutflow);
        r = col.r * opacity; g = col.g * opacity; b = col.b * opacity;
      } else {
        const col = new THREE.Color(PALETTE.linkNeutral);
        r = col.r * opacity; g = col.g * opacity; b = col.b * opacity;
      }

      // Même couleur pour les deux extrémités du segment
      colors.push(r, g, b, r, g, b);
    }

    return { positions, colors };
  }, [links, maxVolume, selectedId]);

  // Met à jour la géométrie quand les positions changent (simulation en cours)
  useFrame(() => {
    if (!lineRef.current) return;
    const geo  = lineRef.current.geometry;
    const posAttr = geo.getAttribute("position");
    if (!posAttr) return;

    const arr = posAttr.array as Float32Array;
    let i = 0;
    for (const link of links) {
      if (!link.source || !link.target) { i += 6; continue; }
      arr[i++] = link.source.x ?? 0;
      arr[i++] = link.source.y ?? 0;
      arr[i++] = link.source.z ?? 0;
      arr[i++] = link.target.x ?? 0;
      arr[i++] = link.target.y ?? 0;
      arr[i++] = link.target.z ?? 0;
    }
    posAttr.needsUpdate = true;
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geo.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );
    return geo;
  }, [positions, colors]);

  return (
    <>
      <lineSegments ref={lineRef} geometry={geometry} frustumCulled={false}>
        <lineBasicMaterial
          vertexColors
          transparent
          linewidth={1}   // linewidth > 1 non supporté WebGL — utiliser tubes si nécessaire
          depthWrite={false}
        />
      </lineSegments>

      {/* Particules de flux sur les liens importants */}
      <FlowParticles
        links={links.filter(
          (l) => l.volume / Math.max(maxVolume, 1) > 0.15
        )}
      />
    </>
  );
}

/** Petites particules qui se déplacent le long des liens importants */
function FlowParticles({ links }: { links: SimLink[] }) {
  const ref      = useRef<THREE.Points>(null!);
  const progress = useRef<Float32Array>(
    new Float32Array(links.length).map(() => Math.random())
  );

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(links.length * 3);
    const col = new Float32Array(links.length * 3);
    links.forEach((l, i) => {
      pos[i * 3]     = l.source.x ?? 0;
      pos[i * 3 + 1] = l.source.y ?? 0;
      pos[i * 3 + 2] = l.source.z ?? 0;
      const c = new THREE.Color(
        l.direction === "in"  ? PALETTE.linkInflow :
        l.direction === "out" ? PALETTE.linkOutflow :
        PALETTE.accent
      );
      col[i * 3]     = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    });
    return { positions: pos, colors: col };
  }, [links]);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color",    new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);

  useFrame((_, delta) => {
    if (!ref.current || links.length === 0) return;
    const posAttr = ref.current.geometry.getAttribute("position");
    const arr     = posAttr.array as Float32Array;

    links.forEach((l, i) => {
      // Avance la particule de 0→1 le long du lien
      progress.current[i] = (progress.current[i] + delta * 0.4) % 1;
      const t = progress.current[i];
      arr[i * 3]     = (l.source.x ?? 0) * (1 - t) + (l.target.x ?? 0) * t;
      arr[i * 3 + 1] = (l.source.y ?? 0) * (1 - t) + (l.target.y ?? 0) * t;
      arr[i * 3 + 2] = (l.source.z ?? 0) * (1 - t) + (l.target.z ?? 0) * t;
    });

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial
        size={0.18}
        vertexColors
        transparent
        opacity={0.9}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
