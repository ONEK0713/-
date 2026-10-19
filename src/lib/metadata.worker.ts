import { readAudio } from './metadata'
import type { ParsedAudio } from './metadata'

interface AudioRequest {
  id: number
  file: File
}

export interface AudioResponse {
  id: number
  parsed?: ParsedAudio
  error?: string
}

// tsconfig 的 lib 只有 DOM，没有 WebWorker；这里只声明用到的两个成员，
// 免得为一个 Worker 引入两套互相冲突的全局定义。
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<AudioRequest>) => void) | null
  postMessage: (message: AudioResponse) => void
}

scope.onmessage = (event) => {
  const { id, file } = event.data
  readAudio(file).then(
    (parsed) => scope.postMessage({ id, parsed }),
    (error: unknown) =>
      scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) }),
  )
}

export {}
