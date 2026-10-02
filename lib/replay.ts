/**
 * Rejeu dans le temps : on garde la disposition calculée sur le graphe complet
 * et on n'affiche, à l'instant t, que les liens déjà actifs (volume cumulé
 * jusqu'à t). Aucune simulation n'est relancée pendant la lecture.
 */

import type { GraphLink, LinkEvent } from "./types";

/** Événements datés d'un lien ; un lien sans détail = un seul événement. */
export function linkEvents(l: Pick<GraphLink, "events" | "timestamp" | "volume" | "txCount">): LinkEvent[] {
  return l.events?.length ? l.events : [{ t: l.timestamp, usd: l.volume }];
}

/** Bornes temporelles des liens, ou null s'il n'y a pas au moins deux instants distincts. */
export function timeRange(links: Pick<GraphLink, "events" | "timestamp" | "volume" | "txCount">[]): { min: number; max: number } | null {
  let min = Infinity, max = -Infinity;
  for (const l of links) {
    for (const e of linkEvents(l)) {
      if (e.t < min) min = e.t;
      if (e.t > max) max = e.t;
    }
  }
  return Number.isFinite(min) && max > min ? { min, max } : null;
}

interface ReplayNode { id: string; isFocused: boolean }
interface ReplayLink {
  source: { id: string } | string;
  target: { id: string } | string;
  volume: number; txCount: number; timestamp: number; events?: LinkEvent[];
}

const endpointId = (e: { id: string } | string) => (typeof e === "string" ? e : e.id);

/**
 * Sous-graphe visible à l'instant t (null = tout). Les nœuds gardent leur
 * objet d'origine (et donc leur position) ; les liens sont copiés avec le
 * volume et le nombre de transactions cumulés jusqu'à t.
 */
export function filterAtTime<N extends ReplayNode, L extends ReplayLink>(
  nodes: N[],
  links: L[],
  t: number | null
): { nodes: N[]; links: L[] } {
  if (t === null) return { nodes, links };

  const visibleLinks: L[] = [];
  const ids = new Set(nodes.filter((n) => n.isFocused).map((n) => n.id));

  for (const l of links) {
    const past = linkEvents(l).filter((e) => e.t <= t);
    if (past.length === 0) continue;
    visibleLinks.push({
      ...l,
      volume:  past.reduce((s, e) => s + e.usd, 0),
      txCount: l.events?.length ? past.length : l.txCount,
    });
    ids.add(endpointId(l.source));
    ids.add(endpointId(l.target));
  }

  return { nodes: nodes.filter((n) => ids.has(n.id)), links: visibleLinks };
}
