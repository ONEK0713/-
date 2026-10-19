import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import ImportMenu from './components/ImportMenu'
import PlayerBar from './components/PlayerBar'
import TopBar from './components/TopBar'
import TrackList from './components/TrackList'
import { AUDIO_ACCEPT, isAudioFileName, stripExtension } from './lib/format'
import { mapLimit } from './lib/concurrency'
import {
  cacheKey,
  clearCachedTags,
  clearLibraryHandle,
  hasCover,
  readCachedTags,
  readLibraryHandle,
  writeCachedTags,
  writeCover,
  writeLibraryHandle,
} from './lib/meta-cache'
import { collectAudioFiles, ensurePermission, pickDirectory, supportsDirectoryPicker } from './lib/fs-access'
import type { TrackTags } from './lib/metadata'
import { readTagsQueued } from './lib/tags'
import type { Track } from './types'

interface Notice {
  text: string
  action?: { label: string; onClick: () => void }
}

interface ImportEntry {
  file: File
  path: string
  id: string
}

// 浏览器不给真实路径：选文件夹时把 webkitRelativePath 当相对路径，多选文件就退回文件名。
function fileTrackPath(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  return relative && relative.length > 0 ? relative : file.name
}

// 指纹带上相对路径：不同文件夹里的两个 01.mp3 不会被当成同一首。
function fileTrackId(path: string, file: File): string {
  return `${path}|${file.size}|${file.lastModified}`
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.7)
  const [query, setQuery] = useState('')
  const [dragging, setDragging] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  // 上次导入过的目录句柄：有它就能在重启后把曲库拿回来（用户点一下授权即可）。
  const [savedHandle, setSavedHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [needsGrant, setNeedsGrant] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const objectUrlsRef = useRef<string[]>([])
  const dragDepthRef = useRef(0)
  // 刚移除、还能撤销的那一首。撤销窗口内不回收 blob URL，否则撤销回来也放不了。
  const pendingUndoRef = useRef<{ track: Track; index: number } | null>(null)
  // 曲库"代"：清空时 +1，正在跑的标签解析据此判断自己已经过期。
  const libraryEpochRef = useRef(0)

  // webkitdirectory 不在 React 的 props 类型里，直接打属性最省事。
  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '')
  }, [])

  // 卸载时兜底回收；单曲移除时已经就地 revoke 过了，这里只处理剩下的。
  useEffect(() => {
    const urls = objectUrlsRef.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('is-paused', !playing)
  }, [playing])

  const notify = useCallback((text: string, action?: Notice['action']) => {
    setNotice(action ? { text, action } : { text })
  }, [])

  useEffect(() => {
    if (!notice) {
      // 提示消失 = 撤销窗口关闭，这时才真正回收刚移除那首的 blob URL。
      const pending = pendingUndoRef.current
      if (pending) {
        URL.revokeObjectURL(pending.track.src)
        pendingUndoRef.current = null
      }
      return
    }
    // 带"撤销"的提示多留一会儿：3.2 秒读完再挪鼠标去点，来不及。
    const timer = window.setTimeout(() => setNotice(null), notice.action ? 5000 : 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!confirmClear) return
    const timer = window.setTimeout(() => setConfirmClear(false), 3000)
    return () => window.clearTimeout(timer)
  }, [confirmClear])

  const currentIndex = useMemo(
    () => tracks.findIndex((track) => track.id === currentId),
    [tracks, currentId],
  )
  const current = currentIndex >= 0 ? (tracks[currentIndex] ?? null) : null

  const visibleTracks = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return tracks
    return tracks.filter((track) =>
      `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(keyword),
    )
  }, [tracks, query])

  const playTrack = useCallback(
    (track: Track | undefined) => {
      const audio = audioRef.current
      if (!audio || !track) return
      if (audio.src !== track.src) {
        audio.src = track.src
        setElapsed(0)
        setDuration(track.duration)
      }
      audio.volume = volume
      setCurrentId(track.id)
      void audio.play().catch(() => {
        setPlaying(false)
        notify('播放失败：浏览器可能不支持这个格式，或自动播放被拦截')
      })
    },
    [notify, volume],
  )

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.src) {
      playTrack(current ?? tracks[0])
      return
    }
    if (audio.paused) {
      void audio.play().catch(() => notify('播放失败：请再点一次播放'))
    } else {
      audio.pause()
    }
  }, [current, notify, playTrack, tracks])

  const step = useCallback(
    (delta: number) => {
      if (tracks.length === 0) return
      const base = currentIndex < 0 ? (delta > 0 ? -1 : 0) : currentIndex
      const next = tracks[base + delta]
      if (!next) {
        audioRef.current?.pause()
        notify(delta > 0 ? '已经是最后一首' : '已经是第一首')
        return
      }
      playTrack(next)
    },
    [currentIndex, notify, playTrack, tracks],
  )

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = seconds
    setElapsed(seconds)
  }, [])

  const changeVolume = useCallback((next: number) => {
    setVolume(next)
    if (audioRef.current) audioRef.current.volume = next
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
        setTracks((prev) => prev.map((track) => (track.id === id ? { ...track, ...next } : track)))
      }

      await mapLimit(entries, 3, async (entry) => {
        let tags: TrackTags | null = null
        try {
          const key = cacheKey(entry.path, entry.file.size, entry.file.lastModified)
          tags = await readCachedTags(key)
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
    [notify],
  )

  // 所有导入最终都走这里：占位行先上，标签后填。
  const addEntries = useCallback(
    (items: { file: File; path: string }[], skipped = 0) => {
      if (items.length === 0) {
        notify(`没有找到可播放的音频（支持 ${AUDIO_ACCEPT}）`)
        return
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
        return
      }

      // 先插占位行再读标签：等全部解析完再显示，导入几十首时会有几秒白屏。
      setTracks((prev) => [...prev, ...placeholders])
      setCurrentId((id) => id ?? placeholders[0]?.id ?? null)

      const parts = [`已导入 ${placeholders.length} 首`]
      if (skipped > 0) parts.push(`跳过 ${skipped} 个不支持的文件`)
      notify(`${parts.join('，')}，正在读标签…`)

      void hydrateTags(entries)
    },
    [hydrateTags, notify, tracks],
  )

  // 导入就是导入：同一批文件重复选只会去重，不会因为"以前移除过"而拦下来。
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

  const addEntriesRef = useRef(addEntries)
  addEntriesRef.current = addEntries

  // 目录导入：Chromium 走 File System Access（拿得到真实路径、句柄还能存），
  // 其它浏览器退回 <input webkitdirectory>——那条路每次都要重选文件夹。
  const importDirectory = useCallback(async () => {
    if (!supportsDirectoryPicker()) {
      folderInputRef.current?.click()
      return
    }
    try {
      const handle = await pickDirectory()
      if (!handle) return
      await writeLibraryHandle(handle)
      setSavedHandle(handle)
      setNeedsGrant(false)
      addEntries(await collectAudioFiles(handle))
    } catch (error) {
      notify(error instanceof Error ? `读取文件夹失败：${error.message}` : '读取文件夹失败')
    }
  }, [addEntries, notify])

  // 用户手势里重新要权限，然后重新扫一遍上次那个目录。
  const restoreLibrary = useCallback(
    async (handle: FileSystemDirectoryHandle) => {
      try {
        if (!(await ensurePermission(handle, true))) {
          notify('浏览器没给权限，重新选一次文件夹吧')
          return
        }
        setNeedsGrant(false)
        addEntriesRef.current(await collectAudioFiles(handle))
      } catch {
        notify('读不到上次的文件夹，重新选一次吧')
      }
    },
    [notify],
  )

  // 启动时试一次静默恢复：句柄还在、权限还在，曲库就直接回来；
  // 权限过期（浏览器重启后常见）就留一个「继续上次的曲库」按钮，点一下再授权。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const handle = await readLibraryHandle().catch(() => null)
      if (!handle || cancelled) return
      setSavedHandle(handle)
      const granted = await ensurePermission(handle, false).catch(() => false)
      if (cancelled) return
      if (!granted) {
        setNeedsGrant(true)
        return
      }
      try {
        const items = await collectAudioFiles(handle)
        if (!cancelled) addEntriesRef.current(items)
      } catch {
        if (!cancelled) setNeedsGrant(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 撤销移除：把歌按原位置放回去。
  const undoRemove = useCallback(
    (track: Track, index: number) => {
      setTracks((prev) => {
        if (prev.some((item) => item.id === track.id)) return prev
        const next = [...prev]
        next.splice(Math.max(0, Math.min(index, next.length)), 0, track)
        return next
      })
      pendingUndoRef.current = null
      notify(`已恢复《${track.title}》`)
    },
    [notify],
  )

  // 从曲库移除：只丢内存里的这一条，磁盘上的文件不动，也不再记"别再导入"——
  // 下次选到它照样正常导入。
  const removeTrack = useCallback(
    (track: Track) => {
      const index = tracks.findIndex((item) => item.id === track.id)

      // 上一首被移除的如果还没撤销，它的 blob URL 现在可以真正回收了。
      const stale = pendingUndoRef.current
      if (stale && stale.track.id !== track.id) {
        URL.revokeObjectURL(stale.track.src)
        pendingUndoRef.current = null
        objectUrlsRef.current = objectUrlsRef.current.filter((url) => url !== stale.track.src)
      }

      setTracks((prev) => prev.filter((item) => item.id !== track.id))

      if (track.id === currentId) {
        const audio = audioRef.current
        audio?.pause()
        audio?.removeAttribute('src')
        setCurrentId(null)
        setPlaying(false)
        setElapsed(0)
        setDuration(0)
      }

      pendingUndoRef.current = { track, index: Math.max(0, index) }
      notify(`已移除《${track.title}》，源文件没动`, {
        label: '撤销',
        onClick: () => undoRemove(track, Math.max(0, index)),
      })
    },
    [currentId, notify, tracks, undoRemove],
  )

  const clearLibrary = useCallback(() => {
    libraryEpochRef.current += 1
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
    pendingUndoRef.current = null
    const audio = audioRef.current
    audio?.pause()
    audio?.removeAttribute('src')
    setTracks([])
    setCurrentId(null)
    setPlaying(false)
    setElapsed(0)
    setDuration(0)
    setQuery('')
    // 清空就是清空：句柄和标签缓存一起丢，否则刷新一下曲库又自己回来了。
    setSavedHandle(null)
    setNeedsGrant(false)
    void clearLibraryHandle()
    void clearCachedTags()
    notify('曲库已清空，源文件没动')
  }, [notify])

  // 清空要点两下：第一下把按钮变成"确定清空？"，3 秒内不点就自己退回。
  const requestClear = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    setConfirmClear(false)
    clearLibrary()
  }, [clearLibrary, confirmClear])

  const handleFileInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      addFiles(event.currentTarget.files)
      event.currentTarget.value = ''
    },
    [addFiles],
  )
  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      dragDepthRef.current = 0
      setDragging(false)
      addFiles(event.dataTransfer.files)
    },
    [addFiles],
  )

  const queued = currentIndex >= 0 ? tracks.slice(currentIndex + 1) : tracks

  return (
    <div
      className="app"
      onDragEnter={(event) => {
        event.preventDefault()
        dragDepthRef.current += 1
        setDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
        if (dragDepthRef.current === 0) setDragging(false)
      }}
      onDrop={handleDrop}
    >
      <TopBar
        query={query}
        trackCount={tracks.length}
        confirmingClear={confirmClear}
        onQueryChange={setQuery}
        onImportFiles={() => fileInputRef.current?.click()}
        onImportFolder={() => void importDirectory()}
        onRequestClear={requestClear}
      />

      <main className="content">
        <div className="list-scroll">
          <div className="list-head" aria-hidden="true">
            <span className="col-idx">#</span>
            <span className="col-title">标题</span>
            <span className="col-artist">歌手</span>
            <span className="col-album">专辑</span>
            <span className="col-duration">时长</span>
            <span className="col-actions" aria-hidden="true" />
          </div>
          {tracks.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">曲库还是空的</p>
              <p className="empty-hint">
                选一个音乐文件夹，或把文件拖进来。目前支持 {AUDIO_ACCEPT.replaceAll('.', '')}
                ，ape / wma / dsd 浏览器放不了。
              </p>
              <div className="empty-actions">
                <ImportMenu
                  onImportFolder={() => void importDirectory()}
                  onImportFiles={() => fileInputRef.current?.click()}
                />
                {savedHandle && needsGrant ? (
                  <button
                    type="button"
                    className="btn-import ghost"
                    onClick={() => void restoreLibrary(savedHandle)}
                  >
                    继续上次的曲库
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <TrackList
              tracks={visibleTracks}
              currentId={currentId}
              playing={playing}
              onSelect={playTrack}
              onRemove={removeTrack}
            />
          )}
        </div>
      </main>

      <aside className={queueOpen ? 'queue open' : 'queue'} aria-hidden={!queueOpen} aria-label="播放队列">
        <div className="queue-head">
          <span>播放队列</span>
          <button className="icon-btn" type="button" aria-label="关闭队列" onClick={() => setQueueOpen(false)}>
            ✕
          </button>
        </div>
        {/* 关闭时不渲染列表：1000 首的队列没必要在隐藏状态下也占一份 DOM。 */}
        {queueOpen ? (
          <>
            <div className="queue-sub">
              接下来 <span>{queued.length}</span> 首
            </div>
            <ol className="queue-list">
              {queued.map((track) => (
                <li
                  key={track.id}
                  className="queue-item"
                  onClick={() => playTrack(track)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      playTrack(track)
                    }
                  }}
                  tabIndex={0}
                >
                  <span className="q-title">{track.title}</span>
                  <span className="q-artist">{track.artist || '未知歌手'}</span>
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </aside>

      <div className={queueOpen ? 'scrim show' : 'scrim'} onClick={() => setQueueOpen(false)} />

      <PlayerBar
        track={current}
        playing={playing}
        elapsed={elapsed}
        duration={duration}
        volume={volume}
        queueOpen={queueOpen}
        canSkip={tracks.length > 1}
        onTogglePlay={togglePlay}
        onPrevious={() => step(-1)}
        onNext={() => step(1)}
        onSeek={seekTo}
        onVolumeChange={changeVolume}
        onToggleQueue={() => setQueueOpen((open) => !open)}
      />

      <audio
        ref={audioRef}
        hidden
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => setElapsed(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => {
          const audio = audioRef.current
          if (!audio || !Number.isFinite(audio.duration)) return
          setDuration(audio.duration)
          const id = currentId
          if (!id) return
          setTracks((prev) =>
            prev.map((track) =>
              track.id === id && track.duration === 0 ? { ...track, duration: audio.duration } : track,
            ),
          )
        }}
        onEnded={() => step(1)}
        onError={() => notify('这一首放不了：浏览器不支持该编码')}
      />

      <div className={dragging ? 'drop-overlay show' : 'drop-overlay'} aria-hidden={!dragging}>
        <div className="drop-card">
          <strong>松开即可导入</strong>
          <span>支持 mp3 / flac / m4a / aac / wav / ogg，可拖入文件夹</span>
        </div>
      </div>

      {notice ? (
        <div className="toast show" role="status" aria-live="polite">
          <span>{notice.text}</span>
          {notice.action ? (
            <button className="toast-action" type="button" onClick={notice.action.onClick}>
              {notice.action.label}
            </button>
          ) : null}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        multiple
        hidden
        onChange={handleFileInput}
      />
      <input
        ref={folderInputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        multiple
        hidden
        onChange={handleFileInput}
      />
    </div>
  )
}
