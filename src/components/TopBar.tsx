import type { RefObject } from 'react'
import ImportMenu from './ImportMenu'
import { SearchIcon } from './icons'

interface TopBarProps {
  query: string
  trackCount: number
  confirmingClear: boolean
  searchRef?: RefObject<HTMLInputElement | null>
  onQueryChange: (value: string) => void
  onImportFiles: () => void
  onImportFolder: () => void
  onRequestClear: () => void
}

export default function TopBar({
  query,
  trackCount,
  confirmingClear,
  searchRef,
  onQueryChange,
  onImportFiles,
  onImportFolder,
  onRequestClear,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">♪</span>
        <span className="brand-name">本地音乐</span>
        <span className="badge">{trackCount > 0 ? `${trackCount} 首` : 'MVP'}</span>
      </div>

      <div className="search">
        <SearchIcon />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索歌曲、歌手或专辑"
          aria-label="搜索歌曲"
          autoComplete="off"
        />
      </div>

      <div className="topbar-actions">
        {/* 清空走两步：第一下只是变成"确定清空？"，避免手滑把曲库清掉。 */}
        {trackCount > 0 ? (
          <button
            className={confirmingClear ? 'btn-import ghost confirming' : 'btn-import ghost'}
            type="button"
            onClick={onRequestClear}
          >
            {confirmingClear ? '确定清空？' : '清空曲库'}
          </button>
        ) : null}
        <ImportMenu onImportFolder={onImportFolder} onImportFiles={onImportFiles} />
      </div>
    </header>
  )
}
