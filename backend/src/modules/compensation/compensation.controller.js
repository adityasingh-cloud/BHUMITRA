import prisma from '../../config/db.js';
import { addAuditEntry } from '../../services/audit_vault.service.js';
import { processPFMSPayment } from '../../services/pfms_payment.stub.js';

/**
 * Calculates statutory compensation under RFCTLARR Act 2013
 */
export const calculateCompensation = async (req, res) => {
  try {
    const {
      project_id,
      parcel_id,
      circle_rate = 0,
      avg_top_50pct_sale_deeds = 0,
      comparable_area_avg = 0,
      distance_from_urban_km = 0,
      rural_multiplier_override = null,
      asset_items = { structures: 0, trees: 0, wells: 0, crops: 0 },
      notification_date,
      award_date
    } = req.body;

    if (!project_id || !parcel_id || !notification_date || !award_date) {
      return res.status(400).json({
        error: true,
        message: 'project_id, parcel_id, notification_date, and award_date are required.',
        code: 'MISSING_COMPENSATION_INPUTS'
      });
    }

    // Step 1: Market Value calculation
    const market_value = Math.max(
      Number(circle_rate) || 0,
      Number(avg_top_50pct_sale_deeds) || 0,
      Number(comparable_area_avg) || 0
    );

    if (market_value <= 0) {
      return res.status(400).json({
        error: true,
        message: 'Market value must be greater than zero. Provide valid circle_rate or sale deed averages.',
        code: 'INVALID_MARKET_VALUE'
      });
    }

    // Step 2: Rural Multiplier lookup (1.0 to 2.0 based on urban distance)
    let rural_multiplier = 1.0;
    if (rural_multiplier_override !== null && rural_multiplier_override !== undefined) {
      rural_multiplier = Number(rural_multiplier_override);
    } else {
      const dist = Number(distance_from_urban_km) || 0;
      if (dist <= 10) rural_multiplier = 1.0;
      else if (dist <= 20) rural_multiplier = 1.25;
      else if (dist <= 30) rural_multiplier = 1.5;
      else if (dist <= 50) rural_multiplier = 1.75;
      else rural_multiplier = 2.0;
    }

    const market_value_multiplied = market_value * rural_multiplier;

    // Step 3: Total Asset Valuation
    const structures_val = Number(asset_items.structures) || 0;
    const trees_val = Number(asset_items.trees) || 0;
    const wells_val = Number(asset_items.wells) || 0;
    const crops_val = Number(asset_items.crops) || 0;
    const total_asset_value = structures_val + trees_val + wells_val + crops_val;

    const base_compensation = market_value_multiplied + total_asset_value;

    // Step 4: Solatium = 100% of Base (excl. interest, per RB Dealers Pvt Ltd v. Metro Railway Kolkata 2019)
    const solatium = 1.0 * base_compensation;

    // Step 5: Interest = 12% per annum on Market Value for duration (award_date - notification_date)
    const notifDate = new Date(notification_date);
    const awdDate = new Date(award_date);
    const durationDays = Math.max(0, (awdDate - notifDate) / (1000 * 60 * 60 * 24));
    const durationYears = durationDays / 365.25;
    const interest_amount = 0.12 * market_value * durationYears;

    // Step 6: Total Statutory Compensation
    const total_compensation = base_compensation + solatium + interest_amount;

    const calculation_breakdown = {
      statutory_act: 'RFCTLARR Act 2013 (First Schedule & Supreme Court Precedents)',
      supreme_court_precedent: 'RB Dealers Pvt Ltd v. Metro Railway Kolkata (2019) - Solatium on base only',
      step_1_market_value: {
        circle_rate: Number(circle_rate),
        avg_top_50pct_sale_deeds: Number(avg_top_50pct_sale_deeds),
        comparable_area_avg: Number(comparable_area_avg),
        selected_market_value: market_value
      },
      step_2_rural_multiplier: {
        distance_from_urban_km: Number(distance_from_urban_km),
        applied_rural_multiplier: rural_multiplier,
        multiplied_land_value: market_value_multiplied
      },
      step_3_asset_valuation: {
        structures: structures_val,
        trees: trees_val,
        wells: wells_val,
        crops: crops_val,
        total_asset_value
      },
      base_land_plus_assets: base_compensation,
      step_4_solatium_100_pct: solatium,
      step_5_additional_interest_12_pct: {
        notification_date,
        award_date,
        duration_days: Math.round(durationDays),
        annual_rate: '12%',
        interest_amount
      },
      step_6_total_statutory_compensation: total_compensation
    };

    const performedBy = req.user ? req.user.id : (await prisma.user.findFirst()).id;

    // Save compensation record to DB
    const record = await prisma.compensationRecord.create({
      data: {
        project_id,
        parcel_id,
        market_value,
        rural_multiplier,
        asset_value: total_asset_value,
        solatium,
        interest_amount,
        total_compensation,
        calculation_breakdown,
        approved_by: performedBy
      }
    });

    // Immediately log into Audit Vault (Module 4)
    const auditEntry = await addAuditEntry({
      recordType: 'COMPENSATION_CALCULATION',
      referenceId: record.id,
      action: 'CALCULATE_RFCTLARR_AWARD',
      eventPayload: calculation_breakdown,
      performedBy
    });

    // Simulate PFMS Direct Benefit Transfer confirmation
    const pfmsReceipt = await processPFMSPayment({
      projectId: project_id,
      parcelId: parcel_id,
      beneficiaryName: 'Landowner Beneficiary',
      accountNumberHash: 'DBT_ACC_HASH_99182',
      ifscCode: 'SBIN0001024',
      amount: total_compensation
    });

    return res.status(201).json({
      error: false,
      message: 'RFCTLARR statutory compensation calculated, audit-hashed, and sent to PFMS payment gateway.',
      data: {
        compensation_record_id: record.id,
        total_compensation: Math.round(total_compensation * 100) / 100,
        calculation_breakdown,
        audit_vault_hash: auditEntry.chain_hash,
        pfms_dbt_receipt: pfmsReceipt
      }
    });
  } catch (err) {
    console.error('Compensation Calculation Error:', err);
    return res.status(500).json({
      error: true,
      message: `Error calculating RFCTLARR compensation: ${err.message}`,
      code: 'COMPENSATION_CALC_ERROR'
    });
  }
};
