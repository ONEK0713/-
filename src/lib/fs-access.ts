import { isAudioFileName } from './format'

/**
 * 目录访问的抽象：Chromium 用 File System Access 拿真实相对路径，
 * 其它浏览器退回 <input webkitdirectory> 的 webkitRelativePath。
 * 注意这里不保存句柄——曲库只活在当前会话里。
 */
export interface FsFile {
  file: File
  /** 相对所选目录的路径，用 / 分隔，替代 webkitRelativePath。 */
  path: string
}

interface DirectoryPickerWindow {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
}

// 明显不是音乐的目录：进了 node_modules 就是把整个前端工程当曲库扫。
const SKIP_DIRS = new Set(['node_modules', '$RECYCLE.BIN', 'System Volume Information', '.Trash'])
const MAX_DEPTH = 12

export function supportsDirectoryPicker(): boolean {
  if (typeof window === 'undefined') return false
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function'
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
