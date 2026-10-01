/**
 * "Suivre l'argent" : déplier un nœud ajoute ses propres contreparties au
 * graphe courant, sans perdre ce qui est déjà affiché.
 */

import type { Chain, GraphData, GraphLink, GraphNode, ViewMode } from "./types";
import { CHAINS } from "./chains";

function linkId(l: GraphLink): string {
  const src = typeof l.source === "string" ? l.source : l.source.id;
  const tgt = typeof l.target === "string" ? l.target : l.target.id;
  return `${src}→${tgt}`;
}

/**
 * Fusionne le graphe du nœud déplié dans le graphe courant.
 * - Le focal d'origine reste le seul nœud `isFocused`.
 * - Un nœud ou lien déjà présent garde ses données, avec le max des volumes :
 *   le lien focal ↔ nœud déplié est vu des deux côtés, il ne faut pas le doubler.
 */
export function mergeExpansion(base: GraphData, addition: GraphData, expandedId: string): GraphData {
  const nodes = new Map<string, GraphNode>(base.nodes.map((n) => [n.id, { ...n }]));
  for (const n of addition.nodes) {
    const existing = nodes.get(n.id);
    if (existing) {
      existing.volume  = Math.max(existing.volume, n.volume);
      existing.txCount = Math.max(existing.txCount, n.txCount);
    } else {
      nodes.set(n.id, { ...n, isFocused: false });
    }
  }
  const expanded = nodes.get(expandedId);
  if (expanded) expanded.expanded = true;

  const links = new Map<string, GraphLink>(base.links.map((l) => [linkId(l), { ...l }]));
  for (const l of addition.links) {
    const key      = linkId(l);
    const existing = links.get(key);
    if (existing) {
      existing.volume  = Math.max(existing.volume, l.volume);
      existing.txCount = Math.max(existing.txCount, l.txCount);
      existing.assets  = Array.from(new Set([...(existing.assets ?? []), ...(l.assets ?? [])]));
    } else {
      links.set(key, { ...l });
    }
  }

  return {
    ...base,
    nodes:     Array.from(nodes.values()),
    links:     Array.from(links.values()),
    fetchedAt: Date.now(),
  };
}

export type ExpandBlocker = "demo" | "mode" | "address" | "expanded" | null;

/** Pourquoi un nœud ne peut pas être déplié (null = il peut). */
export function expandBlocker(
  node: Pick<GraphNode, "id" | "expanded" | "isFocused">,
  graph: Pick<GraphData, "isDemo"> | null,
  chain: Chain,
  mode: ViewMode
): ExpandBlocker {
  if (!graph || graph.isDemo) return "demo";
  if (mode !== "wallet")      return "mode";
  if (node.isFocused || node.expanded) return "expanded";
  // Exclut les nœuds "bundle" du clustering et tout identifiant non natif
  if (!CHAINS[chain].isValidAddress(node.id)) return "address";
  return null;
}

export const EXPAND_BLOCKER_LABEL: Record<Exclude<ExpandBlocker, null>, string> = {
  demo:     "Indisponible sur les données de démo",
  mode:     "Disponible en mode Wallet Graph",
  address:  "Nœud agrégé : pas d'adresse à explorer",
  expanded: "Transactions déjà affichées",
};
