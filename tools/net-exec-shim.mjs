/**
 * 受限沙箱下的 Vite 启动补丁。
 *
 * Vite 在 Windows 上首次解析真实路径时会执行 `net use` 探测网络驱动器映射
 * （vite/dist/node/chunks/node.js → optimizeSafeRealPathSync）。它用的
 * child_process.exec 需要管道 stdio，而本机沙箱禁止子进程打开命名管道，
 * 于是 spawn 直接抛 EPERM，把 vite / vitest 的启动整个打断。
 *
 * 这里只把 `net use` 这一个调用变成"执行失败"，Vite 本来就有 error 分支：
 * 探测失败时退回默认的 windowsSafeRealPathSync，行为与普通本地磁盘一致。
 *
 * 用法：NODE_OPTIONS="--import=./tools/net-exec-shim.mjs"
 */
import cp from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'

const originalExec = cp.exec

cp.exec = function exec(command, options, callback) {
  if (String(command).trim() === 'net use') {
    const done = typeof options === 'function' ? options : callback
    if (typeof done === 'function') {
      queueMicrotask(() => done(new Error('net use 已被沙箱补丁禁用')))
    }
    return { on() {}, once() {}, kill() {} }
  }
  return originalExec.apply(this, arguments)
}

syncBuiltinESMExports()
