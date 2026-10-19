import { describe, expect, it } from 'vitest'
import { fileTrackId, fileTrackPath, entryToPlaceholder } from './import-entry'

function file(name: string, content = 'fake-audio'): File {
  return new File([content], name, { type: 'audio/flac', lastModified: 1_700_000_000_000 })
}

/** jsdom 的 File 不认 webkitRelativePath，用 defineProperty 造出「选文件夹」的形态。 */
function fileWithRelativePath(name: string, relative: string): File {
  const base = file(name)
  Object.defineProperty(base, 'webkitRelativePath', { value: relative })
  return base
}

describe('fileTrackPath', () => {
  it('选文件夹时用相对路径', () => {
    expect(fileTrackPath(fileWithRelativePath('01.flac', '专辑/01.flac'))).toBe('专辑/01.flac')
  })

  it('多选文件时退回文件名', () => {
    expect(fileTrackPath(file('01.flac'))).toBe('01.flac')
  })

  it('webkitRelativePath 为空串时也退回文件名', () => {
    expect(fileTrackPath(fileWithRelativePath('01.flac', ''))).toBe('01.flac')
  })
})

describe('fileTrackId', () => {
  it('同名同大小的两个文件靠路径区分', () => {
    const a = file('01.flac')
    const b = file('01.flac')
    expect(fileTrackId('album-a/01.flac', a)).not.toBe(fileTrackId('album-b/01.flac', b))
  })

  it('路径相同但修改时间不同就不算同一首', () => {
    const a = file('01.flac')
    const b = new File(['fake-audio'], '01.flac', { type: 'audio/flac', lastModified: 1 })
    expect(fileTrackId('01.flac', a)).not.toBe(fileTrackId('01.flac', b))
  })

  it('同样的文件算出同样的键', () => {
    const a = file('01.flac')
    const b = file('01.flac')
    expect(fileTrackId('01.flac', a)).toBe(fileTrackId('01.flac', b))
  })
})

describe('entryToPlaceholder', () => {
  it('标题用文件名去扩展名，其它字段先留空', () => {
    const item = file('张震岳-浪人的….flac')
    const path = fileTrackPath(item)
    const track = entryToPlaceholder({ file: item, path, id: fileTrackId(path, item) }, 'blob:x')

    expect(track).toMatchObject({
      title: '张震岳-浪人的…',
      artist: '',
      album: '',
      duration: 0,
      src: 'blob:x',
      coverHash: null,
      tagState: 'pending',
    })
  })
})
