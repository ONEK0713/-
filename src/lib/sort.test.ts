import { describe, expect, it } from 'vitest'
import type { Track } from '../types'
import { compareText, nextSort, sortTracks } from './sort'

function track(overrides: Partial<Track> & { title: string }): Track {
  return {
    id: overrides.title,
    path: `${overrides.title}.flac`,
    artist: '张震岳',
    album: '跟着感觉走',
    duration: 200,
    src: 'blob:x',
    coverHash: null,
    tagState: 'ready',
    ...overrides,
  }
}

const tracks: Track[] = [
  track({ title: 'beta', artist: '李志', album: '1701', duration: 254 }),
  track({ title: 'alpha', artist: '周杰伦', album: 'Jay', duration: 279 }),
  track({ title: '曲目 10', artist: '张震岳', album: 'B', duration: 0 }),
  track({ title: '曲目 2', artist: '张震岳', album: 'A', duration: 60 }),
]

function titles(list: Track[]): string[] {
  return list.map((item) => item.title)
}

describe('compareText', () => {
  it('数字按数值大小比较', () => {
    expect(compareText('曲目 2', '曲目 10')).toBeLessThan(0)
  })

  it('空串排在最后', () => {
    expect(compareText('', 'abc')).toBeGreaterThan(0)
    expect(compareText('abc', '')).toBeLessThan(0)
    expect(compareText('', '')).toBe(0)
  })
})

describe('sortTracks', () => {
  it('默认顺序返回原数组引用，不复制也不排序', () => {
    expect(sortTracks(tracks, { key: 'default', direction: 'asc' })).toBe(tracks)
  })

  it('按标题升序、降序', () => {
    // 中文按拼音序，且 ICU 在 zh 下把汉字排在拉丁字母前面；数字按数值比较。
    expect(titles(sortTracks(tracks, { key: 'title', direction: 'asc' }))).toEqual([
      '曲目 2',
      '曲目 10',
      'alpha',
      'beta',
    ])
    expect(titles(sortTracks(tracks, { key: 'title', direction: 'desc' }))).toEqual([
      'beta',
      'alpha',
      '曲目 10',
      '曲目 2',
    ])
  })

  it('按歌手排序时，同一歌手内部再按标题', () => {
    const list = sortTracks(tracks, { key: 'artist', direction: 'asc' })
    // 拼音序：李志(li) < 张震岳(zhang) < 周杰伦(zhou)
    expect(titles(list)).toEqual(['beta', '曲目 2', '曲目 10', 'alpha'])
  })

  it('时长未知的歌永远排最后，升降序都一样', () => {
    const asc = titles(sortTracks(tracks, { key: 'duration', direction: 'asc' }))
    const desc = titles(sortTracks(tracks, { key: 'duration', direction: 'desc' }))
    expect(asc.at(-1)).toBe('曲目 10')
    expect(desc.at(-1)).toBe('曲目 10')
  })

  it('不改动传进来的数组', () => {
    const copy = [...tracks]
    sortTracks(tracks, { key: 'title', direction: 'asc' })
    expect(tracks).toEqual(copy)
  })
})

describe('nextSort', () => {
  it('第一次点升序，第二次降序，第三次回到导入顺序', () => {
    const first = nextSort({ key: 'default', direction: 'asc' }, 'title')
    expect(first).toEqual({ key: 'title', direction: 'asc' })

    const second = nextSort(first, 'title')
    expect(second).toEqual({ key: 'title', direction: 'desc' })

    const third = nextSort(second, 'title')
    expect(third).toEqual({ key: 'default', direction: 'asc' })
  })

  it('换一列排序直接从这个列的升序开始', () => {
    expect(nextSort({ key: 'title', direction: 'desc' }, 'artist')).toEqual({
      key: 'artist',
      direction: 'asc',
    })
  })
})
