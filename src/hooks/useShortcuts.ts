import { useEffect, useRef } from 'react'
import { SEEK_STEP, SEEK_STEP_LARGE, VOLUME_STEP } from './usePlayback'

interface ShortcutHandlers {
  togglePlay: () => void
  seekBy: (seconds: number) => void
  step: (delta: number) => void
  changeVolumeBy: (delta: number) => void
  toggleMute: () => void
  focusSearch: () => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * 键盘快捷键：
 * 空格 播放/暂停 · ←/→ 退/进 5 秒（Shift 30 秒）· Ctrl+←/→ 上/下一首
 * ↑/↓ 音量 ±5% · M 静音 · / 聚焦搜索 · Esc 从输入框退出
 * 在输入框或滑杆里打字/调值时一律让原生行为优先。
 */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.metaKey) return

      const handlersNow = handlersRef.current
      const typing = isTypingTarget(event.target)

      if (typing) {
        // 只放行 Esc：把焦点从搜索框里放出来。
        if (event.key === 'Escape') {
          ;(event.target as HTMLElement).blur()
        }
        return
      }

      const seekStep = event.shiftKey ? SEEK_STEP_LARGE : SEEK_STEP

      switch (event.key) {
        case ' ':
          // 阻止页面滚动，否则空格会把列表往下翻。
          event.preventDefault()
          if (!event.repeat) handlersNow.togglePlay()
          break
        case 'ArrowLeft':
          event.preventDefault()
          if (event.ctrlKey) handlersNow.step(-1)
          else handlersNow.seekBy(-seekStep)
          break
        case 'ArrowRight':
          event.preventDefault()
          if (event.ctrlKey) handlersNow.step(1)
          else handlersNow.seekBy(seekStep)
          break
        case 'ArrowUp':
          event.preventDefault()
          handlersNow.changeVolumeBy(VOLUME_STEP)
          break
        case 'ArrowDown':
          event.preventDefault()
          handlersNow.changeVolumeBy(-VOLUME_STEP)
          break
        case 'm':
        case 'M':
          if (!event.ctrlKey && !event.repeat) handlersNow.toggleMute()
          break
        case '/':
          event.preventDefault()
          handlersNow.focusSearch()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
