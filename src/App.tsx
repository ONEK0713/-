import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import PlayerBar from './components/PlayerBar'
import TopBar from './components/TopBar'
import TrackList from './components/TrackList'
import { AUDIO_ACCEPT, isAudioFileName, stripExtension } from './lib/format'
import type { Track } from './types'

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
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const objectUrlsRef = useRef<string[]>([])
  const dragDepthRef = useRef(0)

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

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 3200)
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
        setNotice('播放失败：浏览器可能不支持这个格式，或自动播放被拦截')
      })
    },
    [volume],
  )

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.src) {
      playTrack(current ?? tracks[0])
      return
    }
    if (audio.paused) {
      void audio.play().catch(() => setNotice('播放失败：请再点一次播放'))
    } else {
      audio.pause()
    }
  }, [current, playTrack, tracks])

  const step = useCallback(
    (delta: number) => {
      if (tracks.length === 0) return
      const base = currentIndex < 0 ? (delta > 0 ? -1 : 0) : currentIndex
      const next = tracks[base + delta]
      if (!next) {
        audioRef.current?.pause()
        setNotice(delta > 0 ? '已经是最后一首' : '已经是第一首')
        return
      }
      playTrack(next)
    },
    [currentIndex, playTrack, tracks],
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

  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return
      const files = Array.from(fileList)
      const audioFiles = files.filter((file) => isAudioFileName(file.name))
      if (audioFiles.length === 0) {
        setNotice(`没有找到可播放的音频（支持 ${AUDIO_ACCEPT}）`)
        return
      }

      const known = new Set(tracks.map((track) => track.id))
      const fresh: Track[] = []
      for (const file of audioFiles) {
        const id = `${file.name}-${file.size}-${file.lastModified}`
        if (known.has(id)) continue
        known.add(id)
        const src = URL.createObjectURL(file)
        objectUrlsRef.current.push(src)
        fresh.push({
          id,
          title: stripExtension(file.name),
          artist: '',
          album: '',
          duration: 0,
          src,
        })
      }

      if (fresh.length === 0) {
        setNotice('这些歌曲已经在列表里了')
        return
      }
      setTracks((prev) => [...prev, ...fresh])
      setCurrentId((id) => id ?? fresh[0]?.id ?? null)

      const skipped = files.length - audioFiles.length
      setNotice(
        skipped > 0
          ? `已导入 ${fresh.length} 首，跳过 ${skipped} 个不支持的文件`
          : `已导入 ${fresh.length} 首`,
      )
    },
    [tracks],
  )

  // 从曲库移除：只丢内存里的这一条和它的 blob URL，磁盘上的文件不动。
  const removeTrack = useCallback(
    (track: Track) => {
      URL.revokeObjectURL(track.src)
      objectUrlsRef.current = objectUrlsRef.current.filter((url) => url !== track.src)
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
      setNotice(`已从曲库移除《${track.title}》，源文件没动`)
    },
    [currentId],
  )

  const clearLibrary = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
    const audio = audioRef.current
    audio?.pause()
    audio?.removeAttribute('src')
    setTracks([])
    setCurrentId(null)
    setPlaying(false)
    setElapsed(0)
    setDuration(0)
    setQuery('')
    setNotice('曲库已清空，源文件没动')
  }, [])

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
        onImportFolder={() => folderInputRef.current?.click()}
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
                <button className="btn-import" type="button" onClick={() => folderInputRef.current?.click()}>
                  扫描文件夹
                </button>
                <button
                  className="btn-import ghost"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  播放单个文件
                </button>
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
        onError={() => setNotice('这一首放不了：浏览器不支持该编码')}
      />

      <div className={dragging ? 'drop-overlay show' : 'drop-overlay'} aria-hidden={!dragging}>
        <div className="drop-card">
          <strong>松开即可导入</strong>
          <span>支持 mp3 / flac / m4a / aac / wav / ogg，可拖入文件夹</span>
        </div>
      </div>

      {notice ? (
        <div className="toast show" role="status" aria-live="polite">
          {notice}
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
