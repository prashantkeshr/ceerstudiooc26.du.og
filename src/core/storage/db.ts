import { openDB, type IDBPDatabase } from 'idb';
import type { CareerProfile, ProjectEnvelope, StoredAsset } from '../models/types';

// ---------------------------------------------------------------------------
// IndexedDB is used for all substantial data (the profile and projects).
// localStorage is reserved for tiny UI preferences only (see prefs.ts).
// All access is wrapped so the app degrades gracefully when storage is
// unavailable (private mode, blocked, quota exceeded) rather than crashing.
// ---------------------------------------------------------------------------

const DB_NAME = 'career-studio';
const DB_VERSION = 2;
const PROFILE_STORE = 'profiles';
const PROJECT_STORE = 'projects';
const ASSET_STORE = 'assets';

let dbPromise: Promise<IDBPDatabase> | null = null;

export class StorageUnavailableError extends Error {}

function getDB(): Promise<IDBPDatabase> {
  if (!('indexedDB' in globalThis)) {
    return Promise.reject(new StorageUnavailableError('IndexedDB is not available in this browser.'));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PROFILE_STORE)) {
          db.createObjectStore(PROFILE_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(PROJECT_STORE)) {
          const store = db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains(ASSET_STORE)) {
          const store = db.createObjectStore(ASSET_STORE, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt');
        }
      },
    }).catch((err) => {
      dbPromise = null;
      throw new StorageUnavailableError(err?.message ?? 'Could not open local database.');
    });
  }
  return dbPromise;
}

/** True when IndexedDB can actually be opened. Used to show storage status. */
export async function storageAvailable(): Promise<boolean> {
  try {
    await getDB();
    return true;
  } catch {
    return false;
  }
}

// --- Profile ------------------------------------------------------------

export async function loadProfile(): Promise<CareerProfile | null> {
  const db = await getDB();
  return (await db.get(PROFILE_STORE, 'primary')) ?? null;
}

export async function saveProfile(profile: CareerProfile): Promise<void> {
  const db = await getDB();
  await db.put(PROFILE_STORE, { ...profile, updatedAt: Date.now() });
}

// --- Projects -----------------------------------------------------------

export async function listProjects(): Promise<ProjectEnvelope[]> {
  const db = await getDB();
  const all = (await db.getAll(PROJECT_STORE)) as ProjectEnvelope[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<ProjectEnvelope | null> {
  const db = await getDB();
  return (await db.get(PROJECT_STORE, id)) ?? null;
}

export async function saveProject(project: ProjectEnvelope): Promise<void> {
  const db = await getDB();
  await db.put(PROJECT_STORE, project);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(PROJECT_STORE, id);
}

// --- Assets -------------------------------------------------------------

export async function listAssets(): Promise<StoredAsset[]> {
  const db = await getDB();
  const all = (await db.getAll(ASSET_STORE)) as StoredAsset[];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveAsset(asset: StoredAsset): Promise<void> {
  const db = await getDB();
  await db.put(ASSET_STORE, asset);
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(ASSET_STORE, id);
}

/** Replace the entire dataset (used by backup restore). */
export async function replaceAll(
  profile: CareerProfile | null,
  projects: ProjectEnvelope[],
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([PROFILE_STORE, PROJECT_STORE], 'readwrite');
  await tx.objectStore(PROJECT_STORE).clear();
  if (profile) await tx.objectStore(PROFILE_STORE).put(profile);
  for (const p of projects) await tx.objectStore(PROJECT_STORE).put(p);
  await tx.done;
}
