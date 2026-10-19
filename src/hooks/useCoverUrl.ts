import { useEffect, useState } from 'react'
import { readCover } from '../lib/meta-cache'

/**
 * 把封面指纹变成能塞进 <img> 的地址。封面存在 IndexedDB 里，
 * 每次切换曲目读一次、卸载时回收，避免 blob URL 泄漏。
 */
export function useCoverUrl(hash: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    setUrl(null)
    if (!hash) return

    let cancelled = false
    let objectUrl: string | null = null

    readCover(hash)
      .then((blob) => {
        if (cancelled || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        // 读不到封面就当没有，播放条退回渐变底。
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [hash])

  return url
}
