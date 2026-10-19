// 用户手动移除过的曲目 id，存在 localStorage 里：
// 重新扫描同一个文件夹时，这些歌不会再冒出来。
// M1 接入 IndexedDB 缓存后，这张表会一起搬进去，key 也会从
// "文件名+大小+修改时间" 换成相对路径。

const STORAGE_KEY = 'local-player:excluded:v1'

export function loadExcluded(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    // 隐私模式下 localStorage 可能直接抛错，JSON 也可能被人手改坏，都当空表处理。
    return new Set()
  }
}

export function saveExcluded(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // 存不了就算了，不影响本次会话内的移除。
  }
}

export function clearExcluded(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 同上。
  }
}
