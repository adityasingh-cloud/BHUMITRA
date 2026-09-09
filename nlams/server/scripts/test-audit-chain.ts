import assert from "node:assert/strict";
import crypto from "node:crypto";
import { canonicalJsonStringify, computeHash, GENESIS_HASH } from "../src/lib/canonicalJson.ts";

interface InMemoryAuditBlock {
  id: string;
  proposalId: string;
  action: string;
  metadata: Record<string, unknown>;
  fileHash: string | null;
  eventPayloadHash: string;
  previousHash: string;
  chainHash: string;
}

function verifyInMemoryChain(blocks: InMemoryAuditBlock[]) {
  let expectedPrevious = GENESIS_HASH;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;

    // 1. Parent pointer
    if (block.previousHash !== expectedPrevious) {
      return {
        chainIntact: false,
        brokenAtIndex: i,
        blockHeight: i + 1,
        brokenRecordId: block.id,
        reason: `Broken chain link at block height ${i + 1}: stored previousHash does not match prior block's chainHash.`,
      };
    }

    // 2. Payload integrity
    const payloadHash = computeHash(block.metadata);
    if (block.eventPayloadHash !== payloadHash) {
      return {
        chainIntact: false,
        brokenAtIndex: i,
        blockHeight: i + 1,
        brokenRecordId: block.id,
        reason: `Payload tamper detected at block height ${i + 1}: stored eventPayloadHash does not match canonical payload hash.`,
      };
    }

    // 3. Block chain hash
    const recomputed = computeHash(
      `${block.previousHash}:${block.proposalId}:${block.action}:${block.eventPayloadHash}:${block.fileHash ?? ""}`,
    );
    if (recomputed !== block.chainHash) {
      return {
        chainIntact: false,
        brokenAtIndex: i,
        blockHeight: i + 1,
        brokenRecordId: block.id,
        reason: `Cryptographic hash mismatch at block height ${i + 1}: recomputed chain hash does not match stored chainHash.`,
      };
    }

    expectedPrevious = block.chainHash;
  }

  return { chainIntact: true, totalRecords: blocks.length, verifiedBlocks: blocks.length };
}

async function runTests() {
  console.log("===============================================================================");
  console.log("NLAMS Cryptographic Vault & Blockchain Chain Verification Test Suite");
  console.log("===============================================================================\n");

  // TEST 1: Key-Order Invariance in Canonical JSON Serialization
  console.log("TEST 1: Canonical JSON key-order invariance...");
  const objA = { z: 99, a: 1, nested: { y: "second", x: "first" }, arr: [{ b: 2, a: 1 }] };
  const objB = { a: 1, nested: { x: "first", y: "second" }, arr: [{ a: 1, b: 2 }], z: 99 };

  const strA = canonicalJsonStringify(objA);
  const strB = canonicalJsonStringify(objB);
  assert.equal(strA, strB, "Canonical JSON stringify must produce identical strings regardless of key order");

  const hashA = computeHash(objA);
  const hashB = computeHash(objB);
  assert.equal(hashA, hashB, "SHA-256 digest of key-shuffled objects must be strictly equal");
  console.log("  [PASS] Key-order invariance confirmed: Canonical JSON produced identical digest.\n");

  // TEST 2: SHA-256 Output Format
  console.log("TEST 2: SHA-256 output verification (64 hex characters)...");
  const hexRegex = /^[0-9a-f]{64}$/;
  const testHashes = [
    computeHash(""),
    computeHash("Bhumitra Land Acquisition"),
    computeHash({ key: "val" }),
    computeHash(Buffer.from("Statutory Filing Content")),
  ];
  for (const h of testHashes) {
    assert.equal(h.length, 64, `Hash length must be 64, got ${h.length}`);
    assert.match(h, hexRegex, `Hash must be valid lowercase hex string: ${h}`);
  }
  console.log("  [PASS] SHA-256 digests strictly adhere to 64 lowercase hexadecimal characters.\n");

  // TEST 3: Pristine Sequential Blockchain Chain Construction & Verification
  console.log("TEST 3: Pristine sequential blockchain construction & verification...");
  const sampleEvents = [
    {
      id: "blk-1",
      proposalId: "PROP-001",
      action: "STAGE_ADVANCE",
      metadata: { stage: "INTAKE", requiringBody: "NHAI" },
      fileHash: null,
    },
    {
      id: "blk-2",
      proposalId: "PROP-001",
      action: "DOCUMENT_UPLOAD",
      metadata: { name: "SIA_Report_Hooghly.pdf", type: "SIA_REPORT" },
      fileHash: computeHash("Synthetic SIA PDF File Bytes"),
    },
    {
      id: "blk-3",
      proposalId: "PROP-001",
      action: "STAGE_ADVANCE",
      metadata: { fromStage: "INTAKE", toStage: "SIA", daysElapsed: 12 },
      fileHash: null,
    },
    {
      id: "blk-4",
      proposalId: "PROP-001",
      action: "COMPENSATION_CALCULATED",
      metadata: { parcelId: "PARCEL-402", totalCompensation: 45000000 },
      fileHash: null,
    },
    {
      id: "blk-5",
      proposalId: "PROP-001",
      action: "DOCUMENT_VERIFY",
      metadata: { name: "SIA_Report_Hooghly.pdf", verified: true },
      fileHash: null,
    },
  ];

  const chain: InMemoryAuditBlock[] = [];
  let prevHash = GENESIS_HASH;

  for (const ev of sampleEvents) {
    const payloadHash = computeHash(ev.metadata);
    const blockHash = computeHash(
      `${prevHash}:${ev.proposalId}:${ev.action}:${payloadHash}:${ev.fileHash ?? ""}`,
    );

    chain.push({
      id: ev.id,
      proposalId: ev.proposalId,
      action: ev.action,
      metadata: ev.metadata,
      fileHash: ev.fileHash,
      eventPayloadHash: payloadHash,
      previousHash: prevHash,
      chainHash: blockHash,
    });
    prevHash = blockHash;
  }

  const pristineResult = verifyInMemoryChain(chain);
  assert.equal(pristineResult.chainIntact, true, "Pristine chain must verify as intact");
  assert.equal(pristineResult.verifiedBlocks, 5, "All 5 blocks must be verified");
  console.log(`  [PASS] Pristine blockchain verified intact: 5/5 blocks verified.`);
  console.log(`  Genesis Hash: ${GENESIS_HASH.slice(0, 16)}...`);
  console.log(`  Head Hash:    ${chain[chain.length - 1]!.chainHash.slice(0, 16)}...\n`);

  // TEST 4: Simulated Payload Tamper Detection
  console.log("TEST 4: Simulated payload tamper detection...");
  const tamperedChainPayload: InMemoryAuditBlock[] = JSON.parse(JSON.stringify(chain));
  // Tamper with payload in block #3 (index 2)
  tamperedChainPayload[2]!.metadata["daysElapsed"] = 999;

  const payloadTamperResult = verifyInMemoryChain(tamperedChainPayload);
  assert.equal(payloadTamperResult.chainIntact, false, "Tampered payload must fail verification");
  assert.equal(payloadTamperResult.blockHeight, 3, "Tamper must be pinpointed at block height 3");
  assert.match(payloadTamperResult.reason!, /Payload tamper detected at block height 3/);
  console.log(`  [PASS] Payload tamper correctly detected at block height 3:`);
  console.log(`         "${payloadTamperResult.reason}"\n`);

  // TEST 5: Simulated Parent Pointer (Chain Linkage) Corruption
  console.log("TEST 5: Simulated parent pointer corruption detection...");
  const tamperedChainPointer: InMemoryAuditBlock[] = JSON.parse(JSON.stringify(chain));
  // Corrupt block #4's previousHash
  tamperedChainPointer[3]!.previousHash = "f".repeat(64);

  const pointerTamperResult = verifyInMemoryChain(tamperedChainPointer);
  assert.equal(pointerTamperResult.chainIntact, false, "Corrupted parent pointer must fail verification");
  assert.equal(pointerTamperResult.blockHeight, 4, "Broken link must be pinpointed at block height 4");
  assert.match(pointerTamperResult.reason!, /Broken chain link at block height 4/);
  console.log(`  [PASS] Parent pointer corruption correctly detected at block height 4:`);
  console.log(`         "${pointerTamperResult.reason}"\n`);

  // TEST 6: Cross-Engine Verification (node:crypto vs Web Crypto crypto.subtle)
  console.log("TEST 6: Cross-Engine equivalence (node:crypto vs Web Crypto crypto.subtle)...");
  const testStrings = [
    "",
    "Government of India - Department of Land Resources",
    GENESIS_HASH,
    canonicalJsonStringify({ title: "RFCTLARR Statutory Award", amount: 12500000, active: true }),
    `${GENESIS_HASH}:PROP-001:STAGE_ADVANCE:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855:`,
  ];

  for (const str of testStrings) {
    const nodeHash = crypto.createHash("sha256").update(str, "utf8").digest("hex");

    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const subtleBuffer = await crypto.subtle.digest("SHA-256", data);
    const subtleHash = Array.from(new Uint8Array(subtleBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    assert.equal(nodeHash, subtleHash, `Hashes must match for input '${str.slice(0, 30)}...'`);
  }
  console.log("  [PASS] node:crypto and Web Crypto crypto.subtle produce byte-for-byte identical SHA-256 digests.\n");

  console.log("===============================================================================");
  console.log("ALL 6 CRYPTOGRAPHIC INTEGRITY TESTS PASSED SUCCESSFULLY! (100% PASS RATE)");
  console.log("===============================================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
