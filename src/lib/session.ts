/**
 * 会话标记：sessionStorage 按标签页保存，刷新还在，关掉标签页就没了。
 *
 * 用它区分「刷新」和「重新打开」——只有前者才去 IndexedDB 里捞出上次的曲库；
 * 后者一进来就把残留的句柄清掉，避免"退出后再进"还能看见旧曲库。
 */
const SESSION_KEY = 'local-player:active'

export function isSessionActive(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    // 隐私模式禁用 storage：当作重新打开，不恢复。
    return false
  }
}

export function markSessionActive(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // 存不了就不恢复，能播就行。
  }
}

export function clearSessionActive(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // 同上。
  }
}
