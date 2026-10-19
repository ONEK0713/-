import { beforeEach, describe, expect, it } from 'vitest'
import { clearExcluded, loadExcluded, saveExcluded } from './exclusions'

const KEY = 'local-player:excluded:v2'
const LEGACY_KEY = 'local-player:excluded:v1'

beforeEach(() => {
  localStorage.clear()
})

describe('exclusions', () => {
  it('没存过时返回空表', () => {
    expect(loadExcluded()).toEqual([])
  })

  it('存进去再读回来是同一批记录', () => {
    saveExcluded([
      { id: 'a', title: '甲' },
      { id: 'b', title: '乙' },
    ])
    expect(loadExcluded()).toEqual([
      { id: 'a', title: '甲' },
      { id: 'b', title: '乙' },
    ])
  })

  it('内容坏掉时当空表，不抛错', () => {
    localStorage.setItem(KEY, '不是 JSON')
    expect(loadExcluded()).toEqual([])

    localStorage.setItem(KEY, JSON.stringify({ id: 'x' }))
    expect(loadExcluded()).toEqual([])
  })

  it('跳过缺少 id 或不是对象的项', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([{ id: 'ok', title: '好的' }, 42, null, { title: '没有 id' }, { id: 7 }]),
    )
    expect(loadExcluded()).toEqual([{ id: 'ok', title: '好的' }])
  })

  it('读取 v1 的纯 id 数组并补空标题', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(['old-a', 'old-b']))
    expect(loadExcluded()).toEqual([
      { id: 'old-a', title: '' },
      { id: 'old-b', title: '' },
    ])
  })

  it('v2 存在时不再看 v1', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(['old']))
    saveExcluded([{ id: 'new', title: '新' }])
    expect(loadExcluded()).toEqual([{ id: 'new', title: '新' }])
  })

  it('清空后两个版本都回到空表', () => {
    saveExcluded([{ id: 'a', title: '甲' }])
    localStorage.setItem(LEGACY_KEY, JSON.stringify(['b']))
    clearExcluded()
    expect(loadExcluded()).toEqual([])
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })
})
