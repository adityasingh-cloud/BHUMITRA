import crypto from "node:crypto";

/** First block in the chain has no predecessor — matches Bhumitra's genesis hash (64 zeros). */
export const GENESIS_HASH = "0".repeat(64);

/**
 * Deterministically serializes any JavaScript object, array, or primitive
 * by recursively sorting object keys lexicographically.
 * Ensures identical cryptographic digests across Node.js and browser environments.
 */
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    if (typeof obj === "undefined" || typeof obj === "symbol") {
      return "null";
    }
    return JSON.stringify(obj);
  }

  if (obj instanceof Date) {
    return JSON.stringify(obj.toISOString());
  }

  if (Array.isArray(obj)) {
    const items = obj.map((item) => {
      if (typeof item === "undefined" || typeof item === "symbol" || typeof item === "function") {
        return "null";
      }
      return canonicalJsonStringify(item);
    });
    return `[${items.join(",")}]`;
  }

  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs: string[] = [];
  for (const key of sortedKeys) {
    const val = (obj as Record<string, unknown>)[key];
    if (typeof val === "undefined" || typeof val === "function" || typeof val === "symbol") {
      continue;
    }
    pairs.push(`${JSON.stringify(key)}:${canonicalJsonStringify(val)}`);
  }
  return `{${pairs.join(",")}}`;
}

/**
 * Computes a standard hex SHA-256 hash using Node.js crypto.
 * When passed an object, it serializes with canonicalJsonStringify for key-order invariance.
 */
export function computeHash(data: Buffer | string | unknown): string {
  const hash = crypto.createHash("sha256");
  if (Buffer.isBuffer(data)) {
    hash.update(data);
  } else if (typeof data === "string") {
    hash.update(data, "utf8");
  } else {
    hash.update(canonicalJsonStringify(data), "utf8");
  }
  return hash.digest("hex");
}

