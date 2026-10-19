import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Track } from '../types'
import { nextMode, nextTrackIndex, stepIndex, type PlayMode } from '../lib/play-mode'
import {
  DEFAULT_VOLUME,
  loadPlayMode,
  loadVolume,
  normalizeVolume,
  savePlayMode,
  saveVolume,
} from '../lib/settings'

interface Options {
  tracks: Track[]
  /** 出错时给用户一句人话。 */
  notify: (text: string) => void
  /** 浏览器读到真实时长后回填，VBR 的 mp3 光看头部会差十几秒。 */
  onDurationKnown?: (id: string, seconds: number) => void
}

const FALLBACK_ERROR = '这一首放不了：浏览器不支持该编码'

/** 方向键的步长：一次 5 秒，Shift 加方向键一次 30 秒。 */
export const SEEK_STEP = 5
export const SEEK_STEP_LARGE = 30
export const VOLUME_STEP = 0.05

/**
 * 播放器状态机：一个 <audio> 元素 + 当前曲目 + 进度/音量/播放模式。
 * 不持有曲库，曲目从外面传进来；曲库变了（移除/清空）由 App 负责调 stop()。
 */
export function usePlayback({ tracks, notify, onDurationKnown }: Options) {
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(loadVolume)
  const [muted, setMuted] = useState(false)
  const [mode, setMode] = useState<PlayMode>(loadPlayMode)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 事件回调可能晚于 setVolume 触发，用 ref 读最新音量，避免闭包里的旧值。
  const volumeRef = useRef(volume)
  volumeRef.current = volume

  // 播放模式也可能被 onEnded 的旧闭包读到，同样用 ref。
  const modeRef = useRef(mode)
  modeRef.current = mode

  const currentIndex = useMemo(
    () => tracks.findIndex((track) => track.id === currentId),
    [tracks, currentId],
  )
  const current = currentIndex >= 0 ? (tracks[currentIndex] ?? null) : null

  const currentIndexRef = useRef(currentIndex)
  currentIndexRef.current = currentIndex

  const playTrack = useCallback(
    (track: Track | undefined) => {
      const audio = audioRef.current
      if (!audio || !track) return

      if (audio.src !== track.src) {
        audio.src = track.src
        setElapsed(0)
        // 先挂上已知时长，元数据加载完再校准。
        setDuration(track.duration)
      }
      audio.volume = volumeRef.current
      setCurrentId(track.id)
      void audio.play().catch(() => {
        setPlaying(false)
        notify('播放失败：浏览器可能不支持这个格式，或自动播放被拦截')
      })
    },
    [notify],
  )

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.src) {
      playTrack(current ?? tracks[0])
      return
    }
    if (audio.paused) {
      void audio.play().catch(() => {
        setPlaying(false)
        notify('播放失败：请再点一次播放')
      })
    } else {
      audio.pause()
    }
  }, [current, notify, playTrack, tracks])

  const step = useCallback(
    (delta: number) => {
      if (tracks.length === 0) return
      const target = stepIndex({
        mode: modeRef.current,
        index: currentIndexRef.current,
        delta,
        length: tracks.length,
      })
      if (target === null) {
        audioRef.current?.pause()
        notify(delta > 0 ? '已经是最后一首' : '已经是第一首')
        return
      }
      playTrack(tracks[target])
    },
    [notify, playTrack, tracks],
  )

  /** 一首自然放完：按当前模式决定下一首。 */
  const advance = useCallback(() => {
    const next = nextTrackIndex({
      mode: modeRef.current,
      index: currentIndexRef.current,
      length: tracks.length,
    })
    if (next === null) {
      setPlaying(false)
      notify('曲库放完了')
      return
    }
    if (next === currentIndexRef.current) {
      // 单曲循环：直接从头再来，不重建 src。
      const audio = audioRef.current
      if (!audio) return
      audio.currentTime = 0
      void audio.play().catch(() => setPlaying(false))
      return
    }
    playTrack(tracks[next])
  }, [notify, playTrack, tracks])

  const cycleMode = useCallback(() => {
    setMode((previous) => {
      const next = nextMode(previous)
      savePlayMode(next)
      return next
    })
  }, [])

  /** 导入后如果还没有当前曲目，先把第一首摆进播放条（不自动播）。 */
  const ensureSelected = useCallback((id: string) => {
    setCurrentId((current) => current ?? id)
  }, [])

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    const max = Number.isFinite(audio.duration) ? audio.duration : seconds
    const next = Math.min(Math.max(0, seconds), Math.max(0, max))
    audio.currentTime = next
    setElapsed(next)
  }, [])

  const seekBy = useCallback(
    (delta: number) => {
      const audio = audioRef.current
      if (!audio) return
      seekTo(audio.currentTime + delta)
    },
    [seekTo],
  )

  const changeVolume = useCallback((next: number) => {
    const value = normalizeVolume(next)
    setVolume(value)
    saveVolume(value)
    // 音量拉到非零就是用户想听声音，顺手解除静音。
    if (value > 0) setMuted(false)
    if (audioRef.current) audioRef.current.volume = value
  }, [])

  const changeVolumeBy = useCallback(
    (delta: number) => {
      changeVolume(volumeRef.current + delta)
    },
    [changeVolume],
  )

  const toggleMute = useCallback(() => {
    setMuted((previous) => !previous)
  }, [])

  /** 曲目被移除或曲库被清空时调用：停下来，别让 blob URL 回收后还在放。 */
  const stop = useCallback(() => {
    const audio = audioRef.current
    audio?.pause()
    audio?.removeAttribute('src')
    setCurrentId(null)
    setPlaying(false)
    setElapsed(0)
    setDuration(0)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('is-paused', !playing)
  }, [playing])

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted
  }, [muted])

  const audioProps = {
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onTimeUpdate: () => setElapsed(audioRef.current?.currentTime ?? 0),
    onLoadedMetadata: () => {
      const audio = audioRef.current
      if (!audio || !Number.isFinite(audio.duration)) return
      setDuration(audio.duration)
      if (currentId) onDurationKnown?.(currentId, audio.duration)
    },
    onEnded: () => advance(),
    onError: () => notify(FALLBACK_ERROR),
  }

  return {
    audioRef,
    audioProps,
    currentId,
    currentIndex,
    current,
    playing,
    elapsed,
    duration,
    volume,
    muted,
    mode,
    playTrack,
    togglePlay,
    step,
    seekTo,
    seekBy,
    changeVolume,
    changeVolumeBy,
    toggleMute,
    cycleMode,
    stop,
    ensureSelected,
  }
}

export { DEFAULT_VOLUME }
