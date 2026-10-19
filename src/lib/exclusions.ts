// 用户手动移除过的曲目，存在 localStorage 里：
// 重新扫描同一批文件时先跳过，不擅自把人家删掉的歌塞回来；
// 但这不是黑名单——再扫描时会给出「恢复并导入」，也可以点「撤销」当场撤回。
//
// 记 title 是为了以后能在"已排除"面板里列出来：没有文件句柄，只能靠 id + 标题。
// M1 接入 IndexedDB 缓存后这张表会一起搬进去，id 也会从
// "文件名+大小+修改时间" 换成相对路径。

export interface ExcludedTrack {
  id: string
  title: string
}

const STORAGE_KEY = 'local-player:excluded:v2'
// v1 只存了 id 数组，读到时补一个空标题，别让老数据失效。
const LEGACY_KEY = 'local-player:excluded:v1'

function normalize(raw: unknown): ExcludedTrack[] {
  if (!Array.isArray(raw)) return []
  const list: ExcludedTrack[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      list.push({ id: item, title: '' })
      continue
    }
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>
      if (typeof record.id === 'string') {
        list.push({ id: record.id, title: typeof record.title === 'string' ? record.title : '' })
      }
    }
  }
  return list
}

export function loadExcluded(): ExcludedTrack[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalize(JSON.parse(raw))
    const legacy = localStorage.getItem(LEGACY_KEY)
    return legacy ? normalize(JSON.parse(legacy)) : []
  } catch {
    // 隐私模式下 localStorage 可能直接抛错，JSON 也可能被人手改坏，都当空表处理。
    return []
  }
}

export function saveExcluded(list: ExcludedTrack[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // 存不了就算了，不影响本次会话内的移除。
  }
}

export function clearExcluded(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // 同上。
  }
}
