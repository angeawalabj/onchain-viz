"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVizStore } from "../lib/store";
import { timeRange } from "../lib/replay";
import type { SimLink } from "../lib/useForceGraph";

const PLAY_DURATION_MS = 12_000;   // durée d'une lecture complète, quelle que soit la période

function formatDate(t: number): string {
  return new Date(t * 1000).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Barre de rejeu : rejoue l'apparition des transferts entre la première et la
 * dernière date du graphe. Ne pilote que `replayTime` du store ; le filtrage
 * est fait par la page sur la disposition déjà calculée.
 */
export function Timeline({ links }: { links: SimLink[] }) {
  const replayTime    = useVizStore((s) => s.replayTime);
  const setReplayTime = useVizStore((s) => s.setReplayTime);
  // Bornes en primitives : `links` change à chaque tick de la simulation,
  // les bornes non — les effets ne doivent dépendre que d'elles
  const computed = useMemo(() => timeRange(links), [links]);
  const min = computed?.min ?? 0;
  const max = computed?.max ?? 0;
  const hasRange = computed !== null;

  const [playing, setPlaying] = useState(false);
  const frame = useRef<number | null>(null);

  // Lecture : avance replayTime à vitesse constante jusqu'à la fin de la période
  useEffect(() => {
    if (!playing || !hasRange) return;
    const span  = max - min;
    const from  = replayTime !== null && replayTime < max ? replayTime : min;
    const start = performance.now() - ((from - min) / span) * PLAY_DURATION_MS;

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / PLAY_DURATION_MS);
      setReplayTime(min + progress * span);
      if (progress < 1) frame.current = requestAnimationFrame(step);
      else setPlaying(false);
    };
    frame.current = requestAnimationFrame(step);
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); };
    // replayTime volontairement absent : il est lu une fois au démarrage de la lecture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, hasRange, min, max, setReplayTime]);

  // Nouvelle période (nouveau graphe) → arrêt de la lecture
  useEffect(() => { setPlaying(false); }, [min, max]);

  if (!hasRange) return null;

  const value = replayTime ?? max;

  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-black/60 px-3 py-2 backdrop-blur-md">
      <button
        onClick={() => setPlaying((p) => !p)}
        title={playing ? "Pause" : "Rejouer les transferts dans le temps"}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-500/20 text-xs text-violet-300 transition-colors hover:bg-violet-500/30"
      >
        {playing ? "❚❚" : "▶"}
      </button>

      <input
        type="range"
        min={min}
        max={max}
        step={(max - min) / 500}
        value={value}
        onChange={(e) => { setPlaying(false); setReplayTime(Number(e.target.value)); }}
        aria-label="Instant du rejeu"
        className="h-1 flex-1 cursor-pointer accent-violet-400"
      />

      <span className="w-36 shrink-0 text-right text-xs font-mono text-white/55">
        {replayTime === null ? "Tout l'historique" : formatDate(value)}
      </span>

      <button
        onClick={() => { setPlaying(false); setReplayTime(null); }}
        disabled={replayTime === null}
        title="Afficher tout le graphe"
        className="shrink-0 rounded-md border border-white/8 px-2 py-1 text-xs font-mono text-white/40 transition-colors hover:text-white/70 disabled:opacity-30"
      >
        Tout
      </button>
    </div>
  );
}
