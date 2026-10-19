import { describe, expect, it } from 'vitest'
import {
  PLAY_MODES,
  PLAY_MODE_LABELS,
  isPlayMode,
  nextMode,
  nextTrackIndex,
  stepIndex,
} from './play-mode'

/** 固定随机数，方便断言“挑了哪一首”。 */
const always = (value: number) => () => value

describe('nextMode', () => {
  it('按顺序，循环播放到最后一个后回到顺序播放', () => {
    expect(nextMode('order')).toBe('repeat-all')
    expect(nextMode('repeat-all')).toBe('repeat-one')
    expect(nextMode('repeat-one')).toBe('shuffle')
    expect(nextMode('shuffle')).toBe('order')
  })

  it('四种模式都有中文名字', () => {
    for (const mode of PLAY_MODES) expect(PLAY_MODE_LABELS[mode]).toBeTruthy()
  })

  it('只认真实的模式，脏的 localStorage 值返回 false', () => {
    expect(isPlayMode('shuffle')).toBe(true)
    expect(isPlayMode('random')).toBe(false)
    expect(isPlayMode(null)).toBe(false)
  })
})

describe('nextTrackIndex', () => {
  it('顺序播放：到最后返回 null', () => {
    expect(nextTrackIndex({ mode: 'order', index: 1, length: 3 })).toBe(2)
    expect(nextTrackIndex({ mode: 'order', index: 2, length: 3 })).toBeNull()
  })

  it('列表循环：最后一首接回第一首', () => {
    expect(nextTrackIndex({ mode: 'repeat-all', index: 2, length: 3 })).toBe(0)
    expect(nextTrackIndex({ mode: 'repeat-all', index: 0, length: 3 })).toBe(1)
  })

  it('单曲循环：停在原地，哪怕还没选过也要给一首', () => {
    expect(nextTrackIndex({ mode: 'repeat-one', index: 1, length: 3 })).toBe(1)
    expect(nextTrackIndex({ mode: 'repeat-one', index: -1, length: 3 })).toBe(0)
  })

  it('随机播放：不会随机到正在放的这首', () => {
    for (let index = 0; index < 4; index += 1) {
      for (const random of [always(0), always(0.5), always(0.99)]) {
        const pick = nextTrackIndex({ mode: 'shuffle', index, length: 4, random })
        expect(pick).not.toBe(index)
        expect(pick).toBeGreaterThanOrEqual(0)
        expect(pick).toBeLessThan(4)
      }
    }
  })

  it('随机播放：只有一首时只能放这一首；空曲库返回 null', () => {
    expect(nextTrackIndex({ mode: 'shuffle', index: 0, length: 1, random: always(0.5) })).toBe(0)
    expect(nextTrackIndex({ mode: 'shuffle', index: 0, length: 0 })).toBeNull()
  })

  it('还没选曲目时，任何模式都从第一首开始（随机从任意一首开始）', () => {
    expect(nextTrackIndex({ mode: 'order', index: -1, length: 3 })).toBe(0)
    expect(nextTrackIndex({ mode: 'shuffle', index: -1, length: 3, random: always(0.7) })).toBe(2)
  })
})

describe('stepIndex', () => {
  it('下一首/上一首在范围内正常移动', () => {
    expect(stepIndex({ mode: 'order', index: 0, delta: 1, length: 3 })).toBe(1)
    expect(stepIndex({ mode: 'order', index: 2, delta: -1, length: 3 })).toBe(1)
  })

  it('顺序播放：越过边界返回 null', () => {
    expect(stepIndex({ mode: 'order', index: 2, delta: 1, length: 3 })).toBeNull()
    expect(stepIndex({ mode: 'order', index: 0, delta: -1, length: 3 })).toBeNull()
  })

  it('列表循环：越界回绕', () => {
    expect(stepIndex({ mode: 'repeat-all', index: 2, delta: 1, length: 3 })).toBe(0)
    expect(stepIndex({ mode: 'repeat-all', index: 0, delta: -1, length: 3 })).toBe(2)
  })

  it('单曲循环下手动切歌仍然去下一首', () => {
    expect(stepIndex({ mode: 'repeat-one', index: 1, delta: 1, length: 3 })).toBe(2)
  })

  it('随机播放下点下一首是随机挑，往前仍按列表顺序', () => {
    expect(stepIndex({ mode: 'shuffle', index: 1, delta: 1, length: 3, random: always(0) })).toBe(0)
    expect(stepIndex({ mode: 'shuffle', index: 2, delta: -1, length: 3 })).toBe(1)
  })

  it('还没选曲目时，下一首从第一首开始', () => {
    expect(stepIndex({ mode: 'order', index: -1, delta: 1, length: 3 })).toBe(0)
    expect(stepIndex({ mode: 'repeat-all', index: -1, delta: 1, length: 3 })).toBe(0)
  })

  it('空曲库返回 null', () => {
    expect(stepIndex({ mode: 'order', index: 0, delta: 1, length: 0 })).toBeNull()
  })
})
