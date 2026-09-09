import { History, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  History,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
  Link as LinkIcon,
  Code2,
} from "lucide-react";
import { toast } from "sonner";
import { STAGE_LABELS, type RfctlarrStage } from "@/data/mockData";
import { useAuditLogQuery } from "@/hooks/useProposals";
import { useAuditLogQuery, type AuditLogEntry } from "@/hooks/useProposals";
import { useVerifyAuditChainMutation } from "@/hooks/useAudit";
import { verifyBlockClientSide, type ClientBlockVerificationResult } from "@/lib/clientCrypto";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ACTION_LABEL: Record<string, string> = {
  STAGE_ADVANCE: "Stage advanced",
  DOCUMENT_UPLOAD: "Document uploaded",
  DOCUMENT_VERIFY: "Document integrity checked",
  COMPENSATION_CALCULATED: "Compensation award finalized",
  GRIEVANCE_SUBMITTED: "Grievance ticket submitted",
  GRIEVANCE_RESOLVED: "Grievance ticket resolved",
  RISK_SCORED: "Litigation risk re-scored",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function CopyableHash({
  label,
  hash,
  truncate = true,
  className,
}: {
  label?: string;
  hash: string | null | undefined;
  truncate?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!hash) return <span className="text-[10.5px] italic text-muted-foreground">none</span>;

  const display = truncate && hash.length > 14 ? `${hash.slice(0, 6)}…${hash.slice(-6)}` : hash;

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard?.writeText(hash);
    setCopied(true);
    toast.success("Hash copied", { description: hash });
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={copy}
          className={cn(
            "group inline-flex items-center gap-1 rounded border border-border/70 bg-muted/60 px-1.5 py-0.5 font-mono text-[10.5px] text-foreground transition-colors hover:bg-muted",
            className,
          )}
        >
          {label && <span className="font-sans text-[10px] text-muted-foreground">{label}:</span>}
          <span>{display}</span>
          {copied ? (
            <Check className="size-2.5 shrink-0 text-status-ok" />
          ) : (
            <Copy className="size-2.5 shrink-0 text-muted-foreground opacity-60 transition-opacity group-hover:text-foreground group-hover:opacity-100" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs break-all font-mono text-[10.5px]">
        {hash} (click to copy)
      </TooltipContent>
    </Tooltip>
  );
}

function InspectProofModal({
  entry,
  proposalId,
  open,
  onOpenChange,
}: {
  entry: AuditLogEntry;
  proposalId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [verification, setVerification] = useState<ClientBlockVerificationResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    verifyBlockClientSide({
      chainHash: entry.chainHash,
      previousHash: entry.previousHash,
      proposalId,
      action: entry.action,
      eventPayloadHash: entry.eventPayloadHash,
      fileHash: entry.fileHash,
      metadata: entry.metadata,
    })
      .then((res) => setVerification(res))
      .catch((err) => console.error("Client block verification error:", err))
      .finally(() => setLoading(false));
  }, [open, entry, proposalId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-sm font-bold text-primary">
                Block #{String(entry.blockHeight ?? 1).padStart(3, "0")}
              </span>
              <span>Cryptographic Proof &amp; Invariants</span>
            </DialogTitle>
            {verification && !loading && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold",
                  verification.matches
                    ? "border-status-ok/40 bg-status-ok/10 text-status-ok"
                    : "border-status-critical/40 bg-status-critical/10 text-status-critical",
                )}
              >
                {verification.matches ? (
                  <>
                    <ShieldCheck className="size-3.5" /> PASS (Verified)
                  </>
                ) : (
                  <>
                    <ShieldAlert className="size-3.5" /> FAIL (Mismatch)
                  </>
                )}
              </span>
            )}
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Independent client-side verification executing via W3C Web Cryptography API (crypto.subtle).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 pt-2 text-xs">
          <div className="rounded border border-border/80 bg-muted/30 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mathematical Formula
            </div>
            <code className="mt-1 block font-mono text-[11px] text-foreground">
              chainHash_n = SHA-256(previousHash_&#123;n-1&#125; : proposalId : action : eventPayloadHash : fileHash)
            </code>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Formula Breakdown &amp; Inputs
            </div>
            <div className="grid grid-cols-1 gap-2 rounded border border-border bg-card p-3">
              <div>
                <div className="text-[10.5px] text-muted-foreground">1. Parent Block Hash (previousHash)</div>
                <code className="break-all font-mono text-[11px] text-foreground">
                  {entry.previousHash ?? "0".repeat(64)}
                </code>
              </div>
              <div>
                <div className="text-[10.5px] text-muted-foreground">2. Proposal ID</div>
                <code className="font-mono text-[11px] text-foreground">{proposalId}</code>
              </div>
              <div>
                <div className="text-[10.5px] text-muted-foreground">3. Statutory Action</div>
                <code className="font-mono text-[11px] text-foreground">{entry.action}</code>
              </div>
              <div>
                <div className="text-[10.5px] text-muted-foreground">4. Canonical Event Payload Hash (SHA-256)</div>
                <code className="break-all font-mono text-[11px] text-foreground">
                  {entry.eventPayloadHash ?? "—"}
                </code>
              </div>
              <div>
                <div className="text-[10.5px] text-muted-foreground">5. File Hash (SHA-256, empty if none)</div>
                <code className="break-all font-mono text-[11px] text-foreground">
                  {entry.fileHash ? entry.fileHash : '"" (empty string)'}
                </code>
              </div>
            </div>
          </div>

          {verification && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Live Browser Verification Result
              </div>
              <div className="rounded border border-border bg-muted/40 p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Recorded Head Hash:</span>
                  <span className="font-bold text-foreground break-all">{verification.expectedHash}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Browser Recomputed:</span>
                  <span
                    className={cn(
                      "font-bold break-all",
                      verification.matches ? "text-status-ok" : "text-status-critical",
                    )}
                  >
                    {verification.recomputedHash}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Canonical JSON Payload
              </span>
              <span className="text-[10.5px] text-muted-foreground">Deterministic key sorting applied</span>
            </div>
            <pre className="max-h-36 overflow-x-auto rounded border border-border bg-slate-950 p-2.5 font-mono text-[10.5px] text-slate-100">
              {JSON.stringify(entry.metadata ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AuditTrail({ proposalId }: { proposalId: string }) {
  const { data, isLoading } = useAuditLogQuery(proposalId);
  const verifyChain = useVerifyAuditChainMutation();
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  return (
    <section className="panel">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <History className="size-3.5 text-muted-foreground" />
          <div className="label-xs">Audit Trail</div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <div className="label-xs font-semibold">Cryptographic Blockchain Ledger</div>
        </div>
        <div className="flex items-center gap-2">
          {verifyChain.data && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[10.5px] font-medium",
                "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium",
                verifyChain.data.chainIntact
                  ? "border-status-ok/30 bg-status-ok/10 text-status-ok"
                  : "border-status-critical/30 bg-status-critical/10 text-status-critical",
              )}
            >
              {verifyChain.data.chainIntact ? (
                <ShieldCheck className="size-3" />
                <ShieldCheck className="size-3.5" />
              ) : (
                <ShieldAlert className="size-3" />
                <ShieldAlert className="size-3.5" />
              )}
              {verifyChain.data.chainIntact
                ? `Chain intact (${verifyChain.data.totalRecords})`
                : "Tamper detected"}
                ? `Chain Intact (${verifyChain.data.verifiedBlocks}/${verifyChain.data.totalRecords} Blocks)`
                : `Tamper Alert: ${verifyChain.data.reason ?? "Integrity compromised"}`}
            </span>
          )}
          <button
            type="button"
            disabled={verifyChain.isPending}
            onClick={() => verifyChain.mutate()}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-border px-2 py-1 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            title="Recompute the cryptographic hash chain over the entire audit log"
            onClick={() =>
              verifyChain.mutate(undefined, {
                onSuccess: (res) => {
                  if (res.chainIntact) {
                    toast.success("Cryptographic Hash Chain Verified Intact", {
                      description: `Traversed ${res.verifiedBlocks} chained blocks. Head: ${res.headHash.slice(0, 16)}...`,
                    });
                  } else {
                    toast.error("Cryptographic Hash Chain Tamper Detected", {
                      description: res.reason ?? "Block mismatch",
                    });
                  }
                },
                onError: (err) => toast.error("Verification failed: " + err.message),
              })
            }
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            title="Traverse and cryptographically recompute SHA-256 hashes across all blocks in the database"
          >
            {verifyChain.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
              <Loader2 className="size-3.5 animate-spin text-primary" />
            ) : (
              <ShieldCheck className="size-3.5" />
              <ShieldCheck className="size-3.5 text-status-ok" />
            )}
            Verify Chain Integrity
          </button>
        </div>
      </div>

      <div className="divide-y divide-border">
        {isLoading && (
          <div className="space-y-2 p-4">
            <div className="shimmer h-4 w-3/4" />
            <div className="shimmer h-4 w-1/2" />
          <div className="space-y-3 p-4">
            <div className="shimmer h-8 w-full rounded" />
            <div className="shimmer h-8 w-5/6 rounded" />
          </div>
        )}
        {!isLoading && (!data || data.length === 0) && (
          <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">
            No recorded actions against this proposal yet.
          <p className="px-4 py-8 text-center text-[12px] text-muted-foreground">
            No statutory blockchain blocks committed for this proposal yet.
          </p>
        )}
        {data?.map((entry) => (
          <div key={entry.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium text-foreground">
                {ACTION_LABEL[entry.action] ?? entry.action}
                {entry.fromStage && entry.toStage && (
                  <span className="text-muted-foreground">
                    {" "}
                    — {STAGE_LABELS[entry.fromStage as RfctlarrStage]} →{" "}
                    {STAGE_LABELS[entry.toStage as RfctlarrStage]}
        {data?.map((entry, index) => {
          return (
            <div
              key={entry.id}
              className="group relative flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/30"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">
                    Block #{String(entry.blockHeight ?? index + 1).padStart(3, "0")}
                  </span>
                  <span className="text-[12.5px] font-semibold text-foreground">
                    {ACTION_LABEL[entry.action] ?? entry.action}
                  </span>
                  {entry.fromStage && entry.toStage && (
                    <span className="text-[11px] text-muted-foreground">
                      ({STAGE_LABELS[entry.fromStage as RfctlarrStage]} →{" "}
                      {STAGE_LABELS[entry.toStage as RfctlarrStage]})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="num text-[11px] text-muted-foreground">{fmt(entry.createdAt)}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedEntry(entry)}
                    className="inline-flex items-center gap-1 rounded border border-border/80 bg-background px-2 py-0.5 text-[10.5px] font-medium text-foreground/80 hover:bg-accent hover:text-foreground"
                  >
                    <Code2 className="size-3 text-muted-foreground" />
                    Inspect Proof
                  </button>
                </div>
              </div>

              {/* Chain Linkage Bar */}
              <div className="flex flex-wrap items-center gap-2 rounded bg-muted/40 px-2.5 py-1.5 text-[11px]">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <LinkIcon className="size-3 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-wider font-semibold">Parent:</span>
                </div>
                <CopyableHash hash={entry.previousHash} />

                <span className="text-muted-foreground">→</span>

                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="text-[10px] uppercase tracking-wider font-semibold">Block Hash:</span>
                </div>
                <CopyableHash
                  hash={entry.chainHash}
                  className="border-primary/30 bg-primary/5 text-primary font-bold"
                />

                {entry.eventPayloadHash && (
                  <CopyableHash label="Payload" hash={entry.eventPayloadHash} />
                )}

                {entry.fileHash && (
                  <CopyableHash label="File" hash={entry.fileHash} className="border-blue-500/30 bg-blue-500/5 text-blue-600" />
                )}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {entry.actor ? `${entry.actor.name} · ${entry.actor.role}` : "System"}

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <div>Committed by: {entry.actor ? `${entry.actor.name} (${entry.actor.role})` : "System Automated Engine"}</div>
              </div>
            </div>
            <div className="num shrink-0 text-[11px] text-muted-foreground">
              {fmt(entry.createdAt)}
            </div>
          </div>
        ))}
          );
        })}
      </div>

      {selectedEntry && (
        <InspectProofModal
          entry={selectedEntry}
          proposalId={proposalId}
          open={!!selectedEntry}
          onOpenChange={(open) => {
            if (!open) setSelectedEntry(null);
          }}
        />
      )}
    </section>
  );
}

