import { describe, expect, it } from 'vitest'
import { hashBytes } from './hash'

describe('hashBytes', () => {
  it('同样的内容得到同样的指纹', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    expect(hashBytes(bytes)).toBe(hashBytes(new Uint8Array([1, 2, 3, 4, 5])))
  })

  it('一个字节不同就换个指纹', () => {
    expect(hashBytes(new Uint8Array([1, 2, 3]))).not.toBe(hashBytes(new Uint8Array([1, 2, 4])))
  })

  it('顺序不同算不同内容', () => {
    expect(hashBytes(new Uint8Array([1, 2]))).not.toBe(hashBytes(new Uint8Array([2, 1])))
  })

  it('空内容也有稳定指纹', () => {
    expect(hashBytes(new Uint8Array())).toBe(hashBytes(new Uint8Array()))
  })
})
