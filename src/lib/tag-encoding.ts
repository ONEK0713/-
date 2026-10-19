// 有些 mp3 的 ID3v2 头把编码声明成 ISO-8859-1，实际写进去的是 GBK——国产压制工具的
// 老毛病。解析器照声明解码，就得到“ÂÞ×¯µÄ¶¬Ìì”这种乱码；这里把字符按字节还原一次，
// 猜得比原文更像中文就换掉。
//
// 判断不能只看“解出来有汉字”：`Björk` 按 GBK 解也会得到 `Bj鰎k`。经验是
// 真乱码几乎全由 U+00A0–U+00FF 的字符组成（每个汉字两个字节，两个都落在高位区），
// 而正常西文里重音字母是少数。所以要求：高位字符占比 ≥ 一半，且解出来的汉字也占三成以上。

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const LATIN1_HIGH = /[\u00a0-\u00ff]/
const SPACE = /\s/

function visibleChars(text: string): string[] {
  return Array.from(text).filter((char) => !SPACE.test(char))
}

function cjkRatio(text: string): number {
  const chars = visibleChars(text)
  if (chars.length === 0) return 0
  const cjk = chars.filter((char) => CJK.test(char)).length
  return cjk / chars.length
}

function highByteRatio(text: string): number {
  const chars = visibleChars(text)
  if (chars.length === 0) return 0
  const high = chars.filter((char) => LATIN1_HIGH.test(char)).length
  return high / chars.length
}

export function fixMojibake(text: string): string {
  if (!text || CJK.test(text) || !LATIN1_HIGH.test(text)) return text
  if (highByteRatio(text) < 0.5) return text

  const bytes = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    // 出现 U+00FF 以上的字符说明它不是“字节被当成字符”的产物，别猜了。
    if (code > 0xff) return text
    bytes[index] = code
  }

  try {
    const decoded = new TextDecoder('gbk').decode(bytes)
    if (decoded.includes('\ufffd')) return text
    if (cjkRatio(decoded) < 0.3) return text
    return decoded
  } catch {
    // 环境没有 GBK 解码器（少见）就原样返回，不要让标签解析整个失败。
    return text
  }
}
