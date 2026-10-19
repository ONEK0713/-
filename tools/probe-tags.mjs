// 临时探针：用真实文件验证 “parseBlob + fixMojibake” 这条链，确认浏览器里也会得到干净标签。
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { parseBlob } from 'music-metadata'

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const LATIN1_HIGH = /[\u00a0-\u00ff]/
const SPACE = /\s/

function visibleChars(text) {
  return Array.from(text).filter((char) => !SPACE.test(char))
}
function cjkRatio(text) {
  const chars = visibleChars(text)
  return chars.length ? chars.filter((char) => CJK.test(char)).length / chars.length : 0
}
function highByteRatio(text) {
  const chars = visibleChars(text)
  return chars.length ? chars.filter((char) => LATIN1_HIGH.test(char)).length / chars.length : 0
}
function fixMojibake(text) {
  if (!text || CJK.test(text) || !LATIN1_HIGH.test(text)) return text
  if (highByteRatio(text) < 0.5) return text
  const bytes = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    if (code > 0xff) return text
    bytes[index] = code
  }
  try {
    const decoded = new TextDecoder('gbk').decode(bytes)
    if (decoded.includes('\ufffd')) return text
    return cjkRatio(decoded) < 0.3 ? text : decoded
  } catch {
    return text
  }
}

const files = process.argv.slice(2)
for (const file of files) {
  const bytes = await readFile(file)
  const blob = new Blob([bytes])
  const t0 = Date.now()
  const result = await parseBlob(blob, { duration: true })
  const ms = Date.now() - t0
  const { common } = result
  const pics = common.picture ?? []
  console.log(
    [
      basename(file),
      fixMojibake(common.title ?? ''),
      fixMojibake(common.artist ?? ''),
      fixMojibake(common.album ?? ''),
      Math.round(result.format.duration ?? 0),
      `${pics.length} 图`,
      `${ms}ms`,
    ].join(' | '),
  )
}
