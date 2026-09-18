"use client";

import { Billboard, Text } from "@react-three/drei";
import type { SimNode } from "../lib/useForceGraph";
import { nodeRadius, PALETTE } from "../lib/types";

interface NodeLabelsProps {
  nodes:       SimNode[];
  maxVolume:   number;
  selectedId:  string | null;
  hoveredId:   string | null;
}

/**
 * Labels 3D qui font toujours face à la caméra (Billboard).
 * Affichés uniquement pour :
 * - Le nœud sélectionné
 * - Le nœud survolé
 * - Les nœuds focaux (isFocused)
 * - Les nœuds "smart money"
 * - Les 5 plus gros nœuds par volume
 *
 * Performance : Text de drei utilise troika-three-text (SDF rendering),
 * beaucoup plus rapide qu'un canvas texture par nœud.
 */
export function NodeLabels({
  nodes, maxVolume, selectedId, hoveredId,
}: NodeLabelsProps) {
  // Top 5 nœuds par volume
  const top5Ids = new Set(
    [...nodes]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5)
      .map((n) => n.id)
  );

  const visible = nodes.filter(
    (n) =>
      n.id === selectedId ||
      n.id === hoveredId  ||
      n.isFocused         ||
      n.isSmartMoney      ||
      top5Ids.has(n.id)
  );

  return (
    <>
      {visible.map((node) => {
        const r      = nodeRadius(node.volume, maxVolume);
        const isMain = node.id === selectedId || node.isFocused;

        return (
          <Billboard
            key={node.id}
            position={[node.x, node.y + r + 0.45, node.z]}
            follow
            lockX={false}
            lockY={false}
            lockZ={false}
          >
            <Text
              fontSize={isMain ? 0.55 : 0.38}
              color={isMain ? PALETTE.text : PALETTE.textMuted}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.04}
              outlineColor="#060610"
              renderOrder={10}
            >
              {node.label}
            </Text>

            {/* Volume sous le label pour les nœuds sélectionnés */}
            {node.id === selectedId && (
              <Text
                position={[0, -0.55, 0]}
                fontSize={0.32}
                color={PALETTE.accent}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.03}
                outlineColor="#060610"
                renderOrder={10}
              >
                {formatVol(node.volume)} · {node.txCount} tx
              </Text>
            )}
          </Billboard>
        );
      })}
    </>
  );
}

function formatVol(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}
