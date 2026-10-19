import type { TrackTags } from './metadata'

const DB_NAME = 'local-player'
const DB_VERSION = 3
const TAGS = 'tags'
const COVERS = 'covers'
const HANDLES = 'handles'
const LIBRARY_HANDLE_KEY = 'library-root'

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
      // 每个 store 单独判断：老版本升级时只补缺的那个。
      if (!db.objectStoreNames.contains(TAGS)) db.createObjectStore(TAGS)
      if (!db.objectStoreNames.contains(COVERS)) db.createObjectStore(COVERS)
      if (!db.objectStoreNames.contains(HANDLES)) db.createObjectStore(HANDLES)
    }
    request.onsuccess = () => resolve(request.result)
    // 隐私模式、配额为 0 之类的情况：能播就行，缓存失败不算错误。
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
  return dbPromise
}

function run<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null)
          return
        }
        try {
          const transaction = db.transaction(storeName, mode)
          const request = action(transaction.objectStore(storeName))
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
  const value = await run<TrackTags | undefined>(TAGS, 'readonly', (store) => store.get(key))
  return value ?? null
}

export async function writeCachedTags(key: string, tags: TrackTags): Promise<void> {
  await run<IDBValidKey>(TAGS, 'readwrite', (store) => store.put(tags, key))
}

export async function clearCachedTags(): Promise<void> {
  await run<undefined>(TAGS, 'readwrite', (store) => store.clear())
}

// 封面按内容指纹存：同一张封面被 9 首歌引用，也只落一份（实测那张 136KB 的图每首存了两遍）。
export async function readCover(hash: string): Promise<Blob | null> {
  const value = await run<Blob | undefined>(COVERS, 'readonly', (store) => store.get(hash))
  return value ?? null
}

export async function writeCover(hash: string, blob: Blob): Promise<void> {
  await run<IDBValidKey>(COVERS, 'readwrite', (store) => store.put(blob, hash))
}

export async function hasCover(hash: string): Promise<boolean> {
  const count = await run<number>(COVERS, 'readonly', (store) => store.count(hash))
  return (count ?? 0) > 0
}

// 目录句柄可以结构化克隆进 IndexedDB：下次打开时还能拿回来，只是可能要再要一次授权。
export async function readLibraryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const value = await run<FileSystemDirectoryHandle | undefined>(HANDLES, 'readonly', (store) =>
    store.get(LIBRARY_HANDLE_KEY),
  )
  return value ?? null
}

export async function writeLibraryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await run<IDBValidKey>(HANDLES, 'readwrite', (store) => store.put(handle, LIBRARY_HANDLE_KEY))
}

export async function clearLibraryHandle(): Promise<void> {
  await run<undefined>(HANDLES, 'readwrite', (store) => store.delete(LIBRARY_HANDLE_KEY))
}
