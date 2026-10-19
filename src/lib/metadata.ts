import { parseBlob, selectCover } from 'music-metadata'
import { hashBytes } from './hash'
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
  /** 封面的内容指纹；同一张图在不同曲目里是同一个值，存的时候按它去重。 */
  coverHash: string | null
  /** 封面总字节数（一张碟里常常有两个完全相同的 PICTURE 块）。 */
  coverBytes: number
  codec: string
  lossless: boolean
}

export interface CoverAsset {
  hash: string
  blob: Blob
}

export interface ParsedAudio {
  tags: TrackTags
  cover: CoverAsset | null
}

export const EMPTY_TAGS: TrackTags = {
  title: '',
  artist: '',
  album: '',
  trackNo: null,
  year: null,
  duration: 0,
  coverHash: null,
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
 * 解析一首歌：标签 + 封面。只在 Worker 里调用——它会整块读文件，
 * 放在主线程上大文件会卡住滚动。
 *
 * duration 用精确值：VBR 的 mp3 没有 Xing 头时，估算出来的时长会差出十几秒，
 * 而读完整首只要几十毫秒（实测 9.7MB 的 mp3 约 30ms）。
 */
export async function readAudio(blob: Blob): Promise<ParsedAudio> {
  const result = await parseBlob(blob, { duration: true })
  const common = result.common
  const pictures = common.picture ?? []
  const picture = selectCover(pictures)

  let cover: CoverAsset | null = null
  if (picture && picture.data.length > 0) {
    // 复制一份再包成 Blob：parseBlob 给的是切片视图，直接塞进 Blob 会把整个文件缓冲留活。
    const bytes = new Uint8Array(picture.data)
    cover = {
      hash: hashBytes(bytes),
      // 只留一份：有的文件里同一张图存了两遍，全带上会让缓存翻倍。
      blob: new Blob([bytes], { type: picture.format || 'image/jpeg' }),
    }
  }

  return {
    tags: {
      title: clean(common.title),
      artist: clean(common.artist),
      album: clean(common.album),
      trackNo: toNumber(common.track?.no),
      year: toNumber(common.year),
      duration: result.format.duration ? Math.round(result.format.duration) : 0,
      coverHash: cover?.hash ?? null,
      coverBytes: pictures.reduce((total, item) => total + item.data.length, 0),
      codec: result.format.codec ?? '',
      lossless: result.format.lossless ?? false,
    },
    cover,
  }
}
