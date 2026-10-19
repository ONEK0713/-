/** 浏览器原生能解码的格式。ape / wma / dsd 不在其中，导入时直接过滤掉并提示。 */
export const AUDIO_EXTENSIONS = ['mp3', 'flac', 'm4a', 'aac', 'wav', 'ogg'] as const

export const AUDIO_ACCEPT = AUDIO_EXTENSIONS.map((ext) => `.${ext}`).join(',')

const AUDIO_RE = /\.(mp3|flac|m4a|aac|wav|ogg)$/i

export function isAudioFileName(name: string): boolean {
  return AUDIO_RE.test(name)
}

/** 去掉最后一个扩展名；`.gitignore` 这类以点开头的名字原样返回。 */
export function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

/** 秒 → `m:ss`（满一小时才显示 `h:mm:ss`）。未知或非法值统一显示 `0:00`。 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = String(total % 60).padStart(2, '0')
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${secs}`
  return `${minutes}:${secs}`
}
