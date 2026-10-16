/**
 * Local Trust Shield display-password credential.
 * The password is not a wallet password or encryption key and cannot hide
 * on-chain transactions. This stores only a salted PBKDF2 verifier.
 *
 * Compatibility: existing plaintext credentials are accepted ONE time, then
 * re-hashed and deleted on successful verification.
 */
const V2_KEY = "hidedex_privacy_password_v2";
const LEGACY_KEY = "privacyPasswordHash";
const ITERATIONS = 180_000;

function bytesToBase64(data: Uint8Array): string {
  let text = "";
  for (const value of data) text += String.fromCharCode(value);
  return btoa(text);
}

function base64ToBytes(text: string): Uint8Array {
  const raw = atob(text);
  return Uint8Array.from(raw, ch => ch.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  if (!window.crypto?.subtle) throw new Error("Secure password storage requires HTTPS/WebCrypto.");
  const key = await window.crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const derived = await window.crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(salt), iterations },
    key,
    256,
  );
  return new Uint8Array(derived);
}

export function hasPrivacyPassword(): boolean {
  if (typeof window === "undefined") return false;
  return !!(localStorage.getItem(V2_KEY) || localStorage.getItem(LEGACY_KEY));
}

export async function setPrivacyPassword(password: string): Promise<void> {
  if (password.length < 8) throw new Error("Use at least 8 characters for a new privacy password.");
  if (!window.crypto?.getRandomValues) throw new Error("Secure random generator unavailable.");
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  localStorage.setItem(V2_KEY, ["v2", ITERATIONS, bytesToBase64(salt), bytesToBase64(hash)].join(":"));
  localStorage.removeItem(LEGACY_KEY);
}

export async function verifyPrivacyPassword(password: string): Promise<boolean> {
  if (typeof window === "undefined" || !password) return false;
  const stored = localStorage.getItem(V2_KEY);
  if (stored) {
    const fields = stored.split(":");
    if (fields.length !== 4 || fields[0] !== "v2") return false;
    const iterations = Number(fields[1]);
    if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;
    try {
      const original = base64ToBytes(fields[3]);
      const calculated = await derive(password, base64ToBytes(fields[2]), iterations);
      if (original.length !== calculated.length) return false;
      let diff = 0;
      for (let i = 0; i < original.length; i++) diff |= original[i] ^ calculated[i];
      return diff === 0;
    } catch {
      return false;
    }
  }

  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy === null || password !== legacy) return false;
  // Legacy short passwords are kept only through their first successful
  // verification; write their salted hash without imposing a new length limit.
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  localStorage.setItem(V2_KEY, ["v2", ITERATIONS, bytesToBase64(salt), bytesToBase64(hash)].join(":"));
  localStorage.removeItem(LEGACY_KEY);
  return true;
}

export function clearPrivacyPassword(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(V2_KEY);
  localStorage.removeItem(LEGACY_KEY);
}
