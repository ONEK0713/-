/**
 * 播放模式与「下一首该放谁」的决策，全是纯函数，方便单测。
 * 界面只负责按 label 显示，不自己算下标。
 */

export type PlayMode = 'order' | 'repeat-all' | 'repeat-one' | 'shuffle'

/** 按钮点一下按这个顺序轮转，和大多数播放器一致。 */
export const PLAY_MODES: readonly PlayMode[] = ['order', 'repeat-all', 'repeat-one', 'shuffle']

export const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  order: '顺序播放',
  'repeat-all': '列表循环',
  'repeat-one': '单曲循环',
  shuffle: '随机播放',
}

export function isPlayMode(value: unknown): value is PlayMode {
  return typeof value === 'string' && (PLAY_MODES as readonly string[]).includes(value)
}

export function nextMode(mode: PlayMode): PlayMode {
  const index = PLAY_MODES.indexOf(mode)
  return PLAY_MODES[(index + 1) % PLAY_MODES.length] ?? 'order'
}

interface NextOptions {
  mode: PlayMode
  /** 当前曲目下标，-1 表示还没选过任何一首。 */
  index: number
  length: number
  /** 注入随机源，测试里给固定值。 */
  random?: () => number
}

/**
 * 一首自然放完（ended）之后应该放哪一首。
 * 返回 null 表示不再往下放——顺序模式放到最后一首就是这样。
 */
export function nextTrackIndex({ mode, index, length, random = Math.random }: NextOptions): number | null {
  if (length <= 0) return null

  if (mode === 'repeat-one') return index < 0 ? 0 : index

  if (mode === 'shuffle') {
    if (length === 1) return 0
    if (index < 0) return randomIndex(length, random)
    // 在「除当前这首以外」的候选里挑，避免随机到同一首、听感像没反应。
    const pick = randomIndex(length - 1, random)
    return pick >= index ? pick + 1 : pick
  }

  if (index < 0) return 0
  if (mode === 'repeat-all') return (index + 1) % length
  return index + 1 < length ? index + 1 : null
}

interface StepOptions {
  mode: PlayMode
  index: number
  /** -1 上一首，+1 下一首；只看符号。 */
  delta: number
  length: number
  random?: () => number
}

/**
 * 用户手动点上一首/下一首。返回 null 表示已经到头，调用方负责暂停并提示。
 * 手动切歌不受单曲循环影响：单曲循环下点下一首，应该去下一首，而不是原地重放。
 */
export function stepIndex({ mode, index, delta, length, random = Math.random }: StepOptions): number | null {
  if (length <= 0) return null

  if (mode === 'shuffle' && delta > 0) {
    return nextTrackIndex({ mode, index, length, random })
  }

  const base = index < 0 ? (delta > 0 ? -1 : 0) : index
  const target = base + delta
  if (mode === 'repeat-all') return ((target % length) + length) % length
  return target >= 0 && target < length ? target : null
}

function randomIndex(size: number, random: () => number): number {
  const value = Math.floor(random() * size)
  return Math.min(size - 1, Math.max(0, value))
}
