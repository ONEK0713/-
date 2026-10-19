import { describe, expect, it } from 'vitest'
import { mapLimit } from './concurrency'

describe('mapLimit', () => {
  it('保持输入顺序', async () => {
    const result = await mapLimit([1, 2, 3, 4, 5], 2, async (value) => value * 10)
    expect(result).toEqual([10, 20, 30, 40, 50])
  })

  it('并发不超过上限', async () => {
    let running = 0
    let peak = 0
    await mapLimit([0, 0, 0, 0, 0, 0], 3, async () => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running -= 1
    })
    expect(peak).toBe(3)
  })

  it('空数组直接返回空数组', async () => {
    await expect(mapLimit([], 4, async () => 1)).resolves.toEqual([])
  })
})
