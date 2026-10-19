import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

function pickFileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]')
  if (!(input instanceof HTMLInputElement)) throw new Error('找不到文件输入框')
  return input
}

function audioFile(name: string): File {
  return new File(['fake-audio'], name, { type: 'audio/flac' })
}

beforeEach(() => {
  // jsdom 没有实现 createObjectURL，桩掉即可（只验证 UI 行为）。
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
  // jsdom 的 HTMLMediaElement.play 会抛 "not implemented"，直接桩成静默成功。
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})

describe('App', () => {
  it('没有导入时显示空态和两个导入入口', () => {
    render(<App />)
    expect(screen.getByText('曲库还是空的')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择文件夹' })).toBeInTheDocument()
    expect(screen.getByText('未播放')).toBeInTheDocument()
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
    expect(screen.getByRole('status')).toHaveTextContent('已从曲库移除《alpha》，源文件没动')
    // 只该回收被移除那首的 blob URL。
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
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

  it('空曲库时不显示清空按钮', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: '清空曲库' })).not.toBeInTheDocument()
  })
})
