import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { visibleRange, type WindowRange } from '../lib/virtual'

interface Options {
  scrollRef: RefObject<HTMLElement | null>
  count: number
  rowHeight: number
  /** 吸顶表头的高度：滚动容器里，列表实际从这之后开始。 */
  headerHeight?: number
  /** 曲库小的时候没必要虚拟化，全量渲染更简单。 */
  enabled?: boolean
  overscan?: number
}

const EMPTY: WindowRange = { start: 0, end: 0, paddingTop: 0, paddingBottom: 0 }

/**
 * 大曲库虚拟滚动：只渲染视口附近的几十行。
 * 直接监听 scroll 就能跟上（React 会合并同一帧的 setState），不用额外 rAF。
 */
export function useVirtualRows({
  scrollRef,
  count,
  rowHeight,
  headerHeight = 40,
  enabled = true,
  overscan = 6,
}: Options): WindowRange {
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const frameRef = useRef(0)

  useEffect(() => {
    const element = scrollRef.current
    if (!enabled || !element) return

    const measure = () => {
      setViewportHeight(element.clientHeight)
      setScrollTop(element.scrollTop)
    }

    measure()

    const onScroll = () => {
      // 滚轮事件很密，合并到下一帧再算，避免每像素都触发一次重渲染。
      if (frameRef.current) return
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = 0
        setScrollTop(element.scrollTop)
      })
    }

    element.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      element.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    }
  }, [enabled, scrollRef])

  if (!enabled) return EMPTY

  return visibleRange({
    scrollTop: Math.max(0, scrollTop - headerHeight),
    viewportHeight,
    count,
    rowHeight,
    overscan,
  })
}
