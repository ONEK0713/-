import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { readTagsQueued } from './lib/tags'

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

function pickFileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]')
  if (!(input instanceof HTMLInputElement)) throw new Error('找不到文件输入框')
  return input
}

function audioFile(name: string): File {
  return new File(['fake-audio'], name, { type: 'audio/flac' })
}

beforeEach(() => {
  localStorage.clear()
  // jsdom 没有实现 createObjectURL，桩掉即可（只验证 UI 行为）。
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
  // jsdom 的 HTMLMediaElement.play 会抛 "not implemented"，直接桩成静默成功。
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})

describe('App', () => {
  it('没有导入时显示空态和一个导入入口', () => {
    render(<App />)
    expect(screen.getByText('曲库还是空的')).toBeInTheDocument()
    expect(screen.getByText('未播放')).toBeInTheDocument()
    // 顶栏和空态里各一个「导入音乐」，是同一个控件放在两处。
    expect(screen.getAllByRole('button', { name: /导入音乐/ })).toHaveLength(2)
  })

  it('右下角没有队列了：既没有抽屉也没有入口按钮', () => {
    render(<App />)
    expect(screen.queryByRole('complementary', { name: '播放队列' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /队列/ })).not.toBeInTheDocument()
  })

  it('导入按钮展开两条路：文件夹和文件', async () => {
    render(<App />)
    const topbar = within(screen.getByRole('banner'))
    const trigger = topbar.getByRole('button', { name: /导入音乐/ })

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const menu = within(screen.getByRole('menu', { name: '导入方式' }))
    // 注意「选择文件夹」里也含「选择文件」，用否定前瞻区分开。
    expect(menu.getByRole('menuitem', { name: /^选择文件夹/ })).toBeInTheDocument()
    expect(menu.getByRole('menuitem', { name: /^选择文件(?!夹)/ })).toBeInTheDocument()

    // 选完一种就收起，不留一个挂着的菜单。
    await userEvent.click(menu.getByRole('menuitem', { name: /^选择文件夹/ }))
    expect(screen.queryByRole('menu', { name: '导入方式' })).not.toBeInTheDocument()
  })

  it('菜单可以按 Escape 关掉', async () => {
    render(<App />)
    await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: /导入音乐/ }))
    expect(screen.getByRole('menu', { name: '导入方式' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu', { name: '导入方式' })).not.toBeInTheDocument()
  })

  it('导入文件后按文件名出现在列表里，并提示导入数量', () => {
    const { container } = render(<App />)
    fireEvent.change(pickFileInput(container), {
      target: { files: [audioFile('张震岳-亏欠.flac'), audioFile('张震岳-浪人的….flac')] },
    })

    // 当前曲目也会出现在底部播放条上，所以断言收在列表里，避免重复匹配。
    const list = within(screen.getByRole('list', { name: '曲库列表' }))
    expect(list.getByText('张震岳-亏欠')).toBeInTheDocument()
    expect(list.getByText('张震岳-浪人的…')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('已导入 2 首')
  })

  it('导入后回填真实歌手、专辑与时长', async () => {
    const { container } = render(<App />)
    fireEvent.change(pickFileInput(container), { target: { files: [audioFile('alpha.flac')] } })

    const list = within(screen.getByRole('list', { name: '曲库列表' }))
    await waitFor(() => expect(list.getByText('测试歌手')).toBeInTheDocument())
    expect(list.getByText('测试专辑')).toBeInTheDocument()
    expect(list.getByText('3:20')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('已导入 1 首')
  })

  it('非音频文件被跳过并给出提示', () => {
    const { container } = render(<App />)
    fireEvent.change(pickFileInput(container), {
      target: { files: [new File(['x'], 'cover.jpg', { type: 'image/jpeg' })] },
    })

    expect(screen.getByRole('status')).toHaveTextContent('没有找到可播放的音频')
  })

  it('搜索框按标题、歌手、专辑过滤列表', async () => {
    const { container } = render(<App />)
    fireEvent.change(pickFileInput(container), {
      target: { files: [audioFile('alpha.flac'), audioFile('beta.flac')] },
    })

    await userEvent.type(screen.getByLabelText('搜索歌曲'), 'alp')
    const list = within(screen.getByRole('list', { name: '曲库列表' }))
    expect(list.getByText('alpha')).toBeInTheDocument()
    expect(list.queryByText('beta')).not.toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('搜索歌曲'))
    await userEvent.type(screen.getByLabelText('搜索歌曲'), '没有这个')
    expect(screen.getByText('没有匹配的歌曲')).toBeInTheDocument()
  })

  it('可以移除单曲，只影响列表，不动源文件', async () => {
    const { container } = render(<App />)
    fireEvent.change(pickFileInput(container), {
      target: { files: [audioFile('alpha.flac'), audioFile('beta.flac')] },
    })

    await userEvent.click(screen.getByRole('button', { name: '从曲库移除 alpha' }))

    const list = within(screen.getByRole('list', { name: '曲库列表' }))
    expect(list.queryByText('alpha')).not.toBeInTheDocument()
    expect(list.getByText('beta')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('已移除《alpha》，源文件没动')
  })

  it('移除正在播放的曲目后播放条回到未播放', async () => {
    const { container } = render(<App />)
    fireEvent.change(pickFileInput(container), {
      target: { files: [audioFile('alpha.flac'), audioFile('beta.flac')] },
    })

    const list = within(screen.getByRole('list', { name: '曲库列表' }))
    await userEvent.click(list.getByText('alpha'))
    expect(screen.getByRole('button', { name: '从曲库移除 alpha' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '从曲库移除 alpha' }))

    expect(screen.getByText('未播放')).toBeInTheDocument()
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  })

  it('清空曲库要点两下，避免手滑', async () => {
    const { container } = render(<App />)
    fireEvent.change(pickFileInput(container), {
      target: { files: [audioFile('alpha.flac'), audioFile('beta.flac')] },
    })

    await userEvent.click(screen.getByRole('button', { name: '清空曲库' }))
    // 第一下只是变文案，列表还在。
    expect(screen.getByRole('button', { name: '确定清空？' })).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: '曲库列表' })).getByText('beta')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '确定清空？' }))
    expect(screen.getByText('曲库还是空的')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('曲库已清空，源文件没动')
  })

  it('清空曲库后，还在读的那批标签不会再改提示', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    vi.mocked(readTagsQueued).mockImplementationOnce(async () => {
      await gate
      return {
        tags: {
          title: '迟到的标签',
          artist: '迟到的歌手',
          album: '',
          trackNo: null,
          year: null,
          duration: 100,
          coverHash: null,
          coverBytes: 0,
          codec: 'FLAC',
          lossless: true,
        },
        cover: null,
      }
    })

    const { container } = render(<App />)
    fireEvent.change(pickFileInput(container), { target: { files: [audioFile('slow.flac')] } })

    await userEvent.click(screen.getByRole('button', { name: '清空曲库' }))
    await userEvent.click(screen.getByRole('button', { name: '确定清空？' }))

    release()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('曲库已清空'))
    expect(screen.queryByText('迟到的歌手')).not.toBeInTheDocument()
  })

  it('空曲库时不显示清空按钮', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: '清空曲库' })).not.toBeInTheDocument()
  })


  it('移除过的歌再导入时直接进列表，不用点恢复', async () => {
    const alpha = audioFile('alpha.flac')
    const beta = audioFile('beta.flac')
    const { container } = render(<App />)
    fireEvent.change(pickFileInput(container), { target: { files: [alpha, beta] } })

    await userEvent.click(screen.getByRole('button', { name: '从曲库移除 alpha' }))
    expect(within(screen.getByRole('list', { name: '曲库列表' })).queryByText('alpha')).not.toBeInTheDocument()

    // 再选一次同样的文件：alpha 就是正常导入，不该被拦下来。
    fireEvent.change(pickFileInput(container), { target: { files: [alpha, beta] } })

    const list = within(screen.getByRole('list', { name: '曲库列表' }))
    expect(list.getByText('alpha')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('已导入 1 首')
    expect(screen.queryByRole('button', { name: '恢复并导入' })).not.toBeInTheDocument()
  })

  it('移除后可以撤销，歌回到原位', async () => {
    const { container } = render(<App />)
    fireEvent.change(pickFileInput(container), {
      target: { files: [audioFile('alpha.flac'), audioFile('beta.flac'), audioFile('gamma.flac')] },
    })

    await userEvent.click(screen.getByRole('button', { name: '从曲库移除 alpha' }))
    await userEvent.click(screen.getByRole('button', { name: '撤销' }))

    const titles = within(screen.getByRole('list', { name: '曲库列表' }))
      .getAllByRole('listitem')
      .map((row) => row.querySelector('.title')?.textContent)
    expect(titles).toEqual(['alpha', 'beta', 'gamma'])
    expect(screen.getByRole('status')).toHaveTextContent('已恢复《alpha》')
  })

  it('移除不写本地存储：刷新后没有任何"别再导入"的残留', async () => {
    const { container } = render(<App />)
    fireEvent.change(pickFileInput(container), {
      target: { files: [audioFile('alpha.flac'), audioFile('beta.flac')] },
    })

    await userEvent.click(screen.getByRole('button', { name: '从曲库移除 alpha' }))
    expect(Object.keys(localStorage)).toEqual([])
  })
})
