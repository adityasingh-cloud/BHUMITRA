import express from 'express';
import { calculateCompensation } from './compensation.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @openapi
 * /api/compensation/calculate:
 *   post:
 *     summary: Calculate statutory RFCTLARR land compensation award with solatium & interest
 *     tags: [RFCTLARR Compensation Engine]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [project_id, parcel_id, circle_rate, notification_date, award_date]
 *             properties:
 *               project_id:
 *                 type: string
 *               parcel_id:
 *                 type: string
 *               circle_rate:
 *                 type: number
 *                 example: 5000000
 *               avg_top_50pct_sale_deeds:
 *                 type: number
 *                 example: 5500000
 *               comparable_area_avg:
 *                 type: number
 *                 example: 5200000
 *               distance_from_urban_km:
 *                 type: number
 *                 example: 15
 *               asset_items:
 *                 type: object
 *                 properties:
 *                   structures:
 *                     type: number
 *                     example: 1200000
 *                   trees:
 *                     type: number
 *                     example: 300000
 *                   wells:
 *                     type: number
 *                     example: 150000
 *                   crops:
 *                     type: number
 *                     example: 80000
 *               notification_date:
 *                 type: string
 *                 example: 2024-01-15
 *               award_date:
 *                 type: string
 *                 example: 2025-06-30
 *     responses:
 *       201:
 *         description: Statutory calculation completed with audit hash and PFMS receipt
 */
router.post('/calculate', authenticateToken, requireRole(['lao_district', 'dolr_admin']), calculateCompensation);

export default router;
