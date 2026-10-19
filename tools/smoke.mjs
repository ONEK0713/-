// 冒烟检查：确认 dev server 起来了、首页与入口脚本都能拿到。
// 注意：vite 默认绑 localhost，本机解析到 ::1 而不是 127.0.0.1，所以用 localhost。
const base = 'http://localhost:8787'
const page = await fetch(base + '/')
const html = await page.text()
console.log('page status:', page.status)
console.log('has #root:', html.includes('id="root"'))
console.log('has main.tsx:', html.includes('/src/main.tsx'))

const main = await fetch(base + '/src/main.tsx')
const mainText = await main.text()
console.log('main status:', main.status, 'bytes:', mainText.length)
