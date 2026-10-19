import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Track } from '../types'

interface Options {
  tracks: Track[]
  /** 出错时给用户一句人话。 */
  notify: (text: string) => void
  /** 浏览器读到真实时长后回填，VBR 的 mp3 光看头部会差十几秒。 */
  onDurationKnown?: (id: string, seconds: number) => void
}

const DEFAULT_VOLUME = 0.7
const FALLBACK_ERROR = '这一首放不了：浏览器不支持该编码'

/**
 * 播放器状态机：一个 <audio> 元素 + 当前曲目 + 进度/音量。
 * 不持有曲库，曲目从外面传进来；曲库变了（移除/清空）由 App 负责调 stop()。
 */
export function usePlayback({ tracks, notify, onDurationKnown }: Options) {
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(DEFAULT_VOLUME)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 事件回调可能晚于 setVolume 触发，用 ref 读最新音量，避免闭包里的旧值。
  const volumeRef = useRef(volume)
  volumeRef.current = volume

  const currentIndex = useMemo(
    () => tracks.findIndex((track) => track.id === currentId),
    [tracks, currentId],
  )
  const current = currentIndex >= 0 ? (tracks[currentIndex] ?? null) : null

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
      // 还没选过曲目时：往后切从第一首开始，往前切就停在原地。
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

  /** 导入后如果还没有当前曲目，先把第一首摆进播放条（不自动播）。 */
  const ensureSelected = useCallback((id: string) => {
    setCurrentId((current) => current ?? id)
  }, [])

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
    onEnded: () => step(1),
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
    playTrack,
    togglePlay,
    step,
    seekTo,
    changeVolume,
    stop,
    ensureSelected,
  }
}
