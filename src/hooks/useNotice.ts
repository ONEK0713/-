import { useCallback, useEffect, useState } from 'react'

/** 提示条上可选的一个动作（目前只用来放「撤销」）。 */
export interface NoticeAction {
  label: string
  onClick: () => void
}

export interface Notice {
  text: string
  action?: NoticeAction
}

/** 各处的提示统一走这个签名。 */
export type Notify = (text: string, action?: NoticeAction) => void

/** 普通提示 3.2 秒；带动作的多留一会儿，不然读完再挪鼠标去点就来不及。 */
const PLAIN_MS = 3200
const ACTION_MS = 5000

export function useNotice() {
  const [notice, setNotice] = useState<Notice | null>(null)

  const notify = useCallback((text: string, action?: NoticeAction) => {
    setNotice(action ? { text, action } : { text })
  }, [])

  const dismiss = useCallback(() => setNotice(null), [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), notice.action ? ACTION_MS : PLAIN_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  return { notice, notify, dismiss }
}
