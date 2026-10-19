import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, MutableRefObject } from 'react'
import { AUDIO_ACCEPT } from '../lib/format'
import {
  collectAudioFiles,
  dropToHandles,
  handlesToFiles,
  pickDirectory,
  pickFiles,
  supportsDirectoryPicker,
  supportsFilePicker,
  type DroppableItem,
} from '../lib/fs-access'
import {
  clearSources,
  readSources,
  writeSources,
  type LibrarySources,
} from '../lib/meta-cache'
import { clearSessionActive, isSessionActive, markSessionActive } from '../lib/session'
import type { Notify } from './useNotice'

/** 来源清单为空时的初值；每次重置都换一个新对象，避免被别处改到。 */
function emptySources(): LibrarySources {
  return { dirs: [], files: [] }
}

interface Options {
  addEntries: (items: { file: File; path: string }[], skipped?: number) => string | null
  addFiles: (input: FileList | File[] | null) => void
  notify: Notify
  /** 清空曲库时 +1，用来丢弃扫描期间被清空的那批文件。 */
  epochRef: MutableRefObject<number>
}

/**
 * 导入入口：选文件夹、选文件、拖拽。
 * 同时记下这些来源的句柄，刷新本页时靠它们把文件重新读出来。
 */
export function useImports({ addEntries, addFiles, notify, epochRef }: Options) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const sourcesRef = useRef<LibrarySources>(emptySources())
  const dragDepthRef = useRef(0)
  const [dragging, setDragging] = useState(false)

  const addEntriesRef = useRef(addEntries)
  addEntriesRef.current = addEntries

  // 非 Chromium：<input webkitdirectory> 只能靠 DOM 属性打开，React 的类型里没有这个 prop。
  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '')
  }, [])

  const rememberSources = useCallback((sources: LibrarySources) => {
    sourcesRef.current = sources
    markSessionActive()
    void writeSources(sources).catch(() => {})
  }, [])

  // 目录导入：Chromium 走 File System Access（拿得到真实相对路径），
  // 其它浏览器退回 <input webkitdirectory>。句柄记下来，刷新时用它把文件读回来。
  const importDirectory = useCallback(async () => {
    if (!supportsDirectoryPicker()) {
      folderInputRef.current?.click()
      return
    }
    try {
      const epoch = epochRef.current
      const handle = await pickDirectory()
      if (!handle) return
      const items = await collectAudioFiles(handle)
      // 扫描期间用户把曲库清空了：这批文件不该再冒出来。
      if (epochRef.current !== epoch) return
      addEntries(items)
      rememberSources({
        ...sourcesRef.current,
        // 同名目录只留最后一次：重选同一个文件夹不该在清单里堆两遍。
        dirs: [...sourcesRef.current.dirs.filter((dir) => dir.name !== handle.name), handle],
      })
    } catch (error) {
      notify(error instanceof Error ? `读取文件夹失败：${error.message}` : '读取文件夹失败')
    }
  }, [addEntries, epochRef, notify, rememberSources])

  // 多选文件：同样优先走句柄，这样刷新后还能读回来。
  const importFiles = useCallback(async () => {
    if (!supportsFilePicker()) {
      fileInputRef.current?.click()
      return
    }
    try {
      const handles = await pickFiles()
      if (!handles || handles.length === 0) return
      const items = await handlesToFiles(handles)
      if (items.length === 0) {
        notify(`没有找到可播放的音频（支持 ${AUDIO_ACCEPT}）`)
        return
      }
      addEntries(items)
      rememberSources({
        ...sourcesRef.current,
        files: [
          ...sourcesRef.current.files.filter(
            (old) => !handles.some((handle) => handle.name === old.name),
          ),
          ...handles,
        ],
      })
    } catch (error) {
      notify(error instanceof Error ? `读取文件失败：${error.message}` : '读取文件失败')
    }
  }, [addEntries, notify, rememberSources])

  // 启动时：只有“这个标签页刷新过”才恢复；重新打开标签页不该把旧曲库捞回来。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!isSessionActive()) {
        await clearSources().catch(() => {})
        return
      }

      const saved = await readSources().catch(() => null)
      if (!saved || cancelled) return

      const items: { file: File; path: string }[] = []
      const dirs: FileSystemDirectoryHandle[] = []
      for (const dir of saved.dirs) {
        try {
          items.push(...(await collectAudioFiles(dir)))
          dirs.push(dir)
        } catch {
          // 目录被删/权限没放行：从清单里去掉，别每次都卡一下。
        }
      }
      items.push(...(await handlesToFiles(saved.files)))

      if (cancelled) return
      // 恢复出来的清单写回去：失效的来源不再重试。
      sourcesRef.current = { dirs, files: saved.files }
      if (dirs.length !== saved.dirs.length) void writeSources(sourcesRef.current)

      if (items.length === 0) {
        notify('上次的曲库读不到了，重新选一次文件夹吧')
        return
      }
      addEntriesRef.current(items)
    })()
    return () => {
      cancelled = true
    }
  }, [notify])

  const handleFileInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      addFiles(event.currentTarget.files)
      event.currentTarget.value = ''
    },
    [addFiles],
  )

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      dragDepthRef.current = 0
      setDragging(false)

      // 拖拽也能拿到句柄（Chromium），拿到就能在刷新后恢复。
      const items = Array.from(event.dataTransfer.items ?? []) as unknown as DroppableItem[]
      const handles = await dropToHandles(items)
      if (handles.length > 0) {
        const dropped = await handlesToFiles(handles)
        if (dropped.length > 0) {
          addEntries(dropped)
          rememberSources({
            ...sourcesRef.current,
            files: [
              ...sourcesRef.current.files.filter(
                (old) => !handles.some((handle) => handle.name === old.name),
              ),
              ...handles,
            ],
          })
          return
        }
      }

      // 拿不到句柄（旧浏览器、或从某些应用里拖）：只能当次可用。
      addFiles(event.dataTransfer.files)
    },
    [addEntries, addFiles, rememberSources],
  )

  /** 清空曲库时一并清掉来源清单，否则刷新会把刚清掉的曲库又捞回来。 */
  const resetSources = useCallback(() => {
    sourcesRef.current = emptySources()
    clearSessionActive()
    void clearSources()
  }, [])

  const dragProps = {
    onDragEnter: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      dragDepthRef.current += 1
      setDragging(true)
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
    },
    onDragLeave: () => {
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) setDragging(false)
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => void handleDrop(event),
  }

  return {
    fileInputRef,
    folderInputRef,
    dragging,
    dragProps,
    handleFileInput,
    importDirectory,
    importFiles,
    resetSources,
  }
}
