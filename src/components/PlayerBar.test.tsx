import { fireEvent, render, waitFor } from '@testing-library/react'
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

function renderBar(current: Track) {
  return render(
    <PlayerBar
      track={current}
      playing={false}
      elapsed={0}
      duration={current.duration}
      volume={0.7}
      canSkip
      onTogglePlay={noop}
      onPrevious={noop}
      onNext={noop}
      onSeek={noop}
      onVolumeChange={noop}
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
