import { formatTime } from '../lib/format'
import type { Track } from '../types'
import { EqualizerIcon } from './icons'

interface TrackListProps {
  tracks: Track[]
  currentId: string | null
  playing: boolean
  onSelect: (track: Track) => void
  onRemove: (track: Track) => void
}

export default function TrackList({ tracks, currentId, playing, onSelect, onRemove }: TrackListProps) {
  if (tracks.length === 0) {
    return <p className="empty">没有匹配的歌曲</p>
  }

  return (
    <div className="list" role="list" aria-label="曲库列表">
      {tracks.map((track, index) => {
        const active = track.id === currentId
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
              {active && playing ? <EqualizerIcon /> : String(index + 1).padStart(2, '0')}
            </span>
            <span className="title" title={track.title}>
              {track.title}
            </span>
            <span className="artist">{track.artist || '—'}</span>
            <span className="album">{track.album || '—'}</span>
            <span className="duration">{formatTime(track.duration)}</span>
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
    </div>
  )
}
