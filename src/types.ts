/** 一首曲目在界面上的最小数据。M1 起由扫描器填充真实标签。 */
export interface Track {
  /** 稳定键：语料库内的相对路径 + 大小 + 修改时间。 */
  id: string
  /** 相对路径（多选文件时就是文件名），用于显示和缓存键。 */
  path: string
  title: string
  artist: string
  album: string
  /** 秒；0 表示还没读到。 */
  duration: number
  /** 可直接赋给 <audio src> 的地址（当前是 blob: URL）。 */
  src: string
  /** 标签解析状态：pending 表示还在占位行阶段。 */
  tagState: 'pending' | 'ready' | 'failed'
}
