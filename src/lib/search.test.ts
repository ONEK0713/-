import { describe, expect, it } from 'vitest'
import { filterTracks } from './search'
import type { Track } from '../types'

function track(title: string, artist = '', album = ''): Track {
  return {
    id: `${title}|${artist}`,
    path: `${title}.flac`,
    title,
    artist,
    album,
    duration: 200,
    src: 'blob:x',
    coverHash: null,
    tagState: 'ready',
  }
}

const tracks = [track('浪人的…', '张震岳', '跟着感觉走'), track('爱情转移', '陈奕迅', '爱情呼叫转移'), track('看见', '李志', '1701')]

describe('filterTracks', () => {
  it('空关键词返回原数组，不做复制', () => {
    expect(filterTracks(tracks, '   ')).toBe(tracks)
  })

  it('按标题匹配', () => {
    expect(filterTracks(tracks, '浪人').map((item) => item.title)).toEqual(['浪人的…'])
  })

  it('按歌手匹配', () => {
    expect(filterTracks(tracks, '陈奕迅').map((item) => item.title)).toEqual(['爱情转移'])
  })

  it('按专辑匹配，并且忽略大小写', () => {
    expect(filterTracks(tracks, 'calling'.toUpperCase()).map((item) => item.title)).toEqual([])
    expect(filterTracks(tracks, '1701').map((item) => item.title)).toEqual(['看见'])
  })

  it('没有命中就返回空数组', () => {
    expect(filterTracks(tracks, '不存在的歌')).toEqual([])
  })
})
