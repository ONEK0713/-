import { describe, expect, it } from 'vitest'
import { formatTime, isAudioFileName, stripExtension } from './format'

describe('isAudioFileName', () => {
  it('接受常见格式，大小写不敏感', () => {
    expect(isAudioFileName('a.mp3')).toBe(true)
    expect(isAudioFileName('A.FLAC')).toBe(true)
    expect(isAudioFileName('张震岳-浪人的….flac')).toBe(true)
  })

  it('拒绝浏览器放不了的格式和非音频文件', () => {
    expect(isAudioFileName('a.ape')).toBe(false)
    expect(isAudioFileName('a.dsf')).toBe(false)
    expect(isAudioFileName('cover.jpg')).toBe(false)
    expect(isAudioFileName('readme')).toBe(false)
  })
})

describe('stripExtension', () => {
  it('只去掉最后一个扩展名', () => {
    expect(stripExtension('01.artist.title.mp3')).toBe('01.artist.title')
    expect(stripExtension('张震岳-浪人的….flac')).toBe('张震岳-浪人的…')
  })

  it('没有扩展名或点开头时原样返回', () => {
    expect(stripExtension('noext')).toBe('noext')
    expect(stripExtension('.gitignore')).toBe('.gitignore')
  })
})

describe('formatTime', () => {
  it('按 m:ss 补零', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(45)).toBe('0:45')
    expect(formatTime(245)).toBe('4:05')
    expect(formatTime(59.9)).toBe('0:59')
  })

  it('满一小时切成 h:mm:ss', () => {
    expect(formatTime(3600)).toBe('1:00:00')
    expect(formatTime(3725)).toBe('1:02:05')
    expect(formatTime(7325)).toBe('2:02:05')
  })

  it('未知时长（NaN / Infinity / 负数）显示 0:00', () => {
    expect(formatTime(Number.NaN)).toBe('0:00')
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00')
    expect(formatTime(-1)).toBe('0:00')
  })
})
