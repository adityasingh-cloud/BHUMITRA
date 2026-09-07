import cron from 'node-cron';
import prisma from '../config/db.js';

/**
 * Checks all active project stage history records for SLA deadlines.
 * Flags status = 'at_risk' at 80% elapsed, 'overdue' at 100%+
 */
export const checkProjectSLADeadlines = async () => {
  try {
    const activeHistories = await prisma.projectStageHistory.findMany({
      where: {
        status: { in: ['on_track', 'at_risk'] }
      },
      include: {
        project: true,
        stage: true
      }
    });

    const now = new Date();
    let updatedCount = 0;

    for (const record of activeHistories) {
      const enteredAt = new Date(record.entered_at);
      const slaDeadline = new Date(record.sla_deadline);

      const totalDurationMs = slaDeadline.getTime() - enteredAt.getTime();
      const elapsedMs = now.getTime() - enteredAt.getTime();

      if (totalDurationMs <= 0) continue;

      const percentageConsumed = (elapsedMs / totalDurationMs) * 100;

      let newStatus = record.status;
      if (percentageConsumed >= 100 && record.status !== 'overdue') {
        newStatus = 'overdue';
      } else if (percentageConsumed >= 80 && record.status === 'on_track') {
        newStatus = 'at_risk';
      }

      if (newStatus !== record.status) {
        await prisma.projectStageHistory.update({
          where: { id: record.id },
          data: { status: newStatus }
        });
        updatedCount++;
        console.log(`⏰ SLA Notice: Project '${record.project.name}' Stage '${record.stage.stage_name}' updated to status '${newStatus}' (${Math.round(percentageConsumed)}% consumed).`);
      }
    }

    return { updatedCount, checkedTotal: activeHistories.length };
  } catch (err) {
    console.error('Error during SLA background check:', err);
  }
};

/**
 * Initialize hourly background cron job
 */
export const initCronScheduler = () => {
  // Run SLA check every hour (0 * * * *)
  cron.schedule('0 * * * *', async () => {
    console.log('🔄 Running hourly SLA breach monitor...');
    await checkProjectSLADeadlines();
  });
  console.log('⏰ Hourly SLA Cron Scheduler Initialized.');
};
