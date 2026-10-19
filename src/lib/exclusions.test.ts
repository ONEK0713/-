import { beforeEach, describe, expect, it } from 'vitest'
import { clearExcluded, loadExcluded, saveExcluded } from './exclusions'

const KEY = 'local-player:excluded:v1'

beforeEach(() => {
  localStorage.clear()
})

describe('exclusions', () => {
  it('没存过时返回空表', () => {
    expect(loadExcluded().size).toBe(0)
  })

  it('存进去再读回来是同一批 id', () => {
    saveExcluded(new Set(['a', 'b']))
    expect([...loadExcluded()].sort()).toEqual(['a', 'b'])
  })

  it('内容坏掉时当空表，不抛错', () => {
    localStorage.setItem(KEY, '不是 JSON')
    expect(loadExcluded().size).toBe(0)

    localStorage.setItem(KEY, JSON.stringify({ id: 'x' }))
    expect(loadExcluded().size).toBe(0)
  })

  it('忽略数组里的非字符串项', () => {
    localStorage.setItem(KEY, JSON.stringify(['ok', 42, null, { id: 'nope' }]))
    expect([...loadExcluded()]).toEqual(['ok'])
  })

  it('清空后回到空表', () => {
    saveExcluded(new Set(['a']))
    clearExcluded()
    expect(loadExcluded().size).toBe(0)
  })
})
