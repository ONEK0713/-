import { useCallback, useEffect, useMemo, useState } from 'react'
import TopBar from './components/TopBar'
import TrackList from './components/TrackList'
import PlayerBar from './components/PlayerBar'
import ImportMenu from './components/ImportMenu'
import { AUDIO_ACCEPT } from './lib/format'
import { filterTracks } from './lib/search'
import { useImports } from './hooks/useImports'
import { useLibrary } from './hooks/useLibrary'
import { useNotice } from './hooks/useNotice'
import { usePlayback } from './hooks/usePlayback'

/** 清空要点两下，第二下之前留 3 秒。 */
const CONFIRM_MS = 3000

export default function App() {
  const { notice, notify } = useNotice()
  const library = useLibrary({ notify })
  const { tracks, patchTrack, addEntries, addFiles, libraryEpochRef } = library

  const playback = usePlayback({
    tracks,
    notify,
    // 标签里没读到时长时，用浏览器解析出来的补上；已经有了就不覆盖。
    onDurationKnown: (id, seconds) => {
      const track = tracks.find((item) => item.id === id)
      if (track && track.duration === 0) patchTrack(id, { duration: seconds })
    },
  })

  const [query, setQuery] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  // 导入第一首时把它摆进播放条（不自动播）；已经选过就不动。
  const importEntries = useCallback(
    (items: { file: File; path: string }[], skipped = 0) => {
      const firstId = addEntries(items, skipped)
      if (firstId) playback.ensureSelected(firstId)
      return firstId
    },
    [addEntries, playback.ensureSelected],
  )

  const imports = useImports({
    addEntries: importEntries,
    addFiles,
    notify,
    epochRef: libraryEpochRef,
  })

  // 移除正在播的那首：曲目已经不在列表里了，播放器跟着停下来。
  const { currentId, stop } = playback
  useEffect(() => {
    if (currentId && !tracks.some((track) => track.id === currentId)) stop()
  }, [currentId, stop, tracks])

  useEffect(() => {
    if (!confirmClear) return
    const timer = window.setTimeout(() => setConfirmClear(false), CONFIRM_MS)
    return () => window.clearTimeout(timer)
  }, [confirmClear])

  const clearAll = useCallback(() => {
    imports.resetSources()
    library.clearLibrary()
    playback.stop()
    setQuery('')
    setConfirmClear(false)
  }, [imports.resetSources, library.clearLibrary, playback.stop])

  const requestClear = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    clearAll()
  }, [clearAll, confirmClear])

  const visibleTracks = useMemo(() => filterTracks(tracks, query), [tracks, query])

  return (
    <div className="app" {...imports.dragProps}>
      <TopBar
        query={query}
        trackCount={tracks.length}
        confirmingClear={confirmClear}
        onQueryChange={setQuery}
        onImportFiles={() => void imports.importFiles()}
        onImportFolder={() => void imports.importDirectory()}
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
              <p className="empty-hint">刷新页面曲库还在；关掉这个标签页再打开就是空的。</p>
              <div className="empty-actions">
                <ImportMenu
                  onImportFolder={() => void imports.importDirectory()}
                  onImportFiles={() => void imports.importFiles()}
                />
              </div>
            </div>
          ) : (
            <TrackList
              tracks={visibleTracks}
              currentId={playback.currentId}
              playing={playback.playing}
              onSelect={playback.playTrack}
              onRemove={library.removeTrack}
            />
          )}
        </div>
      </main>

      <PlayerBar
        track={playback.current}
        playing={playback.playing}
        elapsed={playback.elapsed}
        duration={playback.duration}
        volume={playback.volume}
        canSkip={tracks.length > 1}
        onTogglePlay={playback.togglePlay}
        onPrevious={() => playback.step(-1)}
        onNext={() => playback.step(1)}
        onSeek={playback.seekTo}
        onVolumeChange={playback.changeVolume}
      />

      <audio ref={playback.audioRef} hidden {...playback.audioProps} />

      <div className={imports.dragging ? 'drop-overlay show' : 'drop-overlay'} aria-hidden={!imports.dragging}>
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
        ref={imports.fileInputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        multiple
        hidden
        onChange={imports.handleFileInput}
      />
      <input
        ref={imports.folderInputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        multiple
        hidden
        onChange={imports.handleFileInput}
      />
    </div>
  )
}
