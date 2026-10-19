/**
 * 虚拟列表的纯计算：给定滚动位置，算出该渲染哪一段。
 * 行高固定（54px，与 .row 的 CSS 一致），所以不需要测量每一行。
 */

export interface WindowRange {
  /** 渲染区间 [start, end) */
  start: number
  end: number
  /** 上方/下方占位高度，撑住滚动条总长度 */
  paddingTop: number
  paddingBottom: number
}

/** 与 CSS 里 .row 的高度保持一致。 */
export const ROW_HEIGHT = 54

/** 曲库超过这个数量才启用虚拟滚动：小列表全量渲染更省事，也不会有滚动抖动。 */
export const VIRTUALIZE_AFTER = 150

interface Options {
  /** 相对列表顶部的滚动距离（已扣掉吸顶表头） */
  scrollTop: number
  viewportHeight: number
  count: number
  rowHeight: number
  /** 上下各多渲染几行，快速滚动时不露白 */
  overscan?: number
}

export function visibleRange({
  scrollTop,
  viewportHeight,
  count,
  rowHeight,
  overscan = 6,
}: Options): WindowRange {
  if (count <= 0 || rowHeight <= 0) {
    return { start: 0, end: 0, paddingTop: 0, paddingBottom: 0 }
  }

  const safeTop = Math.max(0, scrollTop)
  const first = Math.floor(safeTop / rowHeight)
  const visible = Math.ceil(Math.max(0, viewportHeight) / rowHeight)

  const start = Math.max(0, Math.min(count, first - overscan))
  const end = Math.max(start, Math.min(count, first + visible + overscan))

  return {
    start,
    end,
    paddingTop: start * rowHeight,
    paddingBottom: (count - end) * rowHeight,
  }
}
