/**
 * Symmetric encryption for third-party credentials at rest.
 *
 * OAuth refresh tokens are not like the rest of this database. A transaction row
 * leaks one number; a Gmail refresh token leaks standing access to someone's
 * entire mailbox. RLS keeps other users out, but it does nothing against a
 * database dump, a leaked service-role key, or a SQL injection somewhere else in
 * the stack. So the ciphertext lives in Postgres and the key never does.
 *
 * AES-256-GCM: authenticated, so tampering with stored ciphertext fails loudly
 * rather than decrypting to garbage. A fresh 12-byte IV per encryption — GCM is
 * catastrophically broken by IV reuse, which is why one is never reused or
 * derived from the plaintext.
 *
 * Server-side only. Importing this from a client component would ship the key
 * to the browser, so every caller must be a route handler or server action.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function key(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY is not set. Generate one with: " +
        "openssl rand -base64 32"
    );
  }

  const parsed = Buffer.from(raw, "base64");
  if (parsed.length !== 32) {
    throw new Error(
      `INTEGRATION_ENCRYPTION_KEY must decode to 32 bytes, got ${parsed.length}. ` +
        "Generate one with: openssl rand -base64 32"
    );
  }

  return parsed;
}

/** Returns `iv.tag.ciphertext`, each base64. Opaque to callers and to Postgres. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [iv, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString("base64"))
    .join(".");
}

/** Throws if the payload was tampered with, truncated, or encrypted under another key. */
export function decrypt(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed ciphertext: expected iv.tag.ciphertext");
  }

  const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, "base64"));

  const decipher = createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
