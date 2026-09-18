"use client";

import { Suspense, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Stars,
  Environment,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { useVizStore } from "../lib/store";
import { useForceGraph } from "../lib/useForceGraph";
import { GraphNodes } from "./GraphNodes";
import { GraphEdges } from "./GraphEdges";
import { NodeLabels } from "./NodeLabels";
import { PALETTE } from "../lib/types";

export function Scene3D() {
  const graph       = useVizStore((s) => s.graph);
  const selectedId  = useVizStore((s) => s.selectedNode);
  const hoveredId   = useVizStore((s) => s.hoveredNode);
  const autoRotate  = useVizStore((s) => s.autoRotate);
  const setSelected = useVizStore((s) => s.setSelected);
  const setHovered  = useVizStore((s) => s.setHovered);

  const { nodes, links } = useForceGraph(graph);

  const maxVolume = nodes.length > 0
    ? Math.max(...nodes.map((n) => n.volume), 1)
    : 1;

  const handleSelect = useCallback((id: string) => {
    setSelected(id === selectedId ? null : id);
  }, [selectedId, setSelected]);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 38], fov: 55, near: 0.1, far: 1000 }}
      gl={{
        antialias:    true,
        alpha:        false,
        toneMapping:  THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      style={{ background: PALETTE.bg }}
      onPointerMissed={() => setSelected(null)}
    >
      {/* Éclairage */}
      <ambientLight intensity={0.15} />
      <pointLight position={[20, 20, 20]} intensity={1.2} color="#c4b5fd" />
      <pointLight position={[-20, -10, -20]} intensity={0.5} color="#14b8a6" />
      <pointLight position={[0, -30, 0]} intensity={0.3} color="#818cf8" />

      {/* Environnement HDRI pour reflections sur les sphères */}
      <Environment preset="night" />

      {/* Étoiles de fond */}
      <Stars
        radius={120}
        depth={60}
        count={4000}
        factor={3}
        saturation={0.3}
        fade
        speed={0.3}
      />

      {/* Graphe 3D */}
      <Suspense fallback={null}>
        {nodes.length > 0 && (
          <>
            <GraphEdges
              links={links}
              maxVolume={maxVolume}
              selectedId={selectedId}
            />
            <GraphNodes
              nodes={nodes}
              maxVolume={maxVolume}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={handleSelect}
              onHover={setHovered}
            />
            <NodeLabels
              nodes={nodes}
              maxVolume={maxVolume}
              selectedId={selectedId}
              hoveredId={hoveredId}
            />
          </>
        )}
      </Suspense>

      {/* Contrôles orbitaux */}
      <OrbitControls
        makeDefault
        autoRotate={autoRotate}
        autoRotateSpeed={0.4}
        enableDamping
        dampingFactor={0.06}
        minDistance={5}
        maxDistance={120}
        enablePan
      />

      {/* Post-processing */}
      <EffectComposer multisampling={4}>
        {/* Bloom sélectif sur le layer 1 */}
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.6}
          intensity={1.8}
          radius={0.7}
          levels={6}
          mipmapBlur
        />
        {/* Légère aberration chromatique pour l'aesthetic cyberpunk */}
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={new THREE.Vector2(0.0008, 0.0008)}
          radialModulation={false}
          modulationOffset={0}
        />
        {/* Vignette pour assombrir les bords */}
        <Vignette
          offset={0.3}
          darkness={0.6}
          eskil={false}
          blendFunction={BlendFunction.NORMAL}
        />
      </EffectComposer>
    </Canvas>
  );
}

/** Placeholder pendant le chargement du Canvas */
export function SceneLoader() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-400 mx-auto" />
        <p className="text-sm text-white/40 font-mono">Initialisation du graphe 3D…</p>
      </div>
    </div>
  );
}
