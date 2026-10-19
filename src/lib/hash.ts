/**
 * 给封面算内容指纹：两路 FNV-1a 混着走，再拼上长度。
 * 不追求抗碰撞强度，只要同一张图得到同一个键、不同图不撞车就行；
 * 好处是不用等 crypto.subtle（Import 时同步算完就可以存）。
 */
export function hashBytes(bytes: Uint8Array): string {
  let a = 0x811c9dc5
  let b = 0x01000193
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index] ?? 0
    a = Math.imul(a ^ byte, 0x01000193) >>> 0
    b = (Math.imul(b + byte, 0x85ebca6b) >>> 0) ^ (b >>> 7)
    b = ((b << 13) | (b >>> 19)) >>> 0
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}${bytes.length.toString(16)}`
}
