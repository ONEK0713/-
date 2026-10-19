import { describe, expect, it, afterEach } from 'vitest'
import { collectAudioFiles, pickDirectory, supportsDirectoryPicker } from './fs-access'

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
