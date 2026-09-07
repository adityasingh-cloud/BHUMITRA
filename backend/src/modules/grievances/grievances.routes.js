import express from 'express';
import {
  submitGrievance,
  getGrievanceStatus,
  resolveGrievance
} from './grievances.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @openapi
 * /api/grievances:
 *   post:
 *     summary: Submit a land title correction or compensation grievance ticket
 *     tags: [Human-in-the-Loop Correction & Grievance SLA]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [record_type, reference_id, issue_category, description]
 *             properties:
 *               record_type:
 *                 type: string
 *                 example: PARCEL_TITLE_DISPUTE
 *               reference_id:
 *                 type: string
 *               issue_category:
 *                 type: string
 *                 example: Boundary Discrepancy
 *               description:
 *                 type: string
 *               evidence_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Ticket submitted with 15-day SLA deadline
 */
router.post('/', authenticateToken, submitGrievance);

/**
 * @openapi
 * /api/grievances/{id}:
 *   get:
 *     summary: Track grievance ticket status and SLA deadline
 *     tags: [Human-in-the-Loop Correction & Grievance SLA]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Grievance ticket status
 */
router.get('/:id', getGrievanceStatus);

/**
 * @openapi
 * /api/grievances/{id}/resolve:
 *   patch:
 *     summary: Resolve/reject grievance ticket and update linked parcel provenance
 *     tags: [Human-in-the-Loop Correction & Grievance SLA]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [resolved, rejected, under_review, field_verification]
 *               updated_provenance:
 *                 type: string
 *                 enum: [ulpin_verified, svamitva_digitised, legacy_migrated, self_declared_pending]
 *     responses:
 *       200:
 *         description: Ticket updated and parcel provenance updated
 */
router.patch('/:id/resolve', authenticateToken, requireRole(['lao_district', 'dolr_admin']), resolveGrievance);

export default router;
