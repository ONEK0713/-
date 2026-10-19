import type { Track } from '../types'
import { stripExtension } from './format'

/** 一次导入里，一个文件对应的全部信息。 */
export interface ImportEntry {
  file: File
  path: string
  id: string
}

/**
 * 浏览器不给真实路径：选文件夹时把 webkitRelativePath 当相对路径，
 * 多选文件（或拖拽）就退回文件名。
 */
export function fileTrackPath(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  return relative && relative.length > 0 ? relative : file.name
}

/** 稳定键：相对路径 + 大小 + 修改时间。带上路径，免得不同目录下的 01.mp3 被并成一首。 */
export function fileTrackId(path: string, file: File): string {
  return `${path}|${file.size}|${file.lastModified}`
}

/** 还没读到标签时先摆一行占位，标题用文件名去掉扩展名。 */
export function entryToPlaceholder(entry: ImportEntry, src: string): Track {
  return {
    id: entry.id,
    path: entry.path,
    title: stripExtension(entry.file.name),
    artist: '',
    album: '',
    duration: 0,
    src,
    coverHash: null,
    tagState: 'pending',
  }
}
