import express from 'express';
import { getPublicProjectDetails, searchPublicProjects } from './public.controller.js';

const router = express.Router();

/**
 * @openapi
 * /api/public/projects/search:
 *   get:
 *     summary: Search public land acquisition projects by state, district, or project name (No auth required)
 *     tags: [Public Case-Transparency Portal]
 *     parameters:
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         example: WB
 *       - in: query
 *         name: district
 *         schema:
 *           type: string
 *         example: WB-HGH
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         example: Highway
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/projects/search', searchPublicProjects);

/**
 * @openapi
 * /api/public/projects/{id}:
 *   get:
 *     summary: Fetch aggregate non-identifying land acquisition metrics (No PII / Bank Details)
 *     tags: [Public Case-Transparency Portal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sanitized aggregate project metrics
 */
router.get('/projects/:id', getPublicProjectDetails);

export default router;
