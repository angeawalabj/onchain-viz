/**
 * ENS Resolution via viem + Ethereum mainnet public RPC.
 * Pas de clé API requise — utilise des providers publics avec fallback.
 *
 * Usage :
 *   const addr = await resolveAddress("vitalik.eth");
 *   // → "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
 *
 *   const addr = await resolveAddress("0xd8da6bf26...");
 *   // → "0xd8da6bf26..." (retourné tel quel si déjà une adresse)
 */

import { createPublicClient, http, isAddress } from "viem";
import { mainnet } from "viem/chains";

// Pool de RPCs publics Ethereum mainnet — essayés dans l'ordre
const PUBLIC_RPCS = [
  "https://ethereum.publicnode.com",
  "https://rpc.ankr.com/eth",
  "https://eth.llamarpc.com",
  "https://cloudflare-eth.com",
] as const;

let clientIndex = 0;

function getClient() {
  return createPublicClient({
    chain:     mainnet,
    transport: http(PUBLIC_RPCS[clientIndex % PUBLIC_RPCS.length], {
      timeout:    8000,
      retryCount: 2,
    }),
  });
}

// Cache en mémoire — évite de re-résoudre les mêmes noms
const ensCache = new Map<string, string>();

/**
 * Résout un nom ENS ou retourne l'adresse telle quelle si déjà valide.
 * @throws Error si le nom ENS ne peut pas être résolu
 */
export async function resolveAddress(input: string): Promise<string> {
  const trimmed = input.trim().toLowerCase();

  // Déjà une adresse Ethereum valide
  if (isAddress(trimmed)) return trimmed;
  if (isAddress(input.trim())) return input.trim();

  // Pas un nom ENS
  if (!trimmed.includes(".")) {
    throw new Error(`"${input}" n'est ni une adresse Ethereum ni un nom ENS`);
  }

  // Cache hit
  if (ensCache.has(trimmed)) return ensCache.get(trimmed)!;

  // Essaie chaque RPC en cas d'échec
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < PUBLIC_RPCS.length; attempt++) {
    clientIndex = attempt;
    try {
      const client  = getClient();
      const address = await client.getEnsAddress({ name: trimmed });

      if (!address) {
        throw new Error(`Nom ENS "${input}" introuvable — aucune adresse enregistrée`);
      }

      ensCache.set(trimmed, address);
      return address;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Essaie le prochain RPC
    }
  }

  throw lastError ?? new Error(`Impossible de résoudre "${input}"`);
}

/**
 * Résolution inverse : adresse → nom ENS (best-effort, pas critique).
 * Retourne null si pas de nom ENS associé.
 */
export async function lookupEns(address: string): Promise<string | null> {
  try {
    const client = getClient();
    const name   = await client.getEnsName({ address: address as `0x${string}` });
    return name ?? null;
  } catch {
    return null;
  }
}
