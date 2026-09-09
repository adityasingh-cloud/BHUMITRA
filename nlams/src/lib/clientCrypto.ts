/**
 * Client-Side Web Crypto & Canonical Serialization Engine.
 * Implements deterministic SHA-256 digests and block verification directly in the browser
 * using the standard W3C Web Cryptography API (crypto.subtle).
 */

/**
 * Deterministically serializes any JavaScript object, array, or primitive
 * by recursively sorting object keys lexicographically.
 * Matches Node.js canonicalJsonStringify byte-for-byte.
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
 * Computes a standard 64-character lowercase hexadecimal SHA-256 digest
 * from UTF-8 text using crypto.subtle.digest.
 */
export async function computeTextSha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Computes a standard 64-character lowercase hexadecimal SHA-256 digest
 * directly from raw file or blob bytes using crypto.subtle.digest.
 */
export async function computeFileSha256(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Computes a SHA-256 digest of an arbitrary payload using canonical JSON serialization.
 */
export async function computePayloadSha256(payload: unknown): Promise<string> {
  const canonical = canonicalJsonStringify(payload ?? {});
  return computeTextSha256(canonical);
}

export interface ClientBlockVerificationResult {
  matches: boolean;
  recomputedHash: string;
  expectedHash: string;
  formulaString: string;
  payloadString: string;
}

/**
 * Recomputes the block hash from constituent parts in the browser and compares against block.chainHash.
 *
 * Formula: chainHash = SHA-256(previousHash : proposalId : action : eventPayloadHash : fileHash)
 */
export async function verifyBlockClientSide(block: {
  chainHash: string | null;
  previousHash: string | null;
  proposalId: string;
  action: string;
  eventPayloadHash: string | null;
  fileHash?: string | null;
  metadata?: unknown;
}): Promise<ClientBlockVerificationResult> {
  const previousHash = block.previousHash ?? "0".repeat(64);
  const proposalId = block.proposalId;
  const action = block.action;
  const fileHash = block.fileHash ?? "";

  // If eventPayloadHash is provided, use it; otherwise compute from metadata
  let eventPayloadHash = block.eventPayloadHash;
  if (!eventPayloadHash) {
    eventPayloadHash = await computePayloadSha256(block.metadata ?? {});
  }

  const formulaString = `${previousHash}:${proposalId}:${action}:${eventPayloadHash}:${fileHash}`;
  const recomputedHash = await computeTextSha256(formulaString);

  return {
    matches: recomputedHash === block.chainHash,
    recomputedHash,
    expectedHash: block.chainHash ?? "",
    formulaString,
    payloadString: canonicalJsonStringify(block.metadata ?? {}),
  };
}

