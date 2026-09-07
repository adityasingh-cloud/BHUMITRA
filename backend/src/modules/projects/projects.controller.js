import prisma from '../../config/db.js';
import { triggerRiskEvaluation } from '../../services/risk_bridge.service.js';

export const createProject = async (req, res) => {
  try {
    const { name, purpose, boundary_geojson, state_code, district_code } = req.body;

    if (!name || !purpose || !boundary_geojson) {
      return res.status(400).json({
        error: true,
        message: 'name, purpose, and boundary_geojson are required.',
        code: 'MISSING_PROJECT_FIELDS'
      });
    }

    const requiring_body_id = req.user ? req.user.id : (await prisma.user.findFirst()).id;

    // Fetch initial 'Proposal' workflow stage
    const proposalStage = await prisma.workflowStage.findFirst({
      where: { stage_order: 1 }
    });

    if (!proposalStage) {
      return res.status(500).json({
        error: true,
        message: 'Initial workflow stage Proposal not found. Ensure database seed script is executed.',
        code: 'STAGE_NOT_FOUND'
      });
    }

    const project = await prisma.project.create({
      data: {
        name,
        requiring_body_id,
        purpose,
        boundary_geojson,
        state_code: state_code || 'WB',
        district_code: district_code || 'WB-HGH',
        current_stage_id: proposalStage.id
      }
    });

    // Compute SLA deadline date based on statutory_duration_days
    const slaDeadline = new Date(Date.now() + proposalStage.statutory_duration_days * 24 * 60 * 60 * 1000);

    const history = await prisma.projectStageHistory.create({
      data: {
        project_id: project.id,
        stage_id: proposalStage.id,
        sla_deadline: slaDeadline,
        status: 'on_track',
        consent_percentage_collected: 0.0
      }
    });

    // Auto-trigger ML risk evaluation
    const initialRisk = await triggerRiskEvaluation(project.id);

    return res.status(201).json({
      error: false,
      message: 'Project created successfully and initialized at Proposal stage.',
      data: {
        project,
        stage_history: history,
        initial_risk_score: initialRisk
      }
    });
  } catch (err) {
    console.error('Project Creation Error:', err);
    return res.status(500).json({
      error: true,
      message: `Error creating project: ${err.message}`,
      code: 'PROJECT_CREATE_ERROR'
    });
  }
};

export const advanceStage = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: { currentStage: true }
    });

    if (!project) {
      return res.status(404).json({
        error: true,
        message: `Project with ID ${id} not found.`,
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const nextStageOrder = project.currentStage.stage_order + 1;
    const nextStage = await prisma.workflowStage.findFirst({
      where: { stage_order: nextStageOrder }
    });

    if (!nextStage) {
      return res.status(400).json({
        error: true,
        message: 'Project is already at the final statutory stage (R&R).',
        code: 'FINAL_STAGE_REACHED'
      });
    }

    // Mark previous stage as completed
    await prisma.projectStageHistory.updateMany({
      where: { project_id: id, stage_id: project.currentStage.id, status: { not: 'completed' } },
      data: { status: 'completed' }
    });

    // Update project current_stage_id
    const updatedProject = await prisma.project.update({
      where: { id },
      data: { current_stage_id: nextStage.id }
    });

    // Calculate next SLA deadline
    const slaDeadline = new Date(Date.now() + nextStage.statutory_duration_days * 24 * 60 * 60 * 1000);

    const newHistory = await prisma.projectStageHistory.create({
      data: {
        project_id: id,
        stage_id: nextStage.id,
        sla_deadline: slaDeadline,
        status: 'on_track',
        consent_percentage_collected: 75.0 // Default baseline consent
      }
    });

    // Trigger ML Re-scoring
    const updatedRisk = await triggerRiskEvaluation(id);

    return res.status(200).json({
      error: false,
      message: `Project advanced to stage '${nextStage.stage_name}'. Next SLA deadline set for ${slaDeadline.toISOString().split('T')[0]}.`,
      data: {
        project: updatedProject,
        current_stage: nextStage,
        stage_history: newHistory,
        updated_risk_score: updatedRisk
      }
    });
  } catch (err) {
    console.error('Advance Stage Error:', err);
    return res.status(500).json({
      error: true,
      message: `Error advancing project stage: ${err.message}`,
      code: 'STAGE_ADVANCE_ERROR'
    });
  }
};

export const getProjectStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        currentStage: true,
        stageHistory: { orderBy: { entered_at: 'desc' }, include: { stage: true } },
        riskScores: { orderBy: { computed_at: 'desc' }, take: 1 }
      }
    });

    if (!project) {
      return res.status(404).json({
        error: true,
        message: `Project with ID ${id} not found.`,
        code: 'PROJECT_NOT_FOUND'
      });
    }

    const activeHistory = project.stageHistory[0];
    const now = new Date();
    const enteredAt = activeHistory ? new Date(activeHistory.entered_at) : now;
    const slaDeadline = activeHistory ? new Date(activeHistory.sla_deadline) : now;

    const daysElapsed = Math.round((now.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24));
    const totalDurationDays = Math.max(1, Math.round((slaDeadline.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24)));
    const slaPercentageConsumed = Math.min(100.0, Math.round(((now.getTime() - enteredAt.getTime()) / (slaDeadline.getTime() - enteredAt.getTime())) * 100));

    return res.status(200).json({
      error: false,
      data: {
        project_id: project.id,
        project_name: project.name,
        current_stage: project.currentStage.stage_name,
        stage_order: project.currentStage.stage_order,
        statutory_duration_days: project.currentStage.statutory_duration_days,
        days_elapsed: daysElapsed,
        sla_deadline: slaDeadline,
        sla_percentage_consumed: slaPercentageConsumed,
        sla_status: activeHistory ? activeHistory.status : 'on_track',
        consent_percentage_collected: activeHistory ? activeHistory.consent_percentage_collected : 0,
        latest_risk_score: project.riskScores[0] || null
      }
    });
  } catch (err) {
    console.error('Get Project Status Error:', err);
    return res.status(500).json({
      error: true,
      message: `Error retrieving project status: ${err.message}`,
      code: 'PROJECT_STATUS_ERROR'
    });
  }
};

export const updateConsent = async (req, res) => {
  try {
    const { id } = req.params;
    const { consent_percentage_collected } = req.body;

    if (consent_percentage_collected === undefined || consent_percentage_collected < 0 || consent_percentage_collected > 100) {
      return res.status(400).json({
        error: true,
        message: 'consent_percentage_collected must be a number between 0 and 100.',
        code: 'INVALID_CONSENT'
      });
    }

    const latestHistory = await prisma.projectStageHistory.findFirst({
      where: { project_id: id },
      orderBy: { entered_at: 'desc' }
    });

    if (!latestHistory) {
      return res.status(404).json({
        error: true,
        message: 'Stage history not found for project.',
        code: 'HISTORY_NOT_FOUND'
      });
    }

    const updatedHistory = await prisma.projectStageHistory.update({
      where: { id: latestHistory.id },
      data: { consent_percentage_collected: Number(consent_percentage_collected) }
    });

    // Re-trigger Risk Score Evaluation
    const updatedRisk = await triggerRiskEvaluation(id);

    return res.status(200).json({
      error: false,
      message: `SIA consent percentage updated to ${consent_percentage_collected}%. Delay risk re-evaluated.`,
      data: {
        stage_history: updatedHistory,
        updated_risk_score: updatedRisk
      }
    });
  } catch (err) {
    console.error('Update Consent Error:', err);
    return res.status(500).json({
      error: true,
      message: `Error updating consent percentage: ${err.message}`,
      code: 'CONSENT_UPDATE_ERROR'
    });
  }
};

export const getProjectRisk = async (req, res) => {
  try {
    const { id } = req.params;

    const riskScore = await prisma.riskScore.findFirst({
      where: { project_id: id },
      orderBy: { computed_at: 'desc' }
    });

    if (!riskScore) {
      // Re-trigger evaluation on demand if missing
      const freshlyComputed = await triggerRiskEvaluation(id);
      if (!freshlyComputed) {
        return res.status(404).json({
          error: true,
          message: `No risk score found for project ${id}.`,
          code: 'RISK_SCORE_NOT_FOUND'
        });
      }
      return res.status(200).json({ error: false, data: freshlyComputed });
    }

    return res.status(200).json({
      error: false,
      data: riskScore
    });
  } catch (err) {
    console.error('Get Project Risk Error:', err);
    return res.status(500).json({
      error: true,
      message: `Error fetching risk score: ${err.message}`,
      code: 'RISK_FETCH_ERROR'
    });
  }
};
