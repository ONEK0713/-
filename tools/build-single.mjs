/**
 * 单文件构建：把 JS/CSS 全部内联进一个 index.html，产物可以直接双击打开，
 * 也可以当作一个文件在微信/邮件里发出去。
 *
 * 用法：node tools/build-single.mjs
 * 产物：dist-single/index.html
 */
import { readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = path.dirname(fileURLToPath(new URL('.', import.meta.url)))
const outDir = path.join(root, 'dist-single')

await build({
  root,
  configFile: path.join(root, 'vite.config.ts'),
  base: './',
  define: { __SINGLE_FILE__: 'true' },
  build: {
    outDir,
    emptyOutDir: true,
    // 产物只有一个 html，不许再切出 css/js 附属文件。
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    // 动态 import（music-metadata 的降级路径）也并进主文件，不能留独立 chunk。
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})

const htmlPath = path.join(outDir, 'index.html')
let html = await readFile(htmlPath, 'utf8')

/** 把 HTML 里的外链标签换成内联内容。 */
async function inlineTag(pattern, buildTag) {
  const matches = [...html.matchAll(pattern)]
  for (const match of matches) {
    const [, tag, ref] = match
    const file = path.join(outDir, ref.replace(/^\.?\//, ''))
    const content = await readFile(file, 'utf8')
    // 必须传函数：字符串替换会把压缩代码里的 $& / $` 当成替换模式，直接写坏 bundle。
    html = html.replace(tag, () => buildTag(content))
  }
  return matches.length
}

const jsCount = await inlineTag(
  /(<script[^>]*\ssrc="([^"]+)"[^>]*><\/script>)/g,
  // 内联脚本里的 </script 会提前结束标签，转义成 <\/script 后语义不变。
  (code) => `<script type="module">${code.replace(/<\/script/gi, '<\\/script')}</script>`,
)

const cssCount = await inlineTag(
  /(<link[^>]*rel="stylesheet"[^>]*\shref="([^"]+)"[^>]*>)/g,
  (code) => `<style>${code.replace(/<\/style/gi, '<\\/style')}</style>`,
)

await writeFile(htmlPath, html, 'utf8')
// 内联完成后资产目录就是残留，删掉避免被误当成发布内容。
const assetsDir = path.join(outDir, 'assets')
if (existsSync(assetsDir)) await rm(assetsDir, { recursive: true, force: true })

const kb = (await readFile(htmlPath)).byteLength / 1024
console.log(`内联 ${jsCount} 个脚本、${cssCount} 个样式`)
console.log(`dist-single/index.html  ${kb.toFixed(1)} kB`)
