/**
 * Prix USD des actifs suivis via CoinGecko (gratuit, sans clé, CORS ouvert).
 * Une seule requête par chaîne pour le natif + les jetons du registre.
 * Cache mémoire 5 min ; stablecoins à prix fixe ; fallback natif si l'API tombe.
 */

import type { Chain } from "./types";
import { CHAINS } from "./chains";
import { NATIVE, TOKENS } from "./tokens";

const TTL_MS = 5 * 60 * 1000;
const cache  = new Map<string, { price: number; at: number }>();   // clé : coingeckoId

/** Prix USD par clé d'actif (NATIVE ou identifiant du registre). */
export async function getAssetPrices(chain: Chain): Promise<Record<string, number>> {
  const assets: [string, { coingeckoId?: string; usd?: number }][] = [
    [NATIVE, { coingeckoId: CHAINS[chain].coingeckoId }],
    ...Object.entries(TOKENS[chain]),
  ];

  const ids     = Array.from(new Set(assets.map(([, t]) => t.coingeckoId).filter((id): id is string => !!id)));
  const missing = ids.filter((id) => {
    const hit = cache.get(id);
    return !hit || Date.now() - hit.at >= TTL_MS;
  });

  if (missing.length > 0) {
    try {
      const res  = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${missing.join(",")}&vs_currencies=usd`
      );
      const data = await res.json();
      for (const id of missing) {
        const price = Number(data?.[id]?.usd);
        if (Number.isFinite(price) && price > 0) cache.set(id, { price, at: Date.now() });
      }
    } catch {
      // API indisponible : on garde le cache éventuel + fallbacks ci-dessous
    }
  }

  const prices: Record<string, number> = {};
  for (const [asset, t] of assets) {
    const price = t.usd ?? (t.coingeckoId ? cache.get(t.coingeckoId)?.price : undefined);
    if (price !== undefined) prices[asset] = price;
  }
  prices[NATIVE] ??= CHAINS[chain].fallbackPriceUSD;
  return prices;
}
