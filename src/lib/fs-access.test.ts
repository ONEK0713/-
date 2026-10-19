import { describe, expect, it, vi, afterEach } from 'vitest'
import { collectAudioFiles, ensurePermission, pickDirectory, supportsDirectoryPicker } from './fs-access'

function fileHandle(name: string): FileSystemFileHandle {
  const file = new File([new Uint8Array([1, 2, 3])], name)
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

describe('collectAudioFiles', () => {
  it('递归收集音频，路径用 / 拼，非音频和隐藏文件跳过', async () => {
    const root = dirHandle('music', [
      fileHandle('a.flac'),
      fileHandle('notes.txt'),
      fileHandle('._b.mp3'),
      dirHandle('cd1', [fileHandle('01.mp3'), fileHandle('.DS_Store')]),
      dirHandle('node_modules', [fileHandle('evil.mp3')]),
      dirHandle('.git', [fileHandle('hidden.mp3')]),
    ])

    const files = await collectAudioFiles(root)

    expect(files.map((entry) => entry.path)).toEqual(['a.flac', 'cd1/01.mp3'])
    expect(files[1]?.file.name).toBe('01.mp3')
  })

  it('空目录返回空数组', async () => {
    expect(await collectAudioFiles(dirHandle('empty', []))).toEqual([])
  })
})

describe('ensurePermission', () => {
  const withPermission = (query: PermissionState | null, request?: PermissionState) =>
    ({
      kind: 'directory',
      name: 'music',
      ...(query ? { queryPermission: vi.fn(async () => query) } : {}),
      ...(request ? { requestPermission: vi.fn(async () => request) } : {}),
    }) as unknown as FileSystemDirectoryHandle

  it('已授权时直接放行', async () => {
    expect(await ensurePermission(withPermission('granted'), false)).toBe(true)
  })

  it('未授权且不申请时返回 false', async () => {
    expect(await ensurePermission(withPermission('prompt'), false)).toBe(false)
  })

  it('用户手势里能申请到权限', async () => {
    expect(await ensurePermission(withPermission('prompt', 'granted'), true)).toBe(true)
  })

  it('申请被拒返回 false', async () => {
    expect(await ensurePermission(withPermission('prompt', 'denied'), true)).toBe(false)
  })

  it('老实现没有权限 API 时按可读处理', async () => {
    expect(await ensurePermission(withPermission(null), false)).toBe(true)
  })
})

describe('supportsDirectoryPicker / pickDirectory', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'showDirectoryPicker')
  })

  it('jsdom 里默认不支持', () => {
    expect(supportsDirectoryPicker()).toBe(false)
    expect(pickDirectory).toBeTypeOf('function')
  })

  it('用户取消返回 null', async () => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => {
        throw new DOMException('用户取消', 'AbortError')
      },
    })
    await expect(pickDirectory()).resolves.toBeNull()
  })

  it('其它错误向上抛', async () => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => {
        throw new DOMException('没有权限', 'SecurityError')
      },
    })
    await expect(pickDirectory()).rejects.toThrow('没有权限')
  })

  it('正常选择时返回句柄', async () => {
    const handle = dirHandle('music', [])
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => handle,
    })
    await expect(pickDirectory()).resolves.toBe(handle)
  })
})
