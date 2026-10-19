import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { formatTime } from '../lib/format'
import type { Track } from '../types'
import { NextIcon, PauseIcon, PlayIcon, PreviousIcon, VolumeIcon } from './icons'
import { useCoverUrl } from '../hooks/useCoverUrl'

interface PlayerBarProps {
  track: Track | null
  playing: boolean
  elapsed: number
  duration: number
  volume: number
  canSkip: boolean
  onTogglePlay: () => void
  onPrevious: () => void
  onNext: () => void
  onSeek: (seconds: number) => void
  onVolumeChange: (volume: number) => void
}

function fillStyle(value: number, max: number): CSSProperties {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return { '--fill': `${pct}%` } as CSSProperties
}

export default function PlayerBar({
  track,
  playing,
  elapsed,
  duration,
  volume,
  canSkip,
  onTogglePlay,
  onPrevious,
  onNext,
  onSeek,
  onVolumeChange,
}: PlayerBarProps) {
  const total = duration > 0 ? duration : (track?.duration ?? 0)
  const seekMax = total > 0 ? total : 1
  const coverUrl = useCoverUrl(track?.coverHash ?? null)
  // 封面解码失败（存的是坏数据、格式浏览器不认）时退回 ♪，不要留一个破图标。
  const [coverBroken, setCoverBroken] = useState(false)
  useEffect(() => setCoverBroken(false), [coverUrl])

  return (
    <footer className="player">
      <div className="now">
        <div className="cover" aria-hidden="true">
          {coverUrl && !coverBroken ? (
            <img src={coverUrl} alt="" onError={() => setCoverBroken(true)} />
          ) : (
            <span>{track ? '♪' : ''}</span>
          )}
        </div>
        <div className="now-text">
          <div className="now-title">{track?.title ?? '未播放'}</div>
          <div className="now-artist">
            {track ? [track.artist || '未知歌手', track.album].filter(Boolean).join(' · ') : '导入音乐后开始播放'}
          </div>
        </div>
      </div>

      <div className="controls">
        <div className="transport">
          <button
            className="icon-btn"
            type="button"
            aria-label="上一首"
            onClick={onPrevious}
            disabled={!canSkip}
          >
            <PreviousIcon />
          </button>

          <button
            className="icon-btn play-btn"
            type="button"
            aria-label={playing ? '暂停' : '播放'}
            onClick={onTogglePlay}
            disabled={!track}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>

          <button
            className="icon-btn"
            type="button"
            aria-label="下一首"
            onClick={onNext}
            disabled={!canSkip}
          >
            <NextIcon />
          </button>
        </div>

        <div className="progress">
          <span>{formatTime(elapsed)}</span>
          <input
            type="range"
            min={0}
            max={seekMax}
            step={1}
            value={Math.min(elapsed, seekMax)}
            style={fillStyle(elapsed, seekMax)}
            aria-label="播放进度"
            onChange={(event) => onSeek(Number(event.target.value))}
          />
          <span>{formatTime(total)}</span>
        </div>
      </div>

      <div className="side">
        <div className="volume">
          <VolumeIcon />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(volume * 100)}
            style={fillStyle(volume * 100, 100)}
            aria-label="音量"
            onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
          />
        </div>
      </div>
    </footer>
  )
}
