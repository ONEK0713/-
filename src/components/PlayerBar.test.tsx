import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '../types'
import PlayerBar from './PlayerBar'

vi.mock('../lib/meta-cache', () => ({
  readCover: vi.fn(async () => new Blob(['fake-cover'], { type: 'image/png' })),
}))

function track(overrides: Partial<Track> = {}): Track {
  return {
    id: 'a',
    path: 'a.flac',
    title: '亏欠',
    artist: '张震岳',
    album: '跟着感觉走',
    duration: 243,
    src: 'blob:mock',
    coverHash: null,
    tagState: 'ready',
    ...overrides,
  }
}

const noop = () => {}

function renderBar(current: Track, overrides: Partial<Parameters<typeof PlayerBar>[0]> = {}) {
  return render(
    <PlayerBar
      track={current}
      playing={false}
      elapsed={0}
      duration={current.duration}
      volume={0.7}
      muted={false}
      mode="order"
      canSkip
      onTogglePlay={noop}
      onPrevious={noop}
      onNext={noop}
      onSeek={noop}
      onVolumeChange={noop}
      onToggleMute={noop}
      onCycleMode={noop}
      {...overrides}
    />,
  )
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:cover')
  URL.revokeObjectURL = vi.fn()
})

describe('PlayerBar 封面', () => {
  it('有封面指纹时显示图片', async () => {
    const { container } = renderBar(track({ coverHash: 'abc123' }))
    await waitFor(() => expect(container.querySelector('.cover img')).not.toBeNull(), { timeout: 3000 })
    expect(container.querySelector('.cover img')).toHaveAttribute('src', 'blob:cover')
  })

  it('没有封面时退回音符占位', () => {
    const { container } = renderBar(track())
    expect(container.querySelector('.cover img')).toBeNull()
    expect(container.querySelector('.cover span')?.textContent).toBe('♪')
  })

  it('封面解码失败时退回音符占位，不留破图标', async () => {
    const { container } = renderBar(track({ coverHash: 'abc123' }))
    const image = await waitFor(
      () => {
        const found = container.querySelector('.cover img')
        if (!found) throw new Error('还没渲染出图片')
        return found
      },
      { timeout: 3000 },
    )

    fireEvent.error(image)

    await waitFor(() => expect(container.querySelector('.cover img')).toBeNull(), { timeout: 3000 })
    expect(container.querySelector('.cover span')?.textContent).toBe('♪')
  })
})

describe('PlayerBar 模式与静音', () => {
  it('点模式按钮切换播放模式', () => {
    const onCycleMode = vi.fn()
    renderBar(track(), { onCycleMode })
    fireEvent.click(screen.getByRole('button', { name: /播放模式/ }))
    expect(onCycleMode).toHaveBeenCalledTimes(1)
  })

  it('模式按钮上的名字跟着模式变', () => {
    renderBar(track(), { mode: 'shuffle' })
    expect(screen.getByRole('button', { name: '播放模式：随机播放' })).toBeInTheDocument()
  })

  it('静音时按钮变成取消静音，并带 aria-pressed', () => {
    const onToggleMute = vi.fn()
    renderBar(track(), { onToggleMute, muted: true })
    const button = screen.getByRole('button', { name: '取消静音' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(button)
    expect(onToggleMute).toHaveBeenCalledTimes(1)
  })
})
