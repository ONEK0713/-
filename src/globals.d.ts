/**
 * 构建期的全局常量，由 vite 的 `define` 注入（见 vite.config.ts 与 tools/build-single.mjs）。
 */

/** true 表示当前是单文件构建：产物只有一个 html，不能依赖独立 worker 文件。 */
declare const __SINGLE_FILE__: boolean
