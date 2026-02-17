import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

// ── IndexedDB Schema ──

interface OfflineDBSchema extends DBSchema {
  dashboard: {
    key: string
    value: { key: string; data: unknown; updatedAt: number }
  }
  orders: {
    key: string
    value: { key: string; data: unknown; updatedAt: number }
  }
  inventory: {
    key: string
    value: { key: string; data: unknown; updatedAt: number }
  }
  notifications: {
    key: string
    value: { key: string; data: unknown; updatedAt: number }
  }
  pendingMutations: {
    key: number
    value: {
      id?: number
      url: string
      method: string
      body?: string
      createdAt: number
      retries: number
    }
    indexes: { 'by-created': number }
  }
}

type StoreName = 'dashboard' | 'orders' | 'inventory' | 'notifications'

const DB_NAME = 'keepdf-offline'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<OfflineDBSchema>> | null = null

export function getDB(): Promise<IDBPDatabase<OfflineDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Data cache stores
        const stores: StoreName[] = ['dashboard', 'orders', 'inventory', 'notifications']
        for (const name of stores) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'key' })
          }
        }
        // Pending mutations queue
        if (!db.objectStoreNames.contains('pendingMutations')) {
          const store = db.createObjectStore('pendingMutations', { keyPath: 'id', autoIncrement: true })
          store.createIndex('by-created', 'createdAt')
        }
      },
    })
  }
  return dbPromise
}

// ── Cache operations ──

export async function getCachedData<T>(store: StoreName, key: string): Promise<T | null> {
  const db = await getDB()
  const entry = await db.get(store, key)
  return entry ? (entry.data as T) : null
}

export async function setCachedData(store: StoreName, key: string, data: unknown): Promise<void> {
  const db = await getDB()
  await db.put(store, { key, data, updatedAt: Date.now() })
}

export async function clearStore(store: StoreName): Promise<void> {
  const db = await getDB()
  await db.clear(store)
}

export async function getCacheAge(store: StoreName, key: string): Promise<number | null> {
  const db = await getDB()
  const entry = await db.get(store, key)
  return entry ? Date.now() - entry.updatedAt : null
}

// ── Pending mutations ──

export async function addPendingMutation(mutation: {
  url: string
  method: string
  body?: string
}): Promise<number> {
  const db = await getDB()
  return db.add('pendingMutations', {
    ...mutation,
    createdAt: Date.now(),
    retries: 0,
  })
}

export async function getPendingMutations() {
  const db = await getDB()
  return db.getAllFromIndex('pendingMutations', 'by-created')
}

export async function removePendingMutation(id: number): Promise<void> {
  const db = await getDB()
  await db.delete('pendingMutations', id)
}

export async function updateMutationRetry(id: number): Promise<void> {
  const db = await getDB()
  const entry = await db.get('pendingMutations', id)
  if (entry) {
    entry.retries += 1
    await db.put('pendingMutations', entry)
  }
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB()
  return db.count('pendingMutations')
}
