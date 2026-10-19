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

// 与 App 里保持一致：文件名 + 大小 + 修改时间
function trackId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`
}

const EXCLUDED_KEY = 'local-player:excluded:v2'

function storedExcluded(): { id: string; title: string }[] {
  const raw = localStorage.getItem(EXCLUDED_KEY)
  return raw ? (JSON.parse(raw) as { id: string; title: string }[]) : []
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

  it('空曲库时不显示清空按钮', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: '清空曲库' })).not.toBeInTheDocument()
  })

  it('移除过的歌重新导入时先跳过，但可以一键恢复', async () => {
    const alpha = audioFile('alpha.flac')
    const beta = audioFile('beta.flac')
    const { container } = render(<App />)
    fireEvent.change(pickFileInput(container), { target: { files: [alpha, beta] } })

    await userEvent.click(screen.getByRole('button', { name: '从曲库移除 alpha' }))
    expect(storedExcluded().map((entry) => entry.id)).toContain(trackId(alpha))

    // 再选一次同样的文件：alpha 不会自动回来。
    fireEvent.change(pickFileInput(container), { target: { files: [alpha, beta] } })

    const list = within(screen.getByRole('list', { name: '曲库列表' }))
    expect(list.queryByText('alpha')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 首你之前移除过，没有自动导入')

    // 但不是永久删除：点「恢复并导入」就能拿回来。
    await userEvent.click(screen.getByRole('button', { name: '恢复并导入' }))
    expect(list.getByText('alpha')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('已导入 1 首')
    // 进了曲库就不再算"移除过"，再扫一次也不会再跳过它。
    expect(storedExcluded()).toEqual([])
  })

  it('恢复并导入不用再选一次文件，扫到的文件对象还在', async () => {
    const alpha = audioFile('alpha.flac')
    localStorage.setItem(EXCLUDED_KEY, JSON.stringify([{ id: trackId(alpha), title: 'alpha' }]))

    const { container } = render(<App />)
    fireEvent.change(pickFileInput(container), {
      target: { files: [alpha, audioFile('beta.flac')] },
    })

    const list = within(screen.getByRole('list', { name: '曲库列表' }))
    expect(list.queryByText('alpha')).not.toBeInTheDocument()
    // 扫描时文件对象已经在手里，点一下就能放回列表，不用重新选文件夹。
    await userEvent.click(screen.getByRole('button', { name: '恢复并导入' }))
    expect(list.getByText('alpha')).toBeInTheDocument()
  })

  it('新开页面也记得移除过哪些歌', () => {
    const alpha = audioFile('alpha.flac')
    localStorage.setItem(
      EXCLUDED_KEY,
      JSON.stringify([{ id: trackId(alpha), title: 'alpha' }]),
    )

    const { container } = render(<App />)
    fireEvent.change(pickFileInput(container), {
      target: { files: [alpha, audioFile('beta.flac')] },
    })

    const list = within(screen.getByRole('list', { name: '曲库列表' }))
    expect(list.queryByText('alpha')).not.toBeInTheDocument()
    expect(list.getByText('beta')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('已导入 1 首，1 首你移除过，已跳过')
  })

  it('移除后可以撤销，歌回到原位且不再被排除', async () => {
    const alpha = audioFile('alpha.flac')
    const { container } = render(<App />)
    fireEvent.change(pickFileInput(container), {
      target: { files: [alpha, audioFile('beta.flac'), audioFile('gamma.flac')] },
    })

    await userEvent.click(screen.getByRole('button', { name: '从曲库移除 alpha' }))
    await userEvent.click(screen.getByRole('button', { name: '撤销' }))

    const titles = within(screen.getByRole('list', { name: '曲库列表' }))
      .getAllByRole('listitem')
      .map((row) => row.querySelector('.title')?.textContent)
    expect(titles).toEqual(['alpha', 'beta', 'gamma'])
    expect(storedExcluded().map((entry) => entry.id)).not.toContain(trackId(alpha))
    expect(screen.getByRole('status')).toHaveTextContent('已恢复《alpha》')
  })

  it('清空曲库时也清掉"别再导入"的记录', async () => {
    const { container } = render(<App />)
    fireEvent.change(pickFileInput(container), {
      target: { files: [audioFile('alpha.flac'), audioFile('beta.flac')] },
    })

    await userEvent.click(screen.getByRole('button', { name: '从曲库移除 alpha' }))
    expect(storedExcluded()).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: '清空曲库' }))
    await userEvent.click(screen.getByRole('button', { name: '确定清空？' }))

    expect(localStorage.getItem(EXCLUDED_KEY)).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('移除记录也一起清了')
  })
})
