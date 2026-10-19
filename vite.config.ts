import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// origin 固定为 http://localhost:8787：IndexedDB（目录句柄、曲库缓存）按 origin 隔离，
// 换端口等于用户丢曲库，所以 strictPort 让端口被占用时直接失败，而不是悄悄换端口。
export default defineConfig({
  plugins: [react()],
  // 相对路径：构建产物可以放在任何子目录（GitHub Pages 的 /repo/、网盘的子目录），
  // 不依赖站点根路径。dev 与 preview 服务器不受影响。
  base: './',
  // 单文件构建（tools/build-single.mjs）会把它覆盖成 true：那种产物只有一个 html，
  // 不能有独立的 worker 文件，解析退到主线程。
  define: { __SINGLE_FILE__: 'false' },
  server: { port: 8787, strictPort: true },
  preview: { port: 8787, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
    // forks 池会 fork 子进程，在受限沙箱里 spawn 被拒（EPERM）；threads 用 worker_threads，无需子进程。
    // 再关掉文件级并行，只留一个 worker，避免同时起多个线程抢资源。
    pool: 'threads',
    fileParallelism: false,
  },
})
