import { describe, it, expect } from "vitest";
import {
  base58Decode, base58Encode, sha256, isOnCurve, associatedTokenAddress,
} from "../lib/adapters/solana-ata";
import { mergeSignatures } from "../lib/adapters/solana";

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

describe("sha256", () => {
  it("vecteurs de référence (FIPS 180-2)", () => {
    expect(hex(sha256(new Uint8Array()))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(hex(sha256(new TextEncoder().encode("abc")))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("message de plusieurs blocs", () => {
    const msg = new TextEncoder().encode("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq");
    expect(hex(sha256(msg))).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });
});

describe("base58", () => {
  it("aller-retour d'une adresse Solana (32 octets)", () => {
    const addr = "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS";
    expect(base58Decode(addr)).toHaveLength(32);
    expect(base58Encode(base58Decode(addr))).toBe(addr);
  });

  it("les '1' de tête sont des octets nuls", () => {
    const sys = "11111111111111111111111111111111";
    expect(Array.from(base58Decode(sys))).toEqual(new Array(32).fill(0));
    expect(base58Encode(new Uint8Array(32))).toBe(sys);
  });

  it("rejette les caractères hors alphabet", () => {
    expect(() => base58Decode("0OIl")).toThrow();
  });
});

describe("isOnCurve", () => {
  it("une clé publique de wallet est sur la courbe", () => {
    expect(isOnCurve(base58Decode("H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS"))).toBe(true);
  });

  it("une adresse dérivée (ATA) ne l'est pas", () => {
    expect(isOnCurve(base58Decode("7dQmths1cyCQ4xaC5KcVfXz4BvVWtnHc3hcgnfnE1PBx"))).toBe(false);
  });
});

describe("associatedTokenAddress", () => {
  // Valeurs vérifiées sur mainnet : getAccountInfo renvoie bien owner + mint attendus
  it.each([
    ["H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS", USDC, "7dQmths1cyCQ4xaC5KcVfXz4BvVWtnHc3hcgnfnE1PBx"],
    ["5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9", USDT, "CyBjGpte4Npi5zNkdtWumPxVW4kpMR8BuFSbA587xZES"],
    ["4MRUK7wYQ5QkvYkVDdMffyaURLQijAogViCQUmwrqaxJ", USDC, "2JC8VUveVDCqVdHP7vNocN7xgUNX549y8wGtVdfE74LH"],
  ])("%s / %s → %s", (owner, mint, expected) => {
    expect(associatedTokenAddress(owner, mint)).toBe(expected);
  });
});

describe("mergeSignatures", () => {
  it("dédoublonne, ignore les échecs, trie du plus récent au plus ancien, plafonne", () => {
    const wallet = [
      { signature: "a", err: null, blockTime: 100 },
      { signature: "b", err: { x: 1 }, blockTime: 300 },
    ];
    const ata = [
      { signature: "c", err: null, blockTime: 200 },
      { signature: "a", err: null, blockTime: 100 },
      { signature: "d", err: null, blockTime: 50 },
    ];
    expect(mergeSignatures([wallet, ata], 10)).toEqual(["c", "a", "d"]);
    expect(mergeSignatures([wallet, ata], 2)).toEqual(["c", "a"]);
  });
});
