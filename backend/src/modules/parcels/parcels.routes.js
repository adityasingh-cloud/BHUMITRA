import express from 'express';
import { verifyProjectParcels } from './parcels.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @openapi
 * /api/parcels/verify:
 *   post:
 *     summary: Verify project boundary GeoJSON against PostGIS parcels, ISRO Bhuvan LULC, ULPIN & State adapters
 *     tags: [Spatial Land Parcel Verifier]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [boundary_geojson]
 *             properties:
 *               boundary_geojson:
 *                 type: object
 *                 example:
 *                   type: Polygon
 *                   coordinates: [[[88.2200, 22.8100], [88.2400, 22.8100], [88.2400, 22.8200], [88.2200, 22.8200], [88.2200, 22.8100]]]
 *               state_code:
 *                 type: string
 *                 example: WB
 *               district_code:
 *                 type: string
 *                 example: WB-HGH
 *     responses:
 *       200:
 *         description: Spatial verification completed with priority pipeline logs and auto-grievance triggers
 */
router.post('/verify', authenticateToken, requireRole(['requiring_body', 'lao_district', 'dolr_admin']), verifyProjectParcels);

export default router;
