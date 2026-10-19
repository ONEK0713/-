import { parseBlob } from 'music-metadata'
import { fixMojibake } from './tag-encoding'

/** 从文件里读出来的标签，全部已经清洗过；缺字段一律用空串 / null，不用 undefined。 */
export interface TrackTags {
  title: string
  artist: string
  album: string
  trackNo: number | null
  year: number | null
  /** 秒，未知为 0 */
  duration: number
  /** 只记封面字节数，图片本身留给 M1b 的封面缓存 */
  coverBytes: number
  codec: string
  lossless: boolean
}

export const EMPTY_TAGS: TrackTags = {
  title: '',
  artist: '',
  album: '',
  trackNo: null,
  year: null,
  duration: 0,
  coverBytes: 0,
  codec: '',
  lossless: false,
}

function clean(value: string | undefined): string {
  return value ? fixMojibake(value.trim()) : ''
}

function toNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * 解析一首歌的标签。只在 Worker 里调用——它会整块读文件，
 * 放在主线程上大文件会卡住滚动。
 *
 * duration 用精确值：VBR 的 mp3 没有 Xing 头时，估算出来的时长会差出十几秒，
 * 而读完整首只要几十毫秒（实测 9.7MB 的 mp3 约 30ms）。
 */
export async function readTags(blob: Blob): Promise<TrackTags> {
  const result = await parseBlob(blob, { duration: true })
  const common = result.common
  const pictures = common.picture ?? []

  return {
    title: clean(common.title),
    artist: clean(common.artist),
    album: clean(common.album),
    trackNo: toNumber(common.track?.no),
    year: toNumber(common.year),
    duration: result.format.duration ? Math.round(result.format.duration) : 0,
    coverBytes: pictures.reduce((total, picture) => total + picture.data.length, 0),
    codec: result.format.codec ?? '',
    lossless: result.format.lossless ?? false,
  }
}
