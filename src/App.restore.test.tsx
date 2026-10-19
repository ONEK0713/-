import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// 权限状态由测试控制：默认有权限（启动就静默恢复），也能切成"需要用户点一下"。
const state = vi.hoisted(() => ({ permission: true, collectCalls: 0 }))

vi.mock('./lib/tags', () => ({
  readTagsQueued: async () => ({
    tags: {
      title: '浪人的…',
      artist: '张震岳',
      album: '跟着感觉走',
      trackNo: null,
      year: null,
      duration: 248,
      coverHash: null,
      coverBytes: 0,
      codec: 'flac',
      lossless: true,
    },
    cover: null,
  }),
  disposeTagWorkers: () => {},
}))

vi.mock('./lib/fs-access', () => ({
  supportsDirectoryPicker: () => true,
  pickDirectory: async () => null,
  ensurePermission: async () => state.permission,
  collectAudioFiles: async () => {
    state.collectCalls += 1
    return [{ file: new File([new Uint8Array([1, 2])], 'a.flac'), path: '跟着感觉走/a.flac' }]
  },
}))

vi.mock('./lib/meta-cache', () => ({
  cacheKey: () => 'k',
  readCachedTags: async () => null,
  writeCachedTags: async () => {},
  clearCachedTags: async () => {},
  hasCover: async () => true,
  writeCover: async () => {},
  readCover: async () => null,
  readLibraryHandle: async () => ({ kind: 'directory', name: '音乐' }),
  writeLibraryHandle: async () => {},
  clearLibraryHandle: async () => {},
}))

beforeEach(() => {
  state.permission = true
  state.collectCalls = 0
  URL.createObjectURL = vi.fn(() => 'blob:fake')
  URL.revokeObjectURL = vi.fn()
})

describe('上次的曲库', () => {
  it('有句柄且有权限时，启动就把曲库恢复回来', async () => {
    render(<App />)

    const list = await screen.findByRole('list', { name: '曲库列表' })
    await waitFor(() => expect(list).toHaveTextContent('张震岳'))
    expect(state.collectCalls).toBe(1)
  })

  it('权限过期时留一个按钮，点一下再授权并恢复', async () => {
    state.permission = false
    const user = userEvent.setup()
    render(<App />)

    const button = await screen.findByRole('button', { name: '继续上次的曲库' })
    expect(screen.queryByRole('list', { name: '曲库列表' })).toBeNull()

    state.permission = true
    await user.click(button)

    const list = await screen.findByRole('list', { name: '曲库列表' })
    await waitFor(() => expect(list).toHaveTextContent('张震岳'))
    expect(state.collectCalls).toBe(1)
  })
})
