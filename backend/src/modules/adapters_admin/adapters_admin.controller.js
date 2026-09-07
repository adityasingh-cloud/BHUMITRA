import prisma from '../../config/db.js';
import adapterRegistry from '../../adapters/adapter_registry.js';
import { publishStateSyncJob } from '../../services/rabbitmq.service.js';

export const listStateAdapters = async (req, res) => {
  try {
    const dbAdapters = await prisma.stateAdapter.findMany();
    const registeredPlugins = adapterRegistry.listAdapters();

    return res.status(200).json({
      error: false,
      data: {
        total_states_supported: 36,
        active_reference_adapter: 'WB (West Bengal Banglarbhumi)',
        db_adapters: dbAdapters,
        registered_in_memory_plugins: registeredPlugins
      }
    });
  } catch (err) {
    console.error('List Adapters Error:', err);
    return res.status(500).json({
      error: true,
      message: `Error fetching state adapters: ${err.message}`,
      code: 'ADAPTERS_LIST_ERROR'
    });
  }
};

export const triggerStateSync = async (req, res) => {
  try {
    const { state_code } = req.body;
    const targetState = state_code || 'WB';

    const queueReceipt = await publishStateSyncJob(targetState, {
      action: 'FULL_MOUZA_SYNC',
      requested_by: req.user ? req.user.email : 'system'
    });

    await prisma.stateAdapter.updateMany({
      where: { state_code: targetState },
      data: { last_sync_status: 'syncing_in_progress', updated_at: new Date() }
    });

    return res.status(202).json({
      error: false,
      message: `State sync job for '${targetState}' published to RabbitMQ retry-capable queue.`,
      data: queueReceipt
    });
  } catch (err) {
    console.error('Trigger State Sync Error:', err);
    return res.status(500).json({
      error: true,
      message: `Error triggering state adapter sync: ${err.message}`,
      code: 'SYNC_TRIGGER_ERROR'
    });
  }
};
