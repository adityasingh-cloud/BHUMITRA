import crypto from "crypto";
import { Prisma, type AuditAction, type RfctlarrStage } from "@prisma/client";
import { prisma } from "../db.js";
import { canonicalJsonStringify, computeHash, GENESIS_HASH } from "./canonicalJson.js";

/** First block in the chain has no predecessor — matches Bhumitra's genesis hash. */
const GENESIS_HASH = "0".repeat(64);
export { canonicalJsonStringify, computeHash, GENESIS_HASH };

type Db = Prisma.TransactionClient | typeof prisma;

export function computeHash(data: Buffer | string | Record<string, unknown>): string {
  const hash = crypto.createHash("sha256");
  if (Buffer.isBuffer(data)) hash.update(data);
  else if (typeof data === "object") hash.update(JSON.stringify(data));
  else hash.update(String(data));
  return hash.digest("hex");
}

/**
 * Cryptographic Audit Vault — ported from Bhumitra's audit_vault.service.js.
 * Every entry chains onto the previous one's `chainHash`, so the whole
 * `audit_logs` table forms a single tamper-evident, append-only ledger
 * (not just per-proposal). Pass the active transaction client (`tx`) when
 * called from inside a `prisma.$transaction(async (tx) => ...)` block so the
 * chain lookup + insert stay atomic with whatever else that transaction does.
 * Cryptographic Audit Vault.
 * Every entry chains onto the previous entry's `chainHash` so the whole
 * `audit_logs` table forms a single tamper-evident, append-only blockchain ledger.
 *
 * Formula: chainHash_n = SHA-256(previousHash_{n-1} : proposalId : action : eventPayloadHash : fileHash)
 */
export async function addAuditEntry(
  db: Db,
  params: {
    proposalId: string;
    userId?: string | null;
    action: AuditAction;
    fromStage?: RfctlarrStage | null;
    toStage?: RfctlarrStage | null;
    fileBuffer?: Buffer | null;
    eventPayload?: Record<string, unknown>;
    createdAt?: Date;
  },
) {
  const lastEntry = await db.auditLog.findFirst({ orderBy: { createdAt: "desc" } });
  const lastEntry = await db.auditLog.findFirst({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  const previousHash = lastEntry?.chainHash ?? GENESIS_HASH;

  const fileHash = params.fileBuffer ? computeHash(params.fileBuffer) : null;
  const eventPayloadHash = computeHash(params.eventPayload ?? {});
  const chainHash = computeHash(
    `${previousHash}:${params.proposalId}:${params.action}:${eventPayloadHash}:${fileHash ?? ""}`,
  );

  return db.auditLog.create({
    data: {
      proposalId: params.proposalId,
      userId: params.userId ?? null,
      action: params.action,
      fromStage: params.fromStage ?? null,
      toStage: params.toStage ?? null,
      metadata: (params.eventPayload as Prisma.InputJsonValue | undefined) ?? undefined,
      fileHash,
      eventPayloadHash,
      previousHash,
      chainHash,
      ...(params.createdAt ? { createdAt: params.createdAt } : {}),
    },
  });
}

export interface ChainVerification {
  chainIntact: boolean;
  totalRecords: number;
  verifiedBlocks: number;
  genesisHash: string;
  headHash: string;
  brokenRecordId?: string;
  brokenAtIndex?: number;
  reason?: string;
}

/** Walks the full audit_logs table in insertion order and recomputes every hash. */
/**
 * Walks the full audit_logs table in chronological insertion order and recomputes every hash.
 * Verifies both block linkage (previousHash chain) and block content integrity.
 */
export async function verifyChainIntegrity(): Promise<ChainVerification> {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } });
  const logs = await prisma.auditLog.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  if (logs.length === 0) {
    return { chainIntact: true, totalRecords: 0 };
    return {
      chainIntact: true,
      totalRecords: 0,
      verifiedBlocks: 0,
      genesisHash: GENESIS_HASH,
      headHash: GENESIS_HASH,
    };
  }

  let expectedPrevious = GENESIS_HASH;
  let verifiedBlocks = 0;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]!;
    // Entries written before the Audit Vault existed have no hash fields —
    // they can't be verified, but they also can't break the chain: skip them
    // without advancing `expectedPrevious`.
    if (log.chainHash == null) continue;

    // 1. Verify parent hash linkage
    if (log.previousHash !== expectedPrevious) {
      return {
        chainIntact: false,
        totalRecords: logs.length,
        verifiedBlocks,
        genesisHash: GENESIS_HASH,
        headHash: logs[logs.length - 1]?.chainHash ?? GENESIS_HASH,
        brokenAtIndex: i,
        brokenRecordId: log.id,
        reason: "Stored previousHash does not match the prior record's chainHash.",
        reason: `Broken chain link at block height ${i + 1}: stored previousHash does not match prior block's chainHash.`,
      };
    }

    // 2. Verify payload hash from metadata
    const payloadHashFromMetadata = computeHash(log.metadata ?? {});
    if (log.eventPayloadHash && log.eventPayloadHash !== payloadHashFromMetadata) {
      return {
        chainIntact: false,
        totalRecords: logs.length,
        verifiedBlocks,
        genesisHash: GENESIS_HASH,
        headHash: logs[logs.length - 1]?.chainHash ?? GENESIS_HASH,
        brokenAtIndex: i,
        brokenRecordId: log.id,
        reason: `Payload tamper detected at block height ${i + 1}: stored eventPayloadHash does not match canonical payload hash.`,
      };
    }

    // 3. Recompute and verify block chainHash
    const recomputed = computeHash(
      `${log.previousHash}:${log.proposalId}:${log.action}:${log.eventPayloadHash}:${log.fileHash ?? ""}`,
    );
    if (recomputed !== log.chainHash) {
      return {
        chainIntact: false,
        totalRecords: logs.length,
        verifiedBlocks,
        genesisHash: GENESIS_HASH,
        headHash: logs[logs.length - 1]?.chainHash ?? GENESIS_HASH,
        brokenAtIndex: i,
        brokenRecordId: log.id,
        reason: "Chain hash mismatch — record was tampered with.",
        reason: `Cryptographic hash mismatch at block height ${i + 1}: recomputed chain hash does not match stored chainHash.`,
      };
    }

    expectedPrevious = log.chainHash;
    verifiedBlocks++;
  }

  return { chainIntact: true, totalRecords: logs.length };
  return {
    chainIntact: true,
    totalRecords: logs.length,
    verifiedBlocks,
    genesisHash: GENESIS_HASH,
    headHash: logs[logs.length - 1]?.chainHash ?? GENESIS_HASH,
  };
}
