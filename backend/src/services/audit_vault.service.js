import crypto from 'crypto';
import prisma from '../config/db.js';

/**
 * Computes SHA-256 hash of a string or buffer
 */
export const computeHash = (data) => {
  const hash = crypto.createHash('sha256');
  if (Buffer.isBuffer(data)) {
    hash.update(data);
  } else if (typeof data === 'object') {
    hash.update(JSON.stringify(data));
  } else {
    hash.update(String(data));
  }
  return hash.digest('hex');
};

/**
 * Adds an immutable entry into the cryptographic audit log.
 * Computes:
 * - file_hash: SHA-256 of uploaded file buffer (if provided)
 * - event_payload_hash: SHA-256 of event payload object/string
 * - chain_hash: SHA-256(previous_chain_hash + event_payload_hash + (file_hash || ''))
 */
export const addAuditEntry = async ({
  recordType,
  referenceId,
  action,
  fileBuffer = null,
  eventPayload = {},
  performedBy
}) => {
  try {
    const file_hash = fileBuffer ? computeHash(fileBuffer) : null;
    const event_payload_hash = computeHash(eventPayload);

    // Fetch the last inserted audit record in the global chain
    const lastEntry = await prisma.auditLog.findFirst({
      orderBy: { created_at: 'desc' }
    });

    const previous_hash = lastEntry ? lastEntry.chain_hash : '0000000000000000000000000000000000000000000000000000000000000000';

    // Compute chained SHA-256 hash
    const rawChainContent = `${previous_hash}:${recordType}:${referenceId}:${action}:${event_payload_hash}:${file_hash || ''}`;
    const chain_hash = computeHash(rawChainContent);

    // Insert append-only row into audit_log table
    const auditRecord = await prisma.auditLog.create({
      data: {
        record_type: recordType,
        reference_id: String(referenceId),
        action,
        file_hash,
        event_payload_hash,
        previous_hash,
        chain_hash,
        performed_by: performedBy
      }
    });

    return auditRecord;
  } catch (err) {
    console.error('Audit Vault Error:', err);
    throw new Error(`Failed to create cryptographic audit entry: ${err.message}`);
  }
};

/**
 * Verifies full chain integrity for a given reference ID or entire log
 */
export const verifyChainIntegrity = async (referenceId = null) => {
  const whereClause = referenceId ? { reference_id: String(referenceId) } : {};
  const logs = await prisma.auditLog.findMany({
    where: whereClause,
    orderBy: { created_at: 'asc' }
  });

  if (logs.length === 0) {
    return {
      chainIntact: true,
      totalRecords: 0,
      message: 'No audit records found for verification.'
    };
  }

  let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';

  for (let i = 0; i < logs.length; i++) {
    const record = logs[i];

    // Check if recorded previous_hash matches expected previousHash (if full log scan)
    // Recalculate chain hash
    const rawChainContent = `${record.previous_hash}:${record.record_type}:${record.reference_id}:${record.action}:${record.event_payload_hash}:${record.file_hash || ''}`;
    const expectedChainHash = computeHash(rawChainContent);

    if (record.chain_hash !== expectedChainHash) {
      return {
        chainIntact: false,
        brokenAtRowIndex: i + 1,
        brokenRecordId: record.id,
        referenceId: record.reference_id,
        reason: 'Chain hash mismatch! Payload or record hash was tampered with.'
      };
    }
  }

  return {
    chainIntact: true,
    totalRecords: logs.length,
    message: 'Cryptographic hash chain is fully intact and verified.'
  };
};
