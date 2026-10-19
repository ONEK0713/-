/** 一首曲目在界面上的最小数据。M1 起由扫描器填充真实标签。 */
export interface Track {
  /** 稳定键：M0 用文件名+大小+修改时间，M1 换成语料库内的相对路径。 */
  id: string
  title: string
  artist: string
  album: string
  /** 秒；0 表示还没读到（M0 在首次播放时从 audio 元数据回填）。 */
  duration: number
  /** 可直接赋给 <audio src> 的地址（当前是 blob: URL）。 */
  src: string
}
