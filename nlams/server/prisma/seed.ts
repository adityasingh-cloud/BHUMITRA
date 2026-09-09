import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaClient, type AuditAction, type RfctlarrStage } from "@prisma/client";
import { createHash } from "node:crypto";
import { buildProposals } from "../../src/data/mockData.js";
import { DISTRICT_COORDS } from "./districtCoords.js";
import { addAuditEntry, verifyChainIntegrity } from "../src/lib/auditVault.js";

const prisma = new PrismaClient();

function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Deterministic [0,1) pseudo-random value derived from a string. */
function hashToUnit(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 10_000) / 10_000;
}

/**
 * A parcel doesn't have a real cadastral survey position, so we place it a
 * short, deterministic jitter away from its district's HQ town — plausible
 * enough for a real Leaflet/PostGIS map, honest about not being surveyed data.
 */
function jitteredCenter(base: [number, number], seed: string): [number, number] {
  const jitterDeg = 0.03; // ~3km spread
  const dLat = (hashToUnit(seed) - 0.5) * 2 * jitterDeg;
  const dLng = (hashToUnit(seed + "#lng") - 0.5) * 2 * jitterDeg;
  return [base[0] + dLat, base[1] + dLng];
}

/** A small rectangle sized to roughly match the parcel's real area. */
function parcelPolygonWkt(center: [number, number], areaHa: number): string {
  const [lat, lng] = center;
  const sideMeters = Math.sqrt(Math.max(areaHa, 0.05) * 10_000);
  const halfLat = sideMeters / 2 / 111_000;
  const halfLng = sideMeters / 2 / (111_000 * Math.cos((lat * Math.PI) / 180));
  const corners: [number, number][] = [
    [lng - halfLng, lat - halfLat],
    [lng + halfLng, lat - halfLat],
    [lng + halfLng, lat + halfLat],
    [lng - halfLng, lat + halfLat],
    [lng - halfLng, lat - halfLat],
  ];
  return `POLYGON((${corners.map(([x, y]) => `${x} ${y}`).join(", ")}))`;
}

/** Synthesizes real, verifiable file bytes for a seeded document. */
function synthesizeFile(proposalId: string, docName: string, docType: string): Buffer {
  return Buffer.from(
    [
      "BHUMITRA — National Land Acquisition & Management System",
      "This is a seed-generated placeholder for a statutory filing.",
      `Proposal: ${proposalId}`,
      `Document: ${docName}`,
      `Type: ${docType}`,
      "Replace with the real scanned filing via the Document Repository upload action.",
    ].join("\n"),
    "utf8",
  );
}

async function main() {
  console.log("Wiping existing proposal data…");
  await prisma.auditLog.deleteMany();
  await prisma.proposal.deleteMany(); // cascades to parcels + documents

  const proposals = buildProposals();
  console.log(`Seeding ${proposals.length} proposals…`);

  for (const p of proposals) {
    await prisma.proposal.create({
      data: {
        id: p.id,
        projectName: p.projectName,
        requiringBody: p.requiringBody,
        state: p.state,
        district: p.district,
        currentStage: p.currentStage,
        stageEnteredAt: new Date(p.stageEnteredAt),
        initiatedAt: new Date(p.initiatedAt),
        affectedFamilies: p.affectedFamilies,
        parcels: {
          create: p.parcels.map((parcel) => ({
            ulpin: parcel.ulpin,
            khasraNo: parcel.khasraNo,
            vernacularTerm: parcel.vernacularTerm,
            areaHa: parcel.areaHa,
            classification: parcel.classification,
            ownerName: parcel.ownerName,
            coOwners: parcel.coOwners,
            compensationAssessed: parcel.compensationAssessed,
            compensationDisbursed: parcel.compensationDisbursed,
          })),
        },
        documents: {
          create: p.documents.map((doc) => {
            const buffer = synthesizeFile(p.id, doc.name, doc.type);
            return {
              name: doc.name,
              type: doc.type,
              uploadedAt: new Date(doc.uploadedAt),
              sizeKb: Math.max(1, Math.round(buffer.byteLength / 1024)),
              sha256: sha256Hex(buffer),
              fileData: Uint8Array.from(buffer),
              contentType: "text/plain",
              lastVerifiedAt: doc.verified ? new Date(doc.uploadedAt) : null,
            };
          }),
        },
      },
    });

    const base = DISTRICT_COORDS[p.district];
    if (base) {
      for (const parcel of p.parcels) {
        const center = jitteredCenter(base, parcel.ulpin);
        const wkt = parcelPolygonWkt(center, parcel.areaHa);
        await prisma.$executeRaw`
          UPDATE parcels SET geom = ST_SetSRID(ST_GeomFromText(${wkt}), 4326)
          WHERE ulpin = ${parcel.ulpin}
        `;
      }
    }
  }

  // Queue chronological audit blocks for all seeded initial states, stage advancements, and document filings
  interface SeedAuditEvent {
    proposalId: string;
    action: AuditAction;
    fromStage?: RfctlarrStage | null;
    toStage?: RfctlarrStage | null;
    fileBuffer?: Buffer | null;
    eventPayload: Record<string, unknown>;
    createdAt: Date;
  }

  const auditEvents: SeedAuditEvent[] = [];

  for (const p of proposals) {
    // 1. Initial Intake audit block
    auditEvents.push({
      proposalId: p.id,
      action: "STAGE_ADVANCE",
      fromStage: null,
      toStage: "INTAKE",
      eventPayload: {
        projectName: p.projectName,
        requiringBody: p.requiringBody,
        state: p.state,
        district: p.district,
        totalAreaHa: p.totalAreaHa,
        affectedFamilies: p.affectedFamilies,
      },
      createdAt: new Date(p.initiatedAt),
    });

    // 2. Current stage progression if beyond INTAKE
    if (p.currentStage !== "INTAKE") {
      auditEvents.push({
        proposalId: p.id,
        action: "STAGE_ADVANCE",
        fromStage: "INTAKE",
        toStage: p.currentStage,
        eventPayload: {
          fromStage: "INTAKE",
          toStage: p.currentStage,
          projectName: p.projectName,
          advancedAt: p.stageEnteredAt,
        },
        createdAt: new Date(p.stageEnteredAt),
      });
    }

    // 3. Document filings and verifications
    for (const doc of p.documents) {
      const buffer = synthesizeFile(p.id, doc.name, doc.type);
      const sha256 = sha256Hex(buffer);
      const docUploadTime = new Date(doc.uploadedAt);

      auditEvents.push({
        proposalId: p.id,
        action: "DOCUMENT_UPLOAD",
        fileBuffer: buffer,
        eventPayload: {
          name: doc.name,
          type: doc.type,
          sha256,
          sizeKb: Math.max(1, Math.round(buffer.byteLength / 1024)),
        },
        createdAt: docUploadTime,
      });

      if (doc.verified) {
        auditEvents.push({
          proposalId: p.id,
          action: "DOCUMENT_VERIFY",
          eventPayload: {
            name: doc.name,
            type: doc.type,
            verified: true,
            integrityMatch: true,
            sha256,
          },
          createdAt: new Date(docUploadTime.getTime() + 1000),
        });
      }
    }
  }

  // Sort events strictly chronologically
  auditEvents.sort((a, b) => {
    const diff = a.createdAt.getTime() - b.createdAt.getTime();
    if (diff !== 0) return diff;
    return a.proposalId.localeCompare(b.proposalId);
  });

  // Ensure monotonically increasing timestamps to guarantee stable ordering
  let lastTime = 0;
  for (const ev of auditEvents) {
    let t = ev.createdAt.getTime();
    if (t <= lastTime) {
      t = lastTime + 10;
      ev.createdAt = new Date(t);
    }
    lastTime = t;
  }

  console.log(`Writing ${auditEvents.length} chronological audit blocks into cryptographic hash chain…`);
  for (const ev of auditEvents) {
    await addAuditEntry(prisma, {
      proposalId: ev.proposalId,
      action: ev.action,
      fromStage: ev.fromStage,
      toStage: ev.toStage,
      fileBuffer: ev.fileBuffer,
      eventPayload: ev.eventPayload,
      createdAt: ev.createdAt,
    });
  }

  console.log("Verifying blockchain cryptographic hash chain integrity…");
  const verification = await verifyChainIntegrity();
  console.log(
    `Blockchain verification result: ${verification.verifiedBlocks}/${verification.totalRecords} blocks verified (chainIntact: ${verification.chainIntact}, head: ${verification.headHash.slice(0, 16)}…)`,
  );

  if (!verification.chainIntact) {
    throw new Error(`Chain integrity check failed: ${verification.reason}`);
  }

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

