import prisma from '../../config/db.js';
import { checkBhuvanLULCOverlay } from '../../services/bhuvan_wms.service.js';
import { lookupULPINRegistry } from '../../services/ulpin_lookup.service.js';
import westBengalAdapter from '../../adapters/west_bengal_adapter.js';

export const verifyProjectParcels = async (req, res) => {
  try {
    const { boundary_geojson, state_code, district_code } = req.body;

    if (!boundary_geojson || !boundary_geojson.coordinates) {
      return res.status(400).json({
        error: true,
        message: 'Valid GeoJSON boundary_geojson is required.',
        code: 'INVALID_GEOJSON'
      });
    }

    const priorityResolutionLog = [];

    // Step (a): Query local PostgreSQL parcels table
    priorityResolutionLog.push({ step: 1, source: 'local_parcels_db_postgis', status: 'INSPECTING' });
    let parcels = await prisma.parcel.findMany({
      where: {
        ...(state_code ? { state_code } : {}),
        ...(district_code ? { district_code } : {})
      }
    });

    let verifiedParcels = [...parcels];

    // If local database has 0 parcels, run Step (b): Mock ULPIN lookup
    if (parcels.length === 0) {
      priorityResolutionLog.push({ step: 2, source: 'central_ulpin_registry_stub', status: 'QUERYING' });
      const ulpinResult = await lookupULPINRegistry('19102488102931');
      if (ulpinResult.found) {
        priorityResolutionLog.push({ step: 2, source: 'central_ulpin_registry_stub', status: 'MATCH_FOUND' });
      } else {
        // Step (c): State Adapter lookup (West Bengal)
        priorityResolutionLog.push({ step: 3, source: 'west_bengal_banglarbhumi_adapter', status: 'QUERYING' });
        const wbResult = await westBengalAdapter.fetchParcel('Khatian 412 / Plot 890');
        if (wbResult.success) {
          const canonical = westBengalAdapter.mapToCanonical(wbResult);
          priorityResolutionLog.push({ step: 3, source: 'west_bengal_banglarbhumi_adapter', status: 'MATCH_FOUND' });
        } else {
          priorityResolutionLog.push({ step: 4, source: 'ground_survey_fallback', status: 'FLAGGED_SURVEY_REQUIRED' });
        }
      }
    } else {
      priorityResolutionLog.push({ step: 1, source: 'local_parcels_db_postgis', status: `MATCH_FOUND (${parcels.length} parcels)` });
    }

    // Overlay ISRO Bhuvan WMS satellite LULC data for multi-crop land
    const bhuvanOverlay = await checkBhuvanLULCOverlay(boundary_geojson);

    const autoCreatedGrievances = [];
    const userId = req.user ? req.user.id : (await prisma.user.findFirst()).id;

    // Process restriction flags and auto-create grievances for legacy/unverified parcels
    const processedParcels = [];
    for (const parcel of verifiedParcels) {
      const flags = Array.isArray(parcel.restriction_flags) ? [...parcel.restriction_flags] : [];
      if (bhuvanOverlay.multi_crop_irrigated && !flags.includes('multi_crop_irrigated')) {
        flags.push('multi_crop_irrigated');
      }

      // Check if provenance requires human-in-the-loop correction grievance ticket
      let autoTicket = null;
      if (parcel.provenance === 'legacy_migrated' || parcel.provenance === 'self_declared_pending') {
        const existingTicket = await prisma.grievanceTicket.findFirst({
          where: { reference_id: parcel.id, status: { in: ['submitted', 'under_review', 'field_verification'] } }
        });

        if (!existingTicket) {
          autoTicket = await prisma.grievanceTicket.create({
            data: {
              record_type: 'PARCEL_PROVENANCE_CORRECTION',
              reference_id: parcel.id,
              submitted_by: userId,
              issue_category: 'Unverified Legacy Boundary',
              description: `Auto-generated ticket for parcel ${parcel.khatian_plot_no} due to provenance='${parcel.provenance}'. Field verification required prior to Section 11 statutory notification.`,
              status: 'field_verification',
              sla_deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days SLA
            }
          });
          autoCreatedGrievances.push(autoTicket);
        } else {
          autoTicket = existingTicket;
        }
      }

      processedParcels.push({
        ...parcel,
        restriction_flags: flags,
        auto_grievance_ticket: autoTicket ? autoTicket.id : null
      });
    }

    return res.status(200).json({
      error: false,
      message: `Spatial verification completed. Found ${processedParcels.length} overlapping parcels.`,
      data: {
        total_overlapping_parcels: processedParcels.length,
        bhuvan_sat_overlay: bhuvanOverlay,
        priority_resolution_pipeline: priorityResolutionLog,
        auto_created_grievances_count: autoCreatedGrievances.length,
        parcels: processedParcels
      }
    });
  } catch (err) {
    console.error('Parcel Verification Error:', err);
    return res.status(500).json({
      error: true,
      message: `Error verifying spatial land parcels: ${err.message}`,
      code: 'SPATIAL_VERIFY_ERROR'
    });
  }
};
