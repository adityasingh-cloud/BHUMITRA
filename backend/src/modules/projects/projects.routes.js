import express from 'express';
import {
  createProject,
  advanceStage,
  getProjectStatus,
  updateConsent,
  getProjectRisk
} from './projects.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @openapi
 * /api/projects:
 *   post:
 *     summary: Create a new land acquisition project (Initializes at Proposal stage)
 *     tags: [SIA Lifecycle Tracker]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, purpose, boundary_geojson]
 *             properties:
 *               name:
 *                 type: string
 *               purpose:
 *                 type: string
 *               boundary_geojson:
 *                 type: object
 *               state_code:
 *                 type: string
 *               district_code:
 *                 type: string
 *     responses:
 *       201:
 *         description: Project created and initial risk score evaluated
 */
router.post('/', authenticateToken, requireRole(['requiring_body', 'lao_district', 'dolr_admin']), createProject);

/**
 * @openapi
 * /api/projects/{id}/advance-stage:
 *   patch:
 *     summary: Advance project to the next RFCTLARR statutory workflow stage
 *     tags: [SIA Lifecycle Tracker]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Stage advanced successfully with new SLA deadline
 */
router.patch('/:id/advance-stage', authenticateToken, requireRole(['lao_district', 'state_official', 'dolr_admin']), advanceStage);

/**
 * @openapi
 * /api/projects/{id}/status:
 *   get:
 *     summary: Get current project statutory stage, elapsed days & SLA status
 *     tags: [SIA Lifecycle Tracker]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project status and SLA metrics
 */
router.get('/:id/status', getProjectStatus);

/**
 * @openapi
 * /api/projects/{id}/consent:
 *   patch:
 *     summary: Record SIA public consultation consent percentage collected
 *     tags: [SIA Lifecycle Tracker]
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
 *             required: [consent_percentage_collected]
 *             properties:
 *               consent_percentage_collected:
 *                 type: number
 *                 example: 82.5
 *     responses:
 *       200:
 *         description: Consent percentage updated and risk re-evaluated
 */
router.patch('/:id/consent', authenticateToken, requireRole(['lao_district', 'requiring_body', 'dolr_admin']), updateConsent);

/**
 * @openapi
 * /api/projects/{id}/risk:
 *   get:
 *     summary: Fetch latest explainable Litigation & Delay Risk score (Module 5)
 *     tags: [Litigation & Delay Risk Engine]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Risk score (0-100), risk tier, and feature importances
 */
router.get('/:id/risk', getProjectRisk);

export default router;
