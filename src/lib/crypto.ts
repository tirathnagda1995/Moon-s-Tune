import type { Cipher } from "./domain";
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (text: string) =>
  Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
async function key(passphrase: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encrypt(
  text: string,
  passphrase: string,
  observationId: string,
): Promise<Cipher> {
  if (passphrase.length < 12) throw new Error("PASSPHRASE_SHORT");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(observationId),
    },
    await key(passphrase, salt),
    new TextEncoder().encode(text),
  );
  return {
    version: 1,
    salt: encode(salt),
    iv: encode(iv),
    data: encode(new Uint8Array(data)),
  };
}
export async function decrypt(
  cipher: Cipher,
  passphrase: string,
  observationId: string,
): Promise<string> {
  const data = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decode(cipher.iv),
      additionalData: new TextEncoder().encode(observationId),
    },
    await key(passphrase, decode(cipher.salt)),
    decode(cipher.data),
  );
  return new TextDecoder().decode(data);
}
