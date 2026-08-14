import { defaultExercises } from '@/data/defaultExercises';
import type { Exercise, HistoryImport, SyncQueueItem, TrainingPlan, WorkoutSession } from '@/types';
import { createId } from './id';

const DB_NAME = 'pink-gym-record';
const DB_VERSION = 2;

type StoreName = 'sessions' | 'exercises' | 'historyImports' | 'trainingPlans' | 'syncQueue';

let dbPromise: Promise<IDBDatabase> | undefined;

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sessions')) {
        const store = db.createObjectStore('sessions', { keyPath: 'id' });
        store.createIndex('date', 'date');
        store.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('exercises')) {
        const store = db.createObjectStore('exercises', { keyPath: 'id' });
        store.createIndex('bodyPart', 'bodyPart');
        store.createIndex('name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains('historyImports')) {
        db.createObjectStore('historyImports', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('trainingPlans')) {
        const store = db.createObjectStore('trainingPlans', { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function transaction<T>(storeName: StoreName, mode: IDBTransactionMode, task: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = task(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll<T>(storeName: StoreName) {
  return transaction<T[]>(storeName, 'readonly', (store) => store.getAll());
}

export async function put<T>(storeName: StoreName, value: T) {
  return transaction<IDBValidKey>(storeName, 'readwrite', (store) => store.put(value));
}

export async function remove(storeName: StoreName, key: string) {
  return transaction<undefined>(storeName, 'readwrite', (store) => store.delete(key));
}

export async function ensureDefaultExercises() {
  const existing = await getAll<Exercise>('exercises');
  if (existing.length) return existing;
  await Promise.all(defaultExercises.map((exercise) => put('exercises', exercise)));
  return defaultExercises;
}

export async function saveSession(session: WorkoutSession) {
  await put('sessions', session);
  if (!session.readonly) {
    await enqueueSync('session', session.id);
  }
}

export async function saveHistoryImport(historyImport: HistoryImport) {
  await put('historyImports', historyImport);
  await enqueueSync('historyImport', historyImport.id);
}

export async function saveTrainingPlan(trainingPlan: TrainingPlan) {
  await put('trainingPlans', trainingPlan);
}

export async function enqueueSync(entityType: SyncQueueItem['entityType'], entityId: string) {
  const now = new Date().toISOString();
  await put<SyncQueueItem>('syncQueue', {
    id: createId('sync'),
    entityType,
    entityId,
    action: 'upsert',
    createdAt: now,
  });
}
