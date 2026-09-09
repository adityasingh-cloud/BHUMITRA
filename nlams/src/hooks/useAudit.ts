import { useMutation } from "@tanstack/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

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

/** On-demand action (not a query) — the officer explicitly asks to re-verify the chain. */
export interface AuditBlock {
  id: string;
  blockHeight: number;
  proposalId: string;
  projectName?: string;
  action: string;
  actor: { name: string; role: string } | null;
  chainHash: string | null;
  previousHash: string | null;
  eventPayloadHash: string | null;
  fileHash: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditChainResponse {
  verification: ChainVerification;
  totalBlocks: number;
  blocks: AuditBlock[];
}

/** On-demand action — the officer explicitly requests to re-verify the full ledger chain. */
export function useVerifyAuditChainMutation() {
  return useMutation({
    mutationFn: () => api.get<ChainVerification>("/api/audit/verify"),
  });
}

/** Queries the global audit blockchain with verification summary. */
export function useAuditChainQuery(limit: number = 100) {
  return useQuery({
    queryKey: ["audit", "chain", limit],
    queryFn: () => api.get<AuditChainResponse>(`/api/audit/chain?limit=${limit}`),
  });
}

