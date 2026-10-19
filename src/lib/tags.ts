import type { ParsedAudio } from './metadata'

// 解析器只在 Worker 或降级路径里需要：动态 import 让 music-metadata 不进主包，
// 首屏少下载近 100KB。
async function readDirect(file: File): Promise<ParsedAudio> {
  const { readAudio } = await import('./metadata')
  return readAudio(file)
}

interface Pending {
  resolve: (parsed: ParsedAudio) => void
  reject: (error: Error) => void
}

interface Response {
  id: number
  parsed?: ParsedAudio
  error?: string
}

const POOL_SIZE = 3

/**
 * 一个 Worker 的收发封装。Worker 挂了就把在途请求全部 reject，
 * 调用方会退到主线程解析，不至于整批文件卡死。
 */
class Slot {
  private readonly worker: Worker
  private readonly pending = new Map<number, Pending>()
  private nextId = 1
  private broken = false

  constructor() {
    this.worker = new Worker(new URL('./metadata.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<Response>) => {
      const { id, parsed, error } = event.data
      const entry = this.pending.get(id)
      if (!entry) return
      this.pending.delete(id)
      if (parsed) entry.resolve(parsed)
      else entry.reject(new Error(error ?? '标签解析失败'))
    }
    this.worker.onerror = () => this.fail(new Error('标签解析线程异常退出'))
  }

  get usable(): boolean {
    return !this.broken
  }

  read(file: File): Promise<ParsedAudio> {
    const id = this.nextId
    this.nextId += 1
    return new Promise<ParsedAudio>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ id, file })
    })
  }

  private fail(error: Error): void {
    this.broken = true
    for (const entry of this.pending.values()) entry.reject(error)
    this.pending.clear()
  }

  dispose(): void {
    this.fail(new Error('标签解析线程已关闭'))
    this.worker.terminate()
  }
}

let slots: Slot[] | null = null
let cursor = 0

function getSlots(): Slot[] | null {
  if (slots) return slots.length > 0 ? slots : null
  if (typeof Worker === 'undefined') {
    slots = []
    return null
  }
  try {
    slots = Array.from({ length: POOL_SIZE }, () => new Slot())
  } catch {
    slots = []
    return null
  }
  return slots
}

/**
 * 读标签：优先丢给 Worker 池，环境不支持（测试里的 jsdom）就在当前线程解析。
 * 池是模块级单例，导入 1000 首不会开 1000 个线程。
 */
export async function readTagsQueued(file: File): Promise<ParsedAudio> {
  const pool = getSlots()
  if (!pool) return readDirect(file)

  const slot = pool[cursor % pool.length]
  cursor += 1
  if (!slot || !slot.usable) return readDirect(file)

  try {
    return await slot.read(file)
  } catch {
    return readDirect(file)
  }
}

export function disposeTagWorkers(): void {
  for (const slot of slots ?? []) slot.dispose()
  slots = null
  cursor = 0
}
