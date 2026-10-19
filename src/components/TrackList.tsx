import { formatTime } from '../lib/format'
import type { Track } from '../types'
import { EqualizerIcon } from './icons'

interface TrackListProps {
  tracks: Track[]
  currentId: string | null
  playing: boolean
  onSelect: (track: Track) => void
  onRemove: (track: Track) => void
  /** 虚拟滚动时，这一段在完整列表里的起始下标（用于显示正确的序号）。 */
  startIndex?: number
  paddingTop?: number
  paddingBottom?: number
}

export default function TrackList({
  tracks,
  currentId,
  playing,
  onSelect,
  onRemove,
  startIndex = 0,
  paddingTop = 0,
  paddingBottom = 0,
}: TrackListProps) {
  if (tracks.length === 0) {
    return <p className="empty">没有匹配的歌曲</p>
  }

  return (
    <div className="list" role="list" aria-label="曲库列表">
      {paddingTop > 0 ? <div style={{ height: paddingTop }} aria-hidden="true" /> : null}

      {tracks.map((track, index) => {
        const active = track.id === currentId
        const pending = track.tagState === 'pending'
        return (
          <div
            key={track.id}
            role="listitem"
            className={active ? 'row playing' : 'row'}
            tabIndex={0}
            onClick={() => onSelect(track)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(track)
              }
            }}
          >
            <span className="idx">
              {active && playing ? <EqualizerIcon /> : String(startIndex + index + 1).padStart(2, '0')}
            </span>
            <span className="title" title={track.title}>
              {track.title}
            </span>
            {/* 还在读标签时显示省略号：用 '—' 会被误读成"这首歌没有歌手"。 */}
            <span className="artist">{pending ? '…' : track.artist || '—'}</span>
            <span className="album">{pending ? '…' : track.album || '—'}</span>
            <span className="duration">{pending || track.duration <= 0 ? '--:--' : formatTime(track.duration)}</span>
            <button
              className="row-remove"
              type="button"
              aria-label={`从曲库移除 ${track.title}`}
              onClick={(event) => {
                // 别让点击冒泡到行上，否则移除的同时还会开始播放。
                event.stopPropagation()
                onRemove(track)
              }}
            >
              ✕
            </button>
          </div>
        )
      })}

      {paddingBottom > 0 ? <div style={{ height: paddingBottom }} aria-hidden="true" /> : null}
    </div>
  )
}
