import { useCallback, useRef, useState } from 'react'
import type { Track } from '../types'
import { AUDIO_ACCEPT, isAudioFileName, stripExtension } from '../lib/format'
import { fileTrackId, fileTrackPath, type ImportEntry } from '../lib/import-entry'
import { mapLimit } from '../lib/concurrency'
import { readTagsQueued } from '../lib/tags'
import {
  cacheKey,
  clearCachedTags,
  hasCover,
  readCachedTags,
  writeCachedTags,
  writeCover,
} from '../lib/meta-cache'
import type { TrackTags } from '../lib/metadata'
import type { NoticeAction } from './useNotice'

/** 同时解析几首；再多也只是多开线程抢 IO，列表填得更慢。 */
const HYDRATE_CONCURRENCY = 3
/** 移除后留多久的撤回窗口；窗口内 blob URL 不回收，撤回来还能直接播。 */
const UNDO_MS = 5000

interface Options {
  notify: (text: string, action?: NoticeAction) => void
}

/**
 * 曲库：保存当前列出的曲目，以及导入、读标签、移除、清空这些会改动它的动作。
 * 只管数据，不碰 <audio>——播放器发现当前曲目没了会自己停。
 */
export function useLibrary({ notify }: Options) {
  const [tracks, setTracks] = useState<Track[]>([])
  const objectUrlsRef = useRef<string[]>([])
  /** 清空一次 +1，用来废弃还在路上的异步解析结果。 */
  const libraryEpochRef = useRef(0)
  const pendingUndoRef = useRef<{ track: Track; index: number } | null>(null)
  const undoTimerRef = useRef<number | null>(null)

  const patchTrack = useCallback((id: string, patch: Partial<Track>) => {
    setTracks((prev) => prev.map((track) => (track.id === id ? { ...track, ...patch } : track)))
  }, [])

  const releaseUrl = useCallback((url: string) => {
    URL.revokeObjectURL(url)
    objectUrlsRef.current = objectUrlsRef.current.filter((item) => item !== url)
  }, [])

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
  }, [])

  // 读标签：先命中 IndexedDB 缓存，没有才丢进 Worker 池；每读完一首就把那一行填上，
  // 不阻塞列表（导入 1000 首时列表先出现，标签慢慢长出来）。
  const hydrateTags = useCallback(
    async (entries: ImportEntry[]) => {
      const total = entries.length
      // 清空曲库会 +1：读标签是异步的，别让它在清空后又把提示改回“已导入”。
      const epoch = libraryEpochRef.current
      const stale = () => libraryEpochRef.current !== epoch
      let done = 0
      let failed = 0

      const patch = (id: string, next: Partial<Track>) => {
        if (stale()) return
        patchTrack(id, next)
      }

      await mapLimit(entries, HYDRATE_CONCURRENCY, async (entry) => {
        let tags: TrackTags | null = null
        try {
          const key = cacheKey(entry.path, entry.file.size, entry.file.lastModified)
          tags = await readCachedTags(key)
          if (tags) {
            // 两处缓存可能对不上：
            // 一是老版本写下的条目里根本没有 coverHash 字段，二是条目说有封面但封面库查不到图
            // （清过缓存、换过浏览器配置、升级被别的标签页挡住）。两种情况都当没缓存，重读文件。
            const legacyEntry = !('coverHash' in tags)
            const coverLost = Boolean(tags.coverHash) && !(await hasCover(tags.coverHash as string))
            if (legacyEntry || coverLost) tags = null
          }
          if (!tags) {
            const parsed = await readTagsQueued(entry.file)
            tags = parsed.tags
            // 封面单独按内容指纹存，同一张图只落一份；标签里只留指纹。
            if (parsed.cover && !(await hasCover(parsed.cover.hash))) {
              await writeCover(parsed.cover.hash, parsed.cover.blob)
            }
            void writeCachedTags(key, tags)
          }
        } catch {
          tags = null
        }

        if (tags) {
          patch(entry.id, {
            // 标签里没有标题（有些碟只有文件名）就保留文件名。
            title: tags.title || stripExtension(entry.file.name),
            artist: tags.artist,
            album: tags.album,
            duration: tags.duration,
            coverHash: tags.coverHash,
            tagState: 'ready',
          })
        } else {
          failed += 1
          patch(entry.id, { tagState: 'failed' })
        }

        done += 1
        if (stale()) return
        if (done === total) {
          notify(
            failed > 0
              ? `已导入 ${total} 首，${failed} 首读不到标签，先用文件名显示`
              : `已导入 ${total} 首`,
          )
        } else if (done % 5 === 0) {
          notify(`正在读标签 ${done}/${total}`)
        }
      })
    },
    [notify, patchTrack],
  )

  // 所有导入最终都走这里：占位行先上，标签后填。
  const addEntries = useCallback(
    (items: { file: File; path: string }[], skipped = 0): string | null => {
      if (items.length === 0) {
        notify(`没有找到可播放的音频（支持 ${AUDIO_ACCEPT}）`)
        return null
      }

      const known = new Set(tracks.map((track) => track.id))
      const entries: ImportEntry[] = []
      const placeholders: Track[] = []
      for (const { file, path } of items) {
        const id = fileTrackId(path, file)
        if (known.has(id)) continue
        known.add(id)
        const src = URL.createObjectURL(file)
        objectUrlsRef.current.push(src)
        entries.push({ file, path, id })
        placeholders.push({
          id,
          path,
          title: stripExtension(file.name),
          artist: '',
          album: '',
          duration: 0,
          src,
          coverHash: null,
          tagState: 'pending',
        })
      }

      if (placeholders.length === 0) {
        notify('这些歌曲已经在列表里了')
        return null
      }

      // 先插占位行再读标签：等全部解析完再显示，导入几十首时会有几秒白屏。
      setTracks((prev) => [...prev, ...placeholders])

      const parts = [`已导入 ${placeholders.length} 首`]
      if (skipped > 0) parts.push(`跳过 ${skipped} 个不支持的文件`)
      notify(`${parts.join('，')}，正在读标签…`)

      void hydrateTags(entries)
      return placeholders[0]?.id ?? null
    },
    [hydrateTags, notify, tracks],
  )

  // 导入就是导入：同一批文件重复选只会去重，不会因为“以前移除过”而拦下来。
  const addFiles = useCallback(
    (input: FileList | File[] | null) => {
      if (!input) return
      const files = Array.from(input)
      const audio = files.filter((file) => isAudioFileName(file.name))
      const items = audio.map((file) => ({ file, path: fileTrackPath(file) }))
      addEntries(items, files.length - audio.length)
    },
    [addEntries],
  )

  // 撤销移除：把歌按原位置放回去。
  const undoRemove = useCallback(
    (track: Track, index: number) => {
      clearUndoTimer()
      setTracks((prev) => {
        if (prev.some((item) => item.id === track.id)) return prev
        const next = [...prev]
        next.splice(Math.max(0, Math.min(index, next.length)), 0, track)
        return next
      })
      pendingUndoRef.current = null
      notify(`已恢复《${track.title}》`)
    },
    [clearUndoTimer, notify],
  )

  // 从曲库移除：只丢内存里的这一条，磁盘上的文件不动，也不再记“别再导入”——
  // 下次选到它照样正常导入。
  const removeTrack = useCallback(
    (track: Track) => {
      const index = tracks.findIndex((item) => item.id === track.id)

      // 上一首被移除的如果还没撤销，它的 blob URL 现在可以真正回收了。
      const stale = pendingUndoRef.current
      if (stale && stale.track.id !== track.id) {
        clearUndoTimer()
        releaseUrl(stale.track.src)
        pendingUndoRef.current = null
      }

      setTracks((prev) => prev.filter((item) => item.id !== track.id))

      const at = Math.max(0, index)
      pendingUndoRef.current = { track, index: at }
      clearUndoTimer()
      undoTimerRef.current = window.setTimeout(() => {
        releaseUrl(track.src)
        pendingUndoRef.current = null
        undoTimerRef.current = null
      }, UNDO_MS)

      notify(`已移除《${track.title}》，源文件没动`, {
        label: '撤销',
        onClick: () => undoRemove(track, at),
      })
    },
    [clearUndoTimer, notify, releaseUrl, tracks, undoRemove],
  )

  /** 清空曲库：内存、blob URL、标签缓存一起丢。来源清单与会话标记归 App 管。 */
  const clearLibrary = useCallback(() => {
    libraryEpochRef.current += 1
    clearUndoTimer()
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
    pendingUndoRef.current = null
    setTracks([])
    void clearCachedTags()
    notify('曲库已清空，源文件没动')
  }, [clearUndoTimer, notify])

  return {
    tracks,
    objectUrlsRef,
    libraryEpochRef,
    addEntries,
    addFiles,
    removeTrack,
    undoRemove,
    clearLibrary,
    patchTrack,
  }
}
