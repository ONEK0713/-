import { readTags } from './metadata'
import type { TrackTags } from './metadata'

interface TagsRequest {
  id: number
  file: File
}

export interface TagsResponse {
  id: number
  tags?: TrackTags
  error?: string
}

// tsconfig 的 lib 只有 DOM，没有 WebWorker；这里只声明用到的两个成员，
// 免得为一个 Worker 引入两套互相冲突的全局定义。
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<TagsRequest>) => void) | null
  postMessage: (message: TagsResponse) => void
}

scope.onmessage = (event) => {
  const { id, file } = event.data
  readTags(file).then(
    (tags) => scope.postMessage({ id, tags }),
    (error: unknown) =>
      scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) }),
  )
}

export {}
