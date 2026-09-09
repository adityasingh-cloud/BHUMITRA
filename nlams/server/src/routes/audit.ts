import { Router } from "express";
import { requireNlamsUser } from "../middleware/auth.js";
import { verifyChainIntegrity } from "../lib/auditVault.js";

export const auditRouter = Router();

auditRouter.use(requireNlamsUser);

/** GET /api/audit/verify — walks the entire audit_logs hash chain and checks integrity. */
auditRouter.get("/verify", async (_req, res) => {
  const result = await verifyChainIntegrity();
  res.json(result);
});

/** GET /api/audit/chain?limit=100 — returns full blockchain ledger with verification stats. */
auditRouter.get("/chain", async (req, res) => {
  const limitParam = req.query["limit"];
  const limit = limitParam ? Math.max(1, Math.min(500, Number(limitParam))) : 100;

  const [verification, allLogs] = await Promise.all([
    verifyChainIntegrity(),
    prisma.auditLog.findMany({
      include: {
        user: { select: { name: true, role: true } },
        proposal: { select: { projectName: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ]);

  const totalBlocks = allLogs.length;

  const allBlocks = allLogs.map((log, index) => ({
    id: log.id,
    blockHeight: index + 1,
    proposalId: log.proposalId,
    projectName: log.proposal?.projectName ?? "Unknown Project",
    action: log.action,
    actor: log.user ? { name: log.user.name, role: log.user.role } : null,
    chainHash: log.chainHash,
    previousHash: log.previousHash,
    eventPayloadHash: log.eventPayloadHash,
    fileHash: log.fileHash,
    metadata: log.metadata,
    createdAt: log.createdAt.toISOString(),
  }));

  // Return the latest blocks (newest first) up to the limit
  const blocks = allBlocks.slice(-limit).reverse();

  res.json({
    verification,
    totalBlocks,
    blocks,
  });
});

