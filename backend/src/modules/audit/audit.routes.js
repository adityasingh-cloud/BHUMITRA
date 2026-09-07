import express from 'express';
import multer from 'multer';
import { uploadDocument, verifyAuditChain } from './audit.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.middleware.js';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

/**
 * @openapi
 * /api/documents/upload:
 *   post:
 *     summary: Upload a land document & compute SHA-256 cryptographic audit chain hash
 *     tags: [Audit Vault]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               reference_id:
 *                 type: string
 *               record_type:
 *                 type: string
 *     responses:
 *       201:
 *         description: Document uploaded and hashed successfully
 */
router.post('/documents/upload', authenticateToken, upload.single('file'), uploadDocument);

/**
 * @openapi
 * /api/audit/verify/{referenceId}:
 *   get:
 *     summary: Verify cryptographic SHA-256 hash chain integrity for a reference record
 *     tags: [Audit Vault]
 *     parameters:
 *       - in: path
 *         name: referenceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Verification result with chainIntact status
 */
router.get('/audit/verify/:referenceId', verifyAuditChain);

export default router;
