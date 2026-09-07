import fs from 'fs';
import path from 'path';
import { addAuditEntry, verifyChainIntegrity } from '../../services/audit_vault.service.js';
import prisma from '../../config/db.js';

export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: true,
        message: 'No document file uploaded.',
        code: 'FILE_MISSING'
      });
    }

    const { reference_id, record_type } = req.body;
    const refId = reference_id || 'GENERAL_DOC';
    const recType = record_type || 'DOCUMENT';

    const fileBuffer = req.file.buffer || fs.readFileSync(req.file.path);
    const performedBy = req.user ? req.user.id : (await prisma.user.findFirst()).id;

    // Create cryptographic audit entry with file SHA-256 hash
    const auditEntry = await addAuditEntry({
      recordType: recType,
      referenceId: refId,
      action: 'DOCUMENT_UPLOAD',
      fileBuffer,
      eventPayload: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      },
      performedBy
    });

    return res.status(201).json({
      error: false,
      message: 'Document uploaded and cryptographically hashed into Audit Vault.',
      data: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileHash: auditEntry.file_hash,
        auditRecord: auditEntry
      }
    });
  } catch (err) {
    console.error('Document Upload Audit Error:', err);
    return res.status(500).json({
      error: true,
      message: `Error uploading document: ${err.message}`,
      code: 'UPLOAD_ERROR'
    });
  }
};

export const verifyAuditChain = async (req, res) => {
  try {
    const { referenceId } = req.params;
    const result = await verifyChainIntegrity(referenceId);

    return res.status(200).json({
      error: false,
      data: result
    });
  } catch (err) {
    console.error('Audit Verification Error:', err);
    return res.status(500).json({
      error: true,
      message: `Error verifying audit chain: ${err.message}`,
      code: 'VERIFICATION_ERROR'
    });
  }
};
