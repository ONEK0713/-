import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_VOLUME,
  loadPlayMode,
  loadVolume,
  normalizeVolume,
  savePlayMode,
  saveVolume,
} from './settings'

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('播放模式偏好', () => {
  it('没存过时是顺序播放', () => {
    expect(loadPlayMode()).toBe('order')
  })

  it('存进去再读出来是同一个模式', () => {
    savePlayMode('shuffle')
    expect(loadPlayMode()).toBe('shuffle')
  })

  it('存了乱七八糟的值就退回顺序播放', () => {
    window.localStorage.setItem('local-player:mode', 'random')
    expect(loadPlayMode()).toBe('order')
  })

  it('localStorage 不可用时不崩', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(loadPlayMode()).toBe('order')
  })
})

describe('音量偏好', () => {
  it('没存过时用默认音量', () => {
    expect(loadVolume()).toBe(DEFAULT_VOLUME)
  })

  it('存进去再读出来是同一个值', () => {
    saveVolume(0.35)
    expect(loadVolume()).toBeCloseTo(0.35)
  })

  it('超出 0–1 的值被夹住，NaN 退回默认值', () => {
    expect(normalizeVolume(-1)).toBe(0)
    expect(normalizeVolume(2)).toBe(1)
    expect(normalizeVolume(Number.NaN)).toBe(DEFAULT_VOLUME)
  })

  it('存的是坏数据也退回默认值', () => {
    window.localStorage.setItem('local-player:volume', 'loud')
    expect(loadVolume()).toBe(DEFAULT_VOLUME)
  })
})
