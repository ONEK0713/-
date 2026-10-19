import { fireEvent, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useShortcuts } from './useShortcuts'

function setup() {
  const handlers = {
    togglePlay: vi.fn(),
    seekBy: vi.fn(),
    step: vi.fn(),
    changeVolumeBy: vi.fn(),
    toggleMute: vi.fn(),
    focusSearch: vi.fn(),
  }
  renderHook(() => useShortcuts(handlers))
  return handlers
}

describe('键盘快捷键', () => {
  it('空格播放/暂停，但不让页面滚动', () => {
    const handlers = setup()
    const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true })
    window.dispatchEvent(event)
    expect(handlers.togglePlay).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('长按空格不连续触发', () => {
    const handlers = setup()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true }))
    expect(handlers.togglePlay).not.toHaveBeenCalled()
  })

  it('左右方向键进退 5 秒，Shift 一次 30 秒', () => {
    const handlers = setup()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true }))
    expect(handlers.seekBy).toHaveBeenNthCalledWith(1, 5)
    expect(handlers.seekBy).toHaveBeenNthCalledWith(2, -5)
    expect(handlers.seekBy).toHaveBeenNthCalledWith(3, 30)
  })

  it('Ctrl + 左右切上下首', () => {
    const handlers = setup()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', ctrlKey: true }))
    expect(handlers.step).toHaveBeenNthCalledWith(1, 1)
    expect(handlers.step).toHaveBeenNthCalledWith(2, -1)
  })

  it('上下方向键调音量，M 静音，/ 聚焦搜索', () => {
    const handlers = setup()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }))
    expect(handlers.changeVolumeBy).toHaveBeenNthCalledWith(1, 0.05)
    expect(handlers.changeVolumeBy).toHaveBeenNthCalledWith(2, -0.05)
    expect(handlers.toggleMute).toHaveBeenCalledTimes(1)
    expect(handlers.focusSearch).toHaveBeenCalledTimes(1)
  })

  it('在输入框里打字时不抢按键，只放行 Esc 失焦', () => {
    const handlers = setup()
    const input = document.createElement('input')
    document.body.append(input)
    input.focus()

    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    input.dispatchEvent(space)
    expect(handlers.togglePlay).not.toHaveBeenCalled()
    expect(space.defaultPrevented).toBe(false)

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(document.activeElement).not.toBe(input)
    input.remove()
  })

  it('带 Alt / Meta 的组合键不处理，留给系统', () => {
    const handlers = setup()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', metaKey: true }))
    expect(handlers.changeVolumeBy).not.toHaveBeenCalled()
  })
})
