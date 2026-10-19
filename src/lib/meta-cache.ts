import type { TrackTags } from './metadata'

const DB_NAME = 'local-player'
// 保持 3：早期版本的库里已经有 handles 这个 store，版本号降回去会直接 VersionError。
const DB_VERSION = 4
const TAGS = 'tags'
const COVERS = 'covers'
const SOURCES = 'sources'
const SOURCES_KEY = 'library'

/** 曲库由哪些地方来：选过的目录 + 单独选/拖进来的文件。句柄可结构化克隆，能存 IndexedDB。 */
export interface LibrarySources {
  dirs: FileSystemDirectoryHandle[]
  files: FileSystemFileHandle[]
}

export const EMPTY_SOURCES: LibrarySources = { dirs: [], files: [] }

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  const promise = new Promise<IDBDatabase | null>((resolve) => {
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
      if (!db.objectStoreNames.contains(SOURCES)) db.createObjectStore(SOURCES)
    }
    request.onsuccess = () => {
      const db = request.result
      // 别的标签页要升级库时让路；下次调用重新打开，不要拿旧连接一直失败。
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      db.onclose = () => {
        dbPromise = null
      }
      resolve(db)
    }
    // 隐私模式、配额为 0、被别的标签页挡住升级：能播就行。
    // 注意这里要把 dbPromise 清掉，否则一次失败会被记一辈子——封面和标签缓存会一直"失效"。
    const fail = () => {
      dbPromise = null
      resolve(null)
    }
    request.onerror = fail
    request.onblocked = fail
  })
  dbPromise = promise
  return promise
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

export async function readSources(): Promise<LibrarySources | null> {
  const value = await run<LibrarySources | undefined>(SOURCES, 'readonly', (store) => store.get(SOURCES_KEY))
  if (!value || !Array.isArray(value.dirs) || !Array.isArray(value.files)) return null
  return value
}

export async function writeSources(sources: LibrarySources): Promise<void> {
  await run<IDBValidKey>(SOURCES, 'readwrite', (store) => store.put(sources, SOURCES_KEY))
}

export async function clearSources(): Promise<void> {
  await run<undefined>(SOURCES, 'readwrite', (store) => store.delete(SOURCES_KEY))
}
