import { useEffect, useRef, useState } from 'react'

interface ImportMenuProps {
  onImportFolder: () => void
  onImportFiles: () => void
  variant?: 'solid' | 'ghost'
}

// 浏览器没法用一个对话框同时选"文件夹"和"几个文件"，所以入口收成一个按钮，
// 点开再选范围——比并排摆两个按钮少一次犹豫。
export default function ImportMenu({ onImportFolder, onImportFiles, variant = 'solid' }: ImportMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // 先收起菜单再打开文件对话框：不然系统对话框回来时菜单还挂着。
  const pick = (handler: () => void) => {
    setOpen(false)
    handler()
  }

  return (
    <div className="import-menu" ref={wrapRef}>
      <button
        className={variant === 'ghost' ? 'btn-import ghost' : 'btn-import'}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        导入音乐
        <span className="caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="import-popover" role="menu" aria-label="导入方式">
          <button className="import-item" type="button" role="menuitem" onClick={() => pick(onImportFolder)}>
            <strong>选择文件夹</strong>
            <span>导入整个目录</span>
          </button>
          <button className="import-item" type="button" role="menuitem" onClick={() => pick(onImportFiles)}>
            <strong>选择文件</strong>
            <span>挑几首歌，可多选</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
