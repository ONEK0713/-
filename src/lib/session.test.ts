import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearSessionActive, isSessionActive, markSessionActive } from './session'

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('会话标记', () => {
  it('打上标记后才能认出「这是刷新」', () => {
    expect(isSessionActive()).toBe(false)
    markSessionActive()
    expect(isSessionActive()).toBe(true)
  })

  it('清掉标记后当作重新打开', () => {
    markSessionActive()
    clearSessionActive()
    expect(isSessionActive()).toBe(false)
  })

  it('storage 被禁用时不抛出，按「没有标记」处理', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect(isSessionActive()).toBe(false)
    expect(() => markSessionActive()).not.toThrow()
    expect(() => clearSessionActive()).not.toThrow()
  })
})
