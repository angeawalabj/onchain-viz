/**
 * Prix USD des jetons natifs via CoinGecko (gratuit, sans clé, CORS ouvert).
 * Cache mémoire 5 min ; fallback sur un prix fixe si l'API est indisponible.
 */

import type { Chain } from "./types";
import { CHAINS } from "./chains";

const TTL_MS = 5 * 60 * 1000;
const cache  = new Map<Chain, { price: number; at: number }>();

export async function getUsdPrice(chain: Chain): Promise<number> {
  const hit = cache.get(chain);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.price;

  const { coingeckoId, fallbackPriceUSD } = CHAINS[chain];
  try {
    const res  = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`
    );
    const data = await res.json();
    const price = Number(data?.[coingeckoId]?.usd);
    if (!Number.isFinite(price) || price <= 0) throw new Error("prix invalide");
    cache.set(chain, { price, at: Date.now() });
    return price;
  } catch {
    return fallbackPriceUSD;
  }
}
