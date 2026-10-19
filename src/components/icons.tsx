/** 图标全部内联，避免为 8 个 svg 引入图标库。 */
type IconProps = { size?: number }

export function PlayIcon({ size = 20 }: IconProps) {
  return (
    <svg className="i-play" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
    </svg>
  )
}

export function PauseIcon({ size = 20 }: IconProps) {
  return (
    <svg className="i-pause" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="5" width="3.4" height="14" rx="1.2" fill="currentColor" />
      <rect x="13.6" y="5" width="3.4" height="14" rx="1.2" fill="currentColor" />
    </svg>
  )
}

export function PreviousIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 5 9 12l10 7V5Z" fill="currentColor" stroke="none" />
      <path d="M6 5v14" />
    </svg>
  )
}

export function NextIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 5l10 7-10 7V5Z" fill="currentColor" stroke="none" />
      <path d="M18 5v14" />
    </svg>
  )
}

export function SearchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  )
}

export function VolumeIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" stroke="none" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
}

/** 正在播放的三根跳动柱子；暂停时由 `body.is-paused` 冻结动画。 */
export function EqualizerIcon() {
  return (
    <span className="eq" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}
