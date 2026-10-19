import { isPlayMode, type PlayMode } from './play-mode'

/**
 * 只存两项偏好：播放模式与音量。
 * 曲目、进度、曲库都不落盘——用户要的语义是「关掉标签页就重新开始」。
 * localStorage 在隐私模式或站点数据被清时会抛错，所有读写都当可选增强。
 */

const MODE_KEY = 'local-player:mode'
const VOLUME_KEY = 'local-player:volume'

export const DEFAULT_VOLUME = 0.7

export function loadPlayMode(): PlayMode {
  try {
    const raw = window.localStorage.getItem(MODE_KEY)
    return isPlayMode(raw) ? raw : 'order'
  } catch {
    return 'order'
  }
}

export function savePlayMode(mode: PlayMode): void {
  try {
    window.localStorage.setItem(MODE_KEY, mode)
  } catch {
    // 存不了就算了，不影响本次播放。
  }
}

/** 音量统一收敛到 0–1，坏数据退回默认值。 */
export function normalizeVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME
  return Math.min(1, Math.max(0, value))
}

export function loadVolume(): number {
  try {
    const raw = window.localStorage.getItem(VOLUME_KEY)
    if (raw === null) return DEFAULT_VOLUME
    return normalizeVolume(Number(raw))
  } catch {
    return DEFAULT_VOLUME
  }
}

export function saveVolume(volume: number): void {
  try {
    window.localStorage.setItem(VOLUME_KEY, String(normalizeVolume(volume)))
  } catch {
    // 同上。
  }
}
