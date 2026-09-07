import express from 'express';
import { listStateAdapters, triggerStateSync } from './adapters_admin.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @openapi
 * /api/admin/adapters:
 *   get:
 *     summary: List all federated 36 State land record adapters and sync status
 *     tags: [Federated State Integration Layer]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of registered state adapters and plugin status
 */
router.get('/adapters', authenticateToken, requireRole(['state_official', 'dolr_admin']), listStateAdapters);

/**
 * @openapi
 * /api/admin/adapters/trigger-sync:
 *   post:
 *     summary: Trigger async state adapter sync job via RabbitMQ message queue
 *     tags: [Federated State Integration Layer]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               state_code:
 *                 type: string
 *                 example: WB
 *     responses:
 *       202:
 *         description: Sync job published to RabbitMQ queue
 */
router.post('/adapters/trigger-sync', authenticateToken, requireRole(['state_official', 'dolr_admin']), triggerStateSync);

export default router;
