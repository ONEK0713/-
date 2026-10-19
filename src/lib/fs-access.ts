import { isAudioFileName } from './format'

/**
 * 文件访问的抽象：Chromium 用 File System Access 拿真实相对路径和可持久化的句柄，
 * 其它浏览器退回 <input> / webkitdirectory 给的 File（只在当前页面有效）。
 */
export interface FsFile {
  file: File
  /** 相对所选目录的路径，用 / 分隔，替代 webkitRelativePath。 */
  path: string
}

interface DirectoryPickerWindow {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
}

interface FilePickerWindow {
  showOpenFilePicker?: (options?: {
    multiple?: boolean
    types?: { description: string; accept: Record<string, string[]> }[]
  }) => Promise<FileSystemFileHandle[]>
}

/** 拖拽项上的 getAsFileSystemHandle 还没进 lib.dom 的类型定义。 */
export interface DroppableItem {
  kind: string
  getAsFileSystemHandle?: () => Promise<FileSystemFileHandle | null>
}

// 明显不是音乐的目录：进了 node_modules 就是把整个前端工程当曲库扫。
const SKIP_DIRS = new Set(['node_modules', '$RECYCLE.BIN', 'System Volume Information', '.Trash'])
const MAX_DEPTH = 12

export function supportsDirectoryPicker(): boolean {
  if (typeof window === 'undefined') return false
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function'
}

export function supportsFilePicker(): boolean {
  if (typeof window === 'undefined') return false
  return typeof (window as FilePickerWindow).showOpenFilePicker === 'function'
}

/** 弹出目录选择器；用户取消返回 null，其它错误原样抛给调用方。 */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker
  if (!picker) return null
  try {
    return await picker.call(window, { mode: 'read' })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null
    throw error
  }
}

/** 弹出文件选择器（可多选）；用户取消返回 null。 */
export async function pickFiles(): Promise<FileSystemFileHandle[] | null> {
  const picker = (window as FilePickerWindow).showOpenFilePicker
  if (!picker) return null
  try {
    return await picker.call(window, { multiple: true })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null
    throw error
  }
}

/**
 * 从句柄取回 File。文件被删/移动会抛 NotFoundError，权限过期会抛 NotAllowedError——
 * 两种情况都返回 null，交给调用方决定要不要提示。
 */
export async function handleToFile(handle: FileSystemFileHandle): Promise<File | null> {
  try {
    return await handle.getFile()
  } catch {
    return null
  }
}

/** 拖拽进来的文件转成句柄；浏览器不支持或不是文件项时跳过。 */
export async function dropToHandles(items: DroppableItem[]): Promise<FileSystemFileHandle[]> {
  const handles: FileSystemFileHandle[] = []
  for (const item of items) {
    if (item.kind !== 'file' || !item.getAsFileSystemHandle) continue
    try {
      const handle = await item.getAsFileSystemHandle()
      if (handle) handles.push(handle)
    } catch {
      // 单个文件拿不到句柄不影响其它的，退回 File 那条路即可。
    }
  }
  return handles
}

/** 松散的句柄（多选文件）读成可播放的条目，非音频在调用方过滤即可。 */
export async function handlesToFiles(handles: FileSystemFileHandle[]): Promise<FsFile[]> {
  const out: FsFile[] = []
  for (const handle of handles) {
    const file = await handleToFile(handle)
    if (!file || !isAudioFileName(file.name)) continue
    out.push({ file, path: file.name })
  }
  return out
}

async function walk(
  dir: FileSystemDirectoryHandle,
  base: string,
  out: FsFile[],
  depth: number,
): Promise<void> {
  if (depth > MAX_DEPTH) return
  for await (const entry of dir.values()) {
    const name = entry.name
    // macOS 的 ._xxx、.DS_Store、以及各种隐藏目录，扫进来只会污染列表。
    if (name.startsWith('.')) continue

    if (entry.kind === 'directory') {
      if (SKIP_DIRS.has(name)) continue
      await walk(entry as FileSystemDirectoryHandle, base ? `${base}/${name}` : name, out, depth + 1)
      continue
    }

    if (!isAudioFileName(name)) continue
    const file = await (entry as FileSystemFileHandle).getFile()
    out.push({ file, path: base ? `${base}/${name}` : name })
  }
}

/** 递归收集目录下的音频文件，路径用 / 拼好。 */
export async function collectAudioFiles(handle: FileSystemDirectoryHandle): Promise<FsFile[]> {
  const out: FsFile[] = []
  await walk(handle, '', out, 0)
  return out
}
