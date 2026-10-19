import type { Track } from '../types'

/**
 * 列表排序。默认「导入顺序」直接返回原数组，避免每次搜索都重排一遍。
 * 中文用拼音序（Intl.Collator 带 zh 语言标签），数字串按数值比较，
 * 这样「曲目 2」排在「曲目 10」前面。
 */

export type SortKey = 'default' | 'title' | 'artist' | 'album' | 'duration'
export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: SortKey
  direction: SortDirection
}

const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' })

export function compareText(a: string, b: string): number {
  // 空值（没读到标签的占位行）永远排在后面，不要因为空串跑到最前面。
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return collator.compare(a, b)
}

function compareByKey(a: Track, b: Track, key: Exclude<SortKey, 'default'>): number {
  switch (key) {
    case 'title':
      return compareText(a.title, b.title)
    case 'artist':
      return compareText(a.artist, b.artist) || compareText(a.title, b.title)
    case 'album':
      return compareText(a.album, b.album) || compareText(a.title, b.title)
    case 'duration':
      // 时长未知（还在读标签）永远排最后，升序降序都一样。
      if (a.duration <= 0 && b.duration <= 0) return 0
      if (a.duration <= 0) return 1
      if (b.duration <= 0) return -1
      return a.duration - b.duration
  }
}

export function sortTracks(tracks: Track[], state: SortState): Track[] {
  const key = state.key
  if (key === 'default') return tracks
  const factor = state.direction === 'asc' ? 1 : -1
  return [...tracks].sort((a, b) => {
    const primary = compareByKey(a, b, key)
    if (primary === 0) return 0
    // 「未知」的兜底排序不跟着方向翻转，否则降序时占位行会跑到最上面。
    const aMissing = key === 'duration' ? a.duration <= 0 : isBlank(a, key)
    const bMissing = key === 'duration' ? b.duration <= 0 : isBlank(b, key)
    if (aMissing !== bMissing) return aMissing ? 1 : -1
    return primary * factor
  })
}

function isBlank(track: Track, key: Exclude<SortKey, 'default'>): boolean {
  return key === 'title' ? !track.title : !track[key]
}

/** 点表头：先升序，再降序，第三下回到导入顺序。 */
export function nextSort(state: SortState, key: Exclude<SortKey, 'default'>): SortState {
  if (state.key !== key || state.direction === 'asc') {
    return { key, direction: state.key === key ? 'desc' : 'asc' }
  }
  return { key: 'default', direction: 'asc' }
}
