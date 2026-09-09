/**
 * Module 7: Offline Sync Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Core principle: IndexedDB is the SINGLE source of truth.
 * Every write goes to IndexedDB first. Sync to backend happens in the background
 * and is completely transparent to the user — they never wait for network.
 *
 * Architecture:
 *  1. Any feature calls addToSyncQueue() — writes to IndexedDB sync_queue table.
 *  2. SyncEngine.run() iterates pending items, calls the backend, marks success/failure.
 *  3. On failure: item stays in queue with status='failed', retries counter incremented.
 *  4. Photos sync separately (large blobs, resumable, don't block JSON data sync).
 *  5. Workbox Background Sync ensures retry even when app is closed.
 */
import { v4 as uuidv4 } from 'uuid';
import { db, type DBSyncQueueItem, type SyncType } from '../db/database';
import { useNetworkStore } from '../store/networkStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
const MAX_RETRIES = 5;

// ─── Add item to sync queue ───────────────────────────────────────────────────

export async function addToSyncQueue(
  type: SyncType,
  endpoint: string,
  method: 'POST' | 'PATCH' | 'PUT',
  payload: object,
  clientId?: string
): Promise<string> {
  const id = clientId ?? uuidv4();

  await db.sync_queue.add({
    id,
    type,
    endpoint,
    method,
    payload: { ...payload, client_record_id: id }, // Idempotency key for backend deduplication
    status: 'pending',
    retries: 0,
    created_at: Date.now()
  });

  return id;
}

// ─── Get auth token for API calls ────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  const session = localStorage.getItem('bhumitra_session');
  if (!session) return { 'Content-Type': 'application/json' };
  try {
    const { token } = JSON.parse(session) as { token: string };
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
}

// ─── Sync a single queue item ─────────────────────────────────────────────────

async function syncItem(item: DBSyncQueueItem): Promise<void> {
  await db.sync_queue.update(item.id, { status: 'syncing', last_attempted_at: Date.now() });

  try {
    const res = await fetch(`${API_BASE}${item.endpoint}`, {
      method: item.method,
      headers: getAuthHeaders(),
      body: JSON.stringify(item.payload),
      signal: AbortSignal.timeout(15_000)
    });

    if (res.ok) {
      await db.sync_queue.update(item.id, { status: 'synced' });
    } else if (res.status === 409) {
      // Duplicate detected by backend via client_record_id — treat as success
      await db.sync_queue.update(item.id, { status: 'synced' });
    } else if (res.status >= 400 && res.status < 500) {
      // Client validation error — don't retry, needs human attention
      const body = await res.json().catch(() => ({ message: 'Validation error' }));
      await db.sync_queue.update(item.id, {
        status: 'failed',
        retries: item.retries + 1,
        error_message: `Server error ${res.status}: ${(body as { message: string }).message ?? 'Validation failed'}`
      });
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    const nextRetries = item.retries + 1;
    await db.sync_queue.update(item.id, {
      status: nextRetries >= MAX_RETRIES ? 'failed' : 'pending',
      retries: nextRetries,
      error_message: err instanceof Error ? err.message : 'Network error'
    });
  }
}

// ─── Sync photos separately (don't block JSON data) ──────────────────────────

async function syncPendingPhotos(): Promise<void> {
  const session = localStorage.getItem('bhumitra_session');
  if (!session) return;
  const { token } = JSON.parse(session) as { token: string };

  const pending = await db.photos.where('sync_status').equals('pending').toArray();

  for (const photo of pending) {
    try {
      await db.photos.update(photo.id, { sync_status: 'syncing' });

      const form = new FormData();
      form.append('file', photo.blob, `field_photo_${photo.id}.jpg`);
      form.append('client_record_id', photo.id);
      if (photo.reference_id) form.append('reference_id', photo.reference_id);
      if (photo.reference_type) form.append('record_type', photo.reference_type);
      if (photo.latitude) form.append('latitude', String(photo.latitude));
      if (photo.longitude) form.append('longitude', String(photo.longitude));
      if (photo.accuracy) form.append('gps_accuracy_m', String(photo.accuracy));

      const res = await fetch(`${API_BASE}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }, // DO NOT set Content-Type for FormData
        body: form,
        signal: AbortSignal.timeout(60_000) // 60s for photo uploads
      });

      if (res.ok) {
        const body = await res.json() as { data?: { fileHash?: string } };
        await db.photos.update(photo.id, {
          sync_status: 'synced',
          server_url: body.data?.fileHash ?? photo.id
        });
      } else if (res.status >= 400 && res.status < 500) {
        await db.photos.update(photo.id, { sync_status: 'failed' });
      } else {
        await db.photos.update(photo.id, { sync_status: 'pending' }); // retry later
      }
    } catch {
      await db.photos.update(photo.id, { sync_status: 'pending' }); // network error, retry
    }
  }
}

// ─── Main sync runner ─────────────────────────────────────────────────────────

export async function runSync(): Promise<{
  synced: number;
  failed: number;
  remaining: number;
}> {
  const pendingItems = await db.sync_queue
    .where('status')
    .anyOf(['pending'])
    .toArray();

  let synced = 0;
  let failed = 0;

  for (const item of pendingItems) {
    if (item.retries >= MAX_RETRIES) {
      await db.sync_queue.update(item.id, { status: 'failed' });
      failed++;
      continue;
    }
    await syncItem(item);
    const updated = await db.sync_queue.get(item.id);
    if (updated?.status === 'synced') synced++;
    else if (updated?.status === 'failed') failed++;
  }

  // Sync photos separately
  await syncPendingPhotos();

  const remaining = await db.sync_queue.where('status').anyOf(['pending', 'syncing']).count();

  return { synced, failed, remaining };
}

// ─── Sync queue stats (for the status badge) ─────────────────────────────────

export async function getSyncStats(): Promise<{
  pending: number;
  failed: number;
  synced: number;
  photos_pending: number;
}> {
  const [pending, failed, synced, photos_pending] = await Promise.all([
    db.sync_queue.where('status').equals('pending').count(),
    db.sync_queue.where('status').equals('failed').count(),
    db.sync_queue.where('status').equals('synced').count(),
    db.photos.where('sync_status').anyOf(['pending', 'syncing']).count()
  ]);
  return { pending, failed, synced, photos_pending };
}

// ─── Auto-trigger sync when network returns ───────────────────────────────────

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startSyncMonitor(): void {
  const trySync = async () => {
    const { isOnline } = useNetworkStore.getState();
    if (!isOnline) return;
    const session = localStorage.getItem('bhumitra_session');
    if (!session) return;
    await runSync();
    useNetworkStore.getState().refreshStats();
  };

  // Attempt sync every 30 seconds when app is open
  syncInterval = setInterval(() => { void trySync(); }, 30_000);

  // Sync immediately when coming back online
  window.addEventListener('online', () => { void trySync(); });
}

export function stopSyncMonitor(): void {
  if (syncInterval) clearInterval(syncInterval);
}
