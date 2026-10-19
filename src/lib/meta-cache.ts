import type { TrackTags } from './metadata'

const DB_NAME = 'local-player'
const DB_VERSION = 1
const STORE = 'tags'

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    // 隐私模式、配额为 0 之类的情况：能播就行，缓存失败不算错误。
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null)
          return
        }
        try {
          const transaction = db.transaction(STORE, mode)
          const request = action(transaction.objectStore(STORE))
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => resolve(null)
        } catch {
          resolve(null)
        }
      }),
  )
}

/** 缓存键带上大小和修改时间，文件换了内容自然失效。 */
export function cacheKey(path: string, size: number, lastModified: number): string {
  return `${path}|${size}|${lastModified}`
}

export async function readCachedTags(key: string): Promise<TrackTags | null> {
  const value = await run<TrackTags | undefined>('readonly', (store) => store.get(key))
  return value ?? null
}

export async function writeCachedTags(key: string, tags: TrackTags): Promise<void> {
  await run<IDBValidKey>('readwrite', (store) => store.put(tags, key))
}

export async function clearCachedTags(): Promise<void> {
  await run<undefined>('readwrite', (store) => store.clear())
}
