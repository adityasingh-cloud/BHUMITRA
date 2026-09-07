import axios from 'axios';
import prisma from '../config/db.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * Triggers FastAPI Python ML model to evaluate litigation & delay risk score for a project
 */
export const triggerRiskEvaluation = async (projectId) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        stageHistory: { orderBy: { entered_at: 'desc' }, take: 1, include: { stage: true } },
        projectParcels: { include: { parcel: true } }
      }
    });

    if (!project) return null;

    const currentHistory = project.stageHistory[0];

    // Compute input feature flags for ML model
    let multi_crop_irrigated_flag = 0;
    let is_landbank_parcel = 0;

    for (const pp of project.projectParcels) {
      const flags = Array.isArray(pp.parcel.restriction_flags) ? pp.parcel.restriction_flags : [];
      if (flags.includes('multi_crop_irrigated')) multi_crop_irrigated_flag = 1;
      if (flags.includes('landbank_parcel')) is_landbank_parcel = 1;
    }

    const consent_percentage_collected = currentHistory ? currentHistory.consent_percentage_collected : 50.0;
    const sla_overrun_flag = (currentHistory && (currentHistory.status === 'at_risk' || currentHistory.status === 'overdue')) ? 1 : 0;
    const valuation_gap_pct = 18.5; // Estimated market vs compensation valuation gap %

    const payload = {
      project_id: projectId,
      multi_crop_irrigated_flag,
      consent_percentage_collected,
      valuation_gap_pct,
      is_landbank_parcel,
      sla_overrun_flag,
      district_code: project.district_code || 'WB-HGH'
    };

    let riskResponse = null;
    try {
      const response = await axios.post(`${ML_SERVICE_URL}/predict-risk`, payload, { timeout: 3000 });
      riskResponse = response.data;
    } catch (err) {
      console.warn('⚠️ ML Microservice unreachable, using local fallback risk classifier model:', err.message);

      // Rule-based fallback calculation if Python service is offline
      let score = 25.0;
      if (multi_crop_irrigated_flag === 1) score += 30.0;
      if (consent_percentage_collected < 70) score += 25.0;
      if (sla_overrun_flag === 1) score += 20.0;
      score = Math.min(99.0, Math.max(5.0, score));

      const tier = score > 65 ? 'high' : (score > 35 ? 'medium' : 'low');

      riskResponse = {
        risk_score: score,
        risk_tier: tier,
        top_contributing_factors: [
          { feature: 'multi_crop_irrigated_flag', importance: multi_crop_irrigated_flag === 1 ? 0.45 : 0.05 },
          { feature: 'consent_percentage_collected', importance: consent_percentage_collected < 70 ? 0.35 : 0.10 }
        ]
      };
    }

    // Persist computed risk score into risk_scores table
    const storedScore = await prisma.riskScore.create({
      data: {
        project_id: projectId,
        risk_score: riskResponse.risk_score,
        risk_tier: riskResponse.risk_tier,
        top_contributing_factors: riskResponse.top_contributing_factors
      }
    });

    return storedScore;
  } catch (err) {
    console.error('Error triggering risk evaluation:', err);
    return null;
  }
};
