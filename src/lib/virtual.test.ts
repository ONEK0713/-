import { describe, expect, it } from 'vitest'
import { visibleRange } from './virtual'

const rowHeight = 54

describe('visibleRange', () => {
  it('空列表什么都不渲染', () => {
    expect(visibleRange({ scrollTop: 0, viewportHeight: 600, count: 0, rowHeight })).toEqual({
      start: 0,
      end: 0,
      paddingTop: 0,
      paddingBottom: 0,
    })
  })

  it('没滚动时从第一行开始，渲染视口内的行再加上下缓冲', () => {
    const range = visibleRange({ scrollTop: 0, viewportHeight: 540, count: 1000, rowHeight, overscan: 2 })
    expect(range.start).toBe(0)
    // 视口能放 10 行，再补 2 行缓冲。
    expect(range.end).toBe(12)
    expect(range.paddingTop).toBe(0)
    expect(range.paddingBottom).toBe((1000 - 12) * rowHeight)
  })

  it('滚到中间时上方用占位高度撑住', () => {
    const range = visibleRange({
      scrollTop: 54 * 100,
      viewportHeight: 540,
      count: 1000,
      rowHeight,
      overscan: 2,
    })
    expect(range.start).toBe(98)
    expect(range.end).toBe(112)
    expect(range.paddingTop).toBe(98 * 54)
    expect(range.paddingBottom).toBe((1000 - 112) * 54)
  })

  it('滚到底部时区间不会越界，底部占位是 0', () => {
    const range = visibleRange({
      scrollTop: 54 * 990,
      viewportHeight: 540,
      count: 1000,
      rowHeight,
      overscan: 2,
    })
    expect(range.end).toBe(1000)
    expect(range.paddingBottom).toBe(0)
    expect(range.start).toBe(988)
  })

  it('列表比视口还短时全量渲染', () => {
    const range = visibleRange({ scrollTop: 0, viewportHeight: 600, count: 3, rowHeight, overscan: 5 })
    expect(range).toEqual({ start: 0, end: 3, paddingTop: 0, paddingBottom: 0 })
  })

  it('负数滚动位置按 0 处理', () => {
    const range = visibleRange({ scrollTop: -20, viewportHeight: 540, count: 100, rowHeight })
    expect(range.start).toBe(0)
  })
})
