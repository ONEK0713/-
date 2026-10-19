import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { LibrarySources } from './lib/meta-cache'

// 真解析要读真实的音频字节，测试里用假的 File 必然失败；这里给一个稳定的假标签源。
vi.mock('./lib/tags', () => ({
  readTagsQueued: vi.fn(async (file: File) => ({
    tags: {
      title: file.name.replace(/\.[^.]+$/, ''),
      artist: '测试歌手',
      album: '测试专辑',
      trackNo: null,
      year: null,
      duration: 200,
      coverHash: null,
      coverBytes: 0,
      codec: 'FLAC',
      lossless: true,
    },
    cover: null,
  })),
}))

// jsdom 没有 IndexedDB，这里直接替换成内存里的假实现，好控制"上次的曲库"。
const store = vi.hoisted(() => ({
  sources: { dirs: [], files: [] } as LibrarySources,
  readSources: vi.fn(),
  writeSources: vi.fn(async () => {}),
  clearSources: vi.fn(async () => {}),
  clearCachedTags: vi.fn(async () => {}),
}))

vi.mock('./lib/meta-cache', () => ({
  cacheKey: () => 'cache-key',
  readCachedTags: async () => null,
  writeCachedTags: async () => {},
  clearCachedTags: store.clearCachedTags,
  hasCover: async () => true,
  writeCover: async () => {},
  readCover: async () => null,
  readSources: store.readSources,
  writeSources: store.writeSources,
  clearSources: store.clearSources,
}))

const SESSION_KEY = 'local-player:active'

function audioFile(name: string): File {
  return new File(['fake-audio'], name, { type: 'audio/flac' })
}

function fileHandle(name: string): FileSystemFileHandle {
  const file = audioFile(name)
  return Object.assign({}, { kind: 'file', name, getFile: async () => file }) as unknown as FileSystemFileHandle
}

function dirHandle(name: string, entries: unknown[]): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
    async *values() {
      yield* entries
    },
  } as unknown as FileSystemDirectoryHandle
}

beforeEach(() => {
  sessionStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  store.readSources.mockReset()
  store.writeSources.mockClear()
  store.clearSources.mockClear()
  store.clearCachedTags.mockClear()
})

describe('刷新后恢复曲库', () => {
  it('这个标签页刷新过：从句柄把上次的文件读回来', async () => {
    sessionStorage.setItem(SESSION_KEY, '1')
    store.readSources.mockResolvedValue({
      dirs: [dirHandle('music', [fileHandle('a.flac'), fileHandle('b.mp3')])],
      files: [],
    } satisfies LibrarySources)

    render(<App />)

    // 恢复是异步的：先等列表出来（空曲库时根本没有 list 这个角色）。
    const list = within(await screen.findByRole('list', { name: '曲库列表' }))
    await waitFor(() => expect(list.getAllByRole('listitem')).toHaveLength(2))
    expect(list.getByText('a')).toBeInTheDocument()
    expect(store.clearSources).not.toHaveBeenCalled()
  })

  it('重新打开标签页：不恢复，并且把残留的来源清单清掉', async () => {
    store.readSources.mockResolvedValue({
      dirs: [dirHandle('music', [fileHandle('a.flac')])],
      files: [],
    } satisfies LibrarySources)

    render(<App />)

    await waitFor(() => expect(store.clearSources).toHaveBeenCalled())
    expect(store.readSources).not.toHaveBeenCalled()
    expect(screen.getByText('曲库还是空的')).toBeInTheDocument()
  })

  it('清空曲库后刷新也不会再回来', async () => {
    sessionStorage.setItem(SESSION_KEY, '1')
    store.readSources.mockResolvedValue({
      dirs: [dirHandle('music', [fileHandle('a.flac')])],
      files: [],
    } satisfies LibrarySources)

    render(<App />)
    await waitFor(() =>
      expect(within(screen.getByRole('list', { name: '曲库列表' })).getAllByRole('listitem')).toHaveLength(1),
    )

    const topbar = within(screen.getByRole('banner'))
    await userEvent.click(topbar.getByRole('button', { name: '清空曲库' }))
    await userEvent.click(topbar.getByRole('button', { name: '确定清空？' }))

    await waitFor(() => expect(store.clearSources).toHaveBeenCalled())
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
    expect(store.clearCachedTags).toHaveBeenCalled()
  })

  it('恢复时读不到的目录不报错，列表照常为空', async () => {
    sessionStorage.setItem(SESSION_KEY, '1')
    const doomed = {
      kind: 'directory',
      name: 'gone',
      async *values() {
        throw new DOMException('没有权限', 'NotAllowedError')
      },
    } as unknown as FileSystemDirectoryHandle
    store.readSources.mockResolvedValue({ dirs: [doomed], files: [] } satisfies LibrarySources)

    render(<App />)

    await waitFor(() => expect(screen.getByText(/上次的曲库读不到了/)).toBeInTheDocument())
    expect(screen.getByText('曲库还是空的')).toBeInTheDocument()
    // 失效目录被写回清单，下次不再卡在它上面。
    await waitFor(() => expect(store.writeSources).toHaveBeenCalledWith({ dirs: [], files: [] }))
  })
})
