import { SearchIcon } from './icons'

interface TopBarProps {
  query: string
  trackCount: number
  onQueryChange: (value: string) => void
  onImportFiles: () => void
  onImportFolder: () => void
}

export default function TopBar({
  query,
  trackCount,
  onQueryChange,
  onImportFiles,
  onImportFolder,
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
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索歌曲、歌手或专辑"
          aria-label="搜索歌曲"
          autoComplete="off"
        />
      </div>

      <div className="topbar-actions">
        <button className="btn-import" type="button" onClick={onImportFolder}>
          选择文件夹
        </button>
        <button className="btn-import ghost" type="button" onClick={onImportFiles}>
          选择文件
        </button>
      </div>
    </header>
  )
}
