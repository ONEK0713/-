import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// 没开 vitest globals，RTL 的自动 cleanup 不会注册，需要手动挂上，
// 否则同一个文件里的多次 render 会互相污染 DOM。
afterEach(() => {
  cleanup()
})
