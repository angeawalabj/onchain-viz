/**
 * Adresse du compte de jetons associé (ATA) d'un wallet Solana, calculée
 * localement. Les jetons reçus arrivent sur ce compte, pas sur l'adresse du
 * wallet : sans lui, l'historique du wallet manque la plupart des réceptions.
 *
 * Le RPC public refuse getTokenAccountsByOwner (requête indexée, payante) ;
 * l'ATA étant une adresse dérivée (PDA) déterministe, on la calcule sans
 * aucune requête, en TypeScript pur (pas de dépendance @solana/web3.js) :
 *   ATA = PDA([wallet, TOKEN_PROGRAM, mint], ASSOCIATED_TOKEN_PROGRAM)
 */

const TOKEN_PROGRAM            = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

// ─── Base58 ───────────────────────────────────────────────────────────────────

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Decode(s: string): Uint8Array {
  let n = 0n;
  for (const ch of s) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error(`Caractère base58 invalide : "${ch}"`);
    n = n * 58n + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  let zeros = 0;
  while (s[zeros] === "1") zeros++;
  return Uint8Array.from([...new Array(zeros).fill(0), ...bytes]);
}

export function base58Encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) { out = ALPHABET[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; out = "1" + out; }
  return out;
}

// ─── SHA-256 (synchrone ; WebCrypto est asynchrone et absent de certains environnements de test) ──

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(data: Uint8Array): Uint8Array {
  const bitLen  = data.length * 8;
  const padded  = new Uint8Array(Math.ceil((data.length + 9) / 64) * 64);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 2 ** 32));
  view.setUint32(padded.length - 4, bitLen >>> 0);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  h.forEach((v, i) => outView.setUint32(i * 4, v));
  return out;
}

// ─── ed25519 : un point compressé est-il sur la courbe ? ─────────────────────

const P = 2n ** 255n - 19n;

function modPow(base: bigint, exp: bigint): bigint {
  let r = 1n, b = ((base % P) + P) % P;
  while (exp > 0n) {
    if (exp & 1n) r = (r * b) % P;
    b = (b * b) % P;
    exp >>= 1n;
  }
  return r;
}

const D = (-121665n * modPow(121666n, P - 2n)) % P;

/**
 * Vrai si les 32 octets se décompressent en un point d'ed25519 (comme
 * CompressedEdwardsY::decompress) : x² = (y² − 1) / (d·y² + 1) doit être un carré.
 */
export function isOnCurve(bytes: Uint8Array): boolean {
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(i === 31 ? bytes[i] & 0x7f : bytes[i]);
  y %= P;
  const y2 = (y * y) % P;
  const u  = (y2 - 1n + P) % P;
  const v  = (D * y2 + 1n) % P;
  const x2 = (u * modPow(v, P - 2n)) % P;
  return x2 === 0n || modPow(x2, (P - 1n) / 2n) === 1n;
}

// ─── Adresses dérivées ────────────────────────────────────────────────────────

const PDA_MARKER = new TextEncoder().encode("ProgramDerivedAddress");

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

/** findProgramAddress : premier bump (255 → 0) dont le hash n'est pas sur la courbe. */
export function findProgramAddress(seeds: Uint8Array[], programId: Uint8Array): Uint8Array {
  for (let bump = 255; bump >= 0; bump--) {
    const hash = sha256(concat([...seeds, Uint8Array.of(bump), programId, PDA_MARKER]));
    if (!isOnCurve(hash)) return hash;
  }
  throw new Error("Aucune adresse dérivée valide");
}

export function associatedTokenAddress(owner: string, mint: string): string {
  return base58Encode(findProgramAddress(
    [base58Decode(owner), base58Decode(TOKEN_PROGRAM), base58Decode(mint)],
    base58Decode(ASSOCIATED_TOKEN_PROGRAM)
  ));
}
