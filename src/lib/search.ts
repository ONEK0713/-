import type { Track } from '../types'

/**
 * 搜索：按标题 / 歌手 / 专辑做不区分大小写的子串匹配。
 * 空关键词返回原数组（不复制），保证「没搜索」时列表引用稳定。
 */
export function filterTracks(tracks: Track[], query: string): Track[] {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return tracks
  return tracks.filter((track) =>
    `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(keyword),
  )
}
