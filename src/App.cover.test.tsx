import { render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { readTagsQueued } from './lib/tags'

vi.mock('./lib/tags', () => ({ readTagsQueued: vi.fn() }))

// 缓存与封面库各自可以"说谎"，这里单独控制它们，验证 App 会不会自己纠正。
const cache = vi.hoisted(() => ({
  readCachedTags: vi.fn(),
  writeCachedTags: vi.fn(async () => {}),
  hasCover: vi.fn(async () => true),
  writeCover: vi.fn(async () => {}),
}))

vi.mock('./lib/meta-cache', () => ({
  cacheKey: () => 'cache-key',
  readCachedTags: cache.readCachedTags,
  writeCachedTags: cache.writeCachedTags,
  clearCachedTags: async () => {},
  hasCover: cache.hasCover,
  writeCover: cache.writeCover,
  readCover: async () => null,
  readSources: async () => null,
  writeSources: async () => {},
  clearSources: async () => {},
}))

function audioFile(name: string): File {
  return new File(['fake-audio'], name, { type: 'audio/flac' })
}

function cachedTags(coverHash: string | null) {
  return {
    title: '缓存标题',
    artist: '缓存歌手',
    album: '缓存专辑',
    trackNo: null,
    year: null,
    duration: 111,
    coverHash,
    coverBytes: coverHash ? 1000 : 0,
    codec: 'FLAC',
    lossless: true,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})

describe('封面与标签缓存对不上时', () => {
  it('缓存里有封面指纹、封面库里没图：重读文件并补存封面', async () => {
    cache.readCachedTags.mockResolvedValue(cachedTags('stale-hash'))
    cache.hasCover.mockResolvedValue(false)
    vi.mocked(readTagsQueued).mockResolvedValue({
      tags: { ...cachedTags('fresh-hash'), title: '真标题' },
      cover: { hash: 'fresh-hash', blob: new Blob([new Uint8Array([1, 2, 3])]) },
    })

    const { container } = render(<App />)
    const input = container.querySelector('input[type="file"]')
    fireEvent.change(input as HTMLInputElement, { target: { files: [audioFile('a.flac')] } })

    await waitFor(() => expect(screen.getAllByText('真标题').length).toBeGreaterThan(0))
    expect(readTagsQueued).toHaveBeenCalledTimes(1)
    expect(cache.writeCover).toHaveBeenCalledWith('fresh-hash', expect.any(Blob))
  })

  it('缓存和封面库对得上：直接用缓存，不再读文件', async () => {
    cache.readCachedTags.mockResolvedValue(cachedTags('good-hash'))
    cache.hasCover.mockResolvedValue(true)

    const { container } = render(<App />)
    const input = container.querySelector('input[type="file"]')
    fireEvent.change(input as HTMLInputElement, { target: { files: [audioFile('b.flac')] } })

    await waitFor(() => expect(screen.getAllByText('缓存标题').length).toBeGreaterThan(0))
    expect(readTagsQueued).not.toHaveBeenCalled()
    expect(cache.writeCover).not.toHaveBeenCalled()
  })

  it('没有封面的歌不受影响，照旧用缓存', async () => {
    cache.readCachedTags.mockResolvedValue(cachedTags(null))

    const { container } = render(<App />)
    const input = container.querySelector('input[type="file"]')
    fireEvent.change(input as HTMLInputElement, { target: { files: [audioFile('c.flac')] } })

    await waitFor(() => expect(screen.getAllByText('缓存标题').length).toBeGreaterThan(0))
    expect(readTagsQueued).not.toHaveBeenCalled()
    expect(cache.hasCover).not.toHaveBeenCalled()
  })

  it('老版本缓存里没有 coverHash 字段：重读文件并写回新格式', async () => {
    const legacy = cachedTags(null) as Record<string, unknown>
    delete legacy.coverHash
    cache.readCachedTags.mockResolvedValue(legacy)
    vi.mocked(readTagsQueued).mockResolvedValue({
      tags: { ...cachedTags('new-hash'), title: '新标题' },
      cover: { hash: 'new-hash', blob: new Blob([new Uint8Array([9])]) },
    })

    const { container } = render(<App />)
    const input = container.querySelector('input[type="file"]')
    fireEvent.change(input as HTMLInputElement, { target: { files: [audioFile('d.flac')] } })

    await waitFor(() => expect(screen.getAllByText('新标题').length).toBeGreaterThan(0))
    expect(readTagsQueued).toHaveBeenCalledTimes(1)
    expect(cache.writeCachedTags).toHaveBeenCalled()
  })
})
