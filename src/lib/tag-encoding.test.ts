import { describe, expect, it } from 'vitest'
import { fixMojibake } from './tag-encoding'

describe('fixMojibake', () => {
  it('把 GBK 乱码还原成中文', () => {
    expect(fixMojibake('ÂÞ×¯µÄ¶¬Ìì')).toBe('罗庄的冬天')
    expect(fixMojibake('ÀîÖ¾')).toBe('李志')
  })

  it('正常中文原样返回', () => {
    expect(fixMojibake('张震岳')).toBe('张震岳')
    expect(fixMojibake('跟着感觉走')).toBe('跟着感觉走')
  })

  it('纯 ASCII 原样返回', () => {
    expect(fixMojibake('Jay')).toBe('Jay')
    expect(fixMojibake('')).toBe('')
  })

  it('合法的西文重音字符不会被改坏', () => {
    expect(fixMojibake('Café')).toBe('Café')
    expect(fixMojibake('Björk')).toBe('Björk')
  })

  it('已经出现中文的字符串不再猜', () => {
    expect(fixMojibake('罗庄的冬天 ÂÞ')).toBe('罗庄的冬天 ÂÞ')
  })
})
