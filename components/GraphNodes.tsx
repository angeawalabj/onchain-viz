"use client";

import { useRef, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { Instance, Instances } from "@react-three/drei";
import * as THREE from "three";
import type { SimNode } from "../lib/useForceGraph";
import { nodeColor, nodeRadius, PALETTE } from "../lib/types";

interface GraphNodesProps {
  nodes:       SimNode[];
  maxVolume:   number;
  selectedId:  string | null;
  hoveredId:   string | null;
  onSelect:    (id: string) => void;
  onHover:     (id: string | null) => void;
}

/**
 * Rendu de tous les nœuds via <Instances> (@react-three/drei).
 * Chaque nœud est une <Instance> — une seule draw call au total.
 * Le bloom est géré par le parent via selectiveBloom layer.
 */
export function GraphNodes({
  nodes, maxVolume, selectedId, hoveredId, onSelect, onHover,
}: GraphNodesProps) {
  return (
    <Instances limit={500} castShadow={false} receiveShadow={false}>
      <sphereGeometry args={[1, 24, 16]} />
      <meshPhysicalMaterial
        roughness={0.2}
        metalness={0.6}
        envMapIntensity={1.2}
      />
      {nodes.map((node) => (
        <NodeInstance
          key={node.id}
          node={node}
          maxVolume={maxVolume}
          isSelected={node.id === selectedId}
          isHovered={node.id === hoveredId}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </Instances>
  );
}

interface NodeInstanceProps {
  node:        SimNode;
  maxVolume:   number;
  isSelected:  boolean;
  isHovered:   boolean;
  onSelect:    (id: string) => void;
  onHover:     (id: string | null) => void;
}

function NodeInstance({
  node, maxVolume, isSelected, isHovered, onSelect, onHover,
}: NodeInstanceProps) {
  const ref = useRef<THREE.Group>(null!);
  const r   = nodeRadius(node.volume, maxVolume);

  const color = useMemo(() => {
    if (isSelected) return new THREE.Color(PALETTE.selected);
    if (isHovered)  return new THREE.Color(nodeColor(node.type)).multiplyScalar(1.5);
    return new THREE.Color(nodeColor(node.type));
  }, [isSelected, isHovered, node.type]);

  // Pulsation douce sur les nœuds smart money ou sélectionnés
  useFrame((_, delta) => {
    if (!ref.current) return;
    if (node.isSmartMoney || isSelected) {
      const t   = Date.now() * 0.002;
      const pulse = 1 + Math.sin(t + node.id.charCodeAt(2)) * 0.08;
      ref.current.scale.setScalar(r * pulse);
    } else if (isHovered) {
      const current = ref.current.scale.x;
      const target  = r * 1.25;
      ref.current.scale.setScalar(current + (target - current) * 0.15);
    } else {
      const current = ref.current.scale.x;
      ref.current.scale.setScalar(current + (r - current) * 0.1);
    }
  });

  return (
    <group ref={ref} position={[node.x, node.y, node.z]}>
      <Instance
        color={color}
        scale={r}
        // Layer 1 = bloom layer pour les nœuds importants
        layers={node.isSmartMoney || isSelected ? 1 : 0}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(node.id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "default";
        }}
      />
      {/* Anneau de sélection */}
      {isSelected && (
        <SelectionRing radius={r} />
      )}
    </group>
  );
}

function SelectionRing({ radius }: { radius: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (ref.current) ref.current.rotation.z += 0.01;
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius * 1.4, 0.04, 8, 64]} />
      <meshBasicMaterial color={PALETTE.selected} transparent opacity={0.8} />
    </mesh>
  );
}
