import amqp from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const QUEUE_NAME = 'state_adapter_sync_queue';
const RETRY_QUEUE_NAME = 'state_adapter_sync_retry_queue';

let channel = null;
let connection = null;

export const initRabbitMQ = async () => {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertQueue(QUEUE_NAME, { durable: true });
    await channel.assertQueue(RETRY_QUEUE_NAME, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': QUEUE_NAME,
        'x-message-ttl': 5000 // Retry delay 5 seconds
      }
    });

    console.log('🐰 RabbitMQ Connection & State Adapter Queues Initialized.');

    // Start consuming worker messages
    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        const payload = JSON.parse(msg.content.toString());
        console.log(`📩 Processing RabbitMQ State Sync Job [State: ${payload.state_code}]...`);
        try {
          // Simulate async adapter sync execution
          await new Promise((res) => setTimeout(res, 800));
          console.log(`✅ State Adapter Sync Job Completed for ${payload.state_code}.`);
          channel.ack(msg);
        } catch (err) {
          console.warn(`⚠️ State Sync Failed for ${payload.state_code}. Routing to retry queue...`);
          channel.sendToQueue(RETRY_QUEUE_NAME, msg.content, { persistent: true });
          channel.ack(msg);
        }
      }
    });
  } catch (err) {
    console.warn(`⚠️ RabbitMQ Initialization Warning: ${err.message}. (Running in offline fallback mode).`);
  }
};

export const publishStateSyncJob = async (stateCode, payload) => {
  try {
    if (channel) {
      const messageBuffer = Buffer.from(JSON.stringify({ state_code: stateCode, payload, timestamp: new Date() }));
      channel.sendToQueue(QUEUE_NAME, messageBuffer, { persistent: true });
      return { queued: true, broker: 'rabbitmq', queue: QUEUE_NAME };
    }
  } catch (err) {
    console.warn('RabbitMQ publish error:', err.message);
  }

  // Local async queue fallback if broker unreachable
  setTimeout(() => {
    console.log(`[Local Fallback Queue] Executed State Sync Job for ${stateCode}.`);
  }, 1000);

  return { queued: true, broker: 'local_fallback_queue', queue: 'memory' };
};
