import type { SortKey, SortState } from '../lib/sort'

type SortableKey = Exclude<SortKey, 'default'>

interface ListHeadProps {
  sort: SortState
  onSort: (key: SortableKey) => void
}

const COLUMNS: { key: SortableKey; label: string; className: string }[] = [
  { key: 'title', label: '标题', className: 'col-title' },
  { key: 'artist', label: '歌手', className: 'col-artist' },
  { key: 'album', label: '专辑', className: 'col-album' },
  { key: 'duration', label: '时长', className: 'col-duration' },
]

function ariaSort(sort: SortState, key: SortableKey): 'ascending' | 'descending' | 'none' {
  if (sort.key !== key) return 'none'
  return sort.direction === 'asc' ? 'ascending' : 'descending'
}

/** 表头：四列都能点，点一下升序、再点降序、第三下回到导入顺序。 */
export default function ListHead({ sort, onSort }: ListHeadProps) {
  return (
    <div className="list-head" role="row">
      <span className="col-idx" role="columnheader">
        #
      </span>

      {COLUMNS.map(({ key, label, className }) => {
        const state = ariaSort(sort, key)
        return (
          <div key={key} className={className} role="columnheader" aria-sort={state}>
            <button
              className="col-sort"
              type="button"
              aria-label={`按${label}排序`}
              data-active={state === 'none' ? undefined : state}
              onClick={() => onSort(key)}
            >
              <span>{label}</span>
              <span className="sort-arrow" aria-hidden="true">
                {state === 'ascending' ? '↑' : state === 'descending' ? '↓' : '↕'}
              </span>
            </button>
          </div>
        )
      })}

      <span className="col-actions" role="columnheader" aria-label="操作" />
    </div>
  )
}
