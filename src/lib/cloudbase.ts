import type { HistoryImport, SyncQueueItem, WorkoutSession } from '@/types';
import { getAll, put, remove } from './storage';

const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID as string | undefined;
const region = (import.meta.env.VITE_CLOUDBASE_REGION as string | undefined) || 'ap-shanghai';
const sdkUrl =
  (import.meta.env.VITE_CLOUDBASE_SDK_URL as string | undefined) || 'https://static.cloudbase.net/tcb-js-sdk/1.10.10/tcb.js';
const sessionCollection = (import.meta.env.VITE_CLOUDBASE_SESSION_COLLECTION as string | undefined) || 'workout_sessions';
const historyCollection = (import.meta.env.VITE_CLOUDBASE_HISTORY_COLLECTION as string | undefined) || 'history_imports';

interface CloudBaseCollection {
  add(data: Record<string, unknown>): Promise<unknown>;
  where(query: Record<string, unknown>): {
    get(): Promise<{ data?: Array<Record<string, unknown>> }>;
    update?(data: Record<string, unknown>): Promise<unknown>;
  };
}

interface CloudBaseApp {
  auth(): {
    signInAnonymously(): Promise<unknown>;
  };
  database(): {
    collection(name: string): CloudBaseCollection;
  };
}

interface CloudBaseGlobal {
  init(config: { env: string; region?: string }): CloudBaseApp;
}

declare global {
  interface Window {
    cloudbase?: CloudBaseGlobal;
  }
}

export function isCloudBaseConfigured() {
  return Boolean(envId);
}

async function createCloudBaseApp(): Promise<CloudBaseApp> {
  if (!envId) throw new Error('CloudBase is not configured');
  if (!window.cloudbase) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = sdkUrl;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('CloudBase SDK 加载失败'));
      document.head.appendChild(script);
    });
  }
  if (!window.cloudbase) throw new Error('CloudBase SDK 未初始化');
  return window.cloudbase.init({ env: envId, region });
}

async function upsert(collection: CloudBaseCollection, localId: string, data: Record<string, unknown>) {
  const existing = await collection.where({ localId }).get();
  if (existing.data?.length && collection.where({ localId }).update) {
    await collection.where({ localId }).update?.(data);
    return;
  }
  await collection.add({ ...data, localId });
}

export async function syncPendingChanges() {
  if (!envId) {
    return { ok: false, message: '未配置 CloudBase，当前为纯本地模式。' };
  }

  const app = await createCloudBaseApp();
  await app.auth().signInAnonymously();
  const db = app.database();
  const sessions = await getAll<WorkoutSession>('sessions');
  const historyImports = await getAll<HistoryImport>('historyImports');
  const queue = await getAll<SyncQueueItem>('syncQueue');

  for (const item of queue) {
    try {
      if (item.entityType === 'session') {
        const session = sessions.find((candidate) => candidate.id === item.entityId);
        if (session) {
          await upsert(db.collection(sessionCollection), session.id, { ...session, syncedAt: new Date().toISOString() });
          await put('sessions', { ...session, syncedAt: new Date().toISOString() });
        }
      }
      if (item.entityType === 'historyImport') {
        const history = historyImports.find((candidate) => candidate.id === item.entityId);
        if (history) {
          await upsert(db.collection(historyCollection), history.id, history as unknown as Record<string, unknown>);
        }
      }
      await remove('syncQueue', item.id);
    } catch (error) {
      await put('syncQueue', { ...item, lastError: error instanceof Error ? error.message : String(error) });
    }
  }

  const remaining = await getAll<SyncQueueItem>('syncQueue');
  return {
    ok: remaining.length === 0,
    message: remaining.length ? `还有 ${remaining.length} 条待同步。` : '同步完成。',
  };
}
