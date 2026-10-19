# 本地音乐播放器

纯本地、免登录、离线可用的音乐播放器。选一个文件夹，点一下就听；不上传、不联网、不碰你的源文件。

- 产品需求与验收：[docs/PRD.md](docs/PRD.md)
- 技术栈：Vite 8 + React 19 + TypeScript 7（strict）
- 状态：MVP 已完成，未做项在 PRD §4.2 列明

## 运行

```bash
pnpm install
pnpm dev        # http://localhost:8787
```

Windows 上也可以直接双击 `dev.cmd`（本机 PATH 里没有 node，脚本里写死了运行时路径）。

> 端口固定 8787：IndexedDB 与文件句柄按 origin 隔离，换端口等于换一个空曲库。

## 常用命令

```bash
pnpm dev        # 开发服务器
pnpm build      # tsc --noEmit + vite build
pnpm typecheck  # 只做类型检查
pnpm test       # vitest run
```

`NODE_OPTIONS=--import=./tools/net-exec-shim.mjs` 已经写进脚本：Vite 在本机会用管道 stdio 跑 `net use`
探测网络驱动器，当前环境不允许，shim 让这条命令直接失败、Vite 退回默认路径解析。

## 部署 / 分享

产物是纯静态文件（`dist/`，约 0.8 MB），没有后端。构建用了相对路径（`base: './'`），所以可以放在站点根路径，也可以放在任意子目录。

**GitHub Pages（推荐，仓库里已带 [workflow](.github/workflows/pages.yml)）**

1. 在 GitHub 上新建一个空仓库（不要勾 "Add a README"）
2. 本地关联并推送：

   ```bash
   git remote add origin https://github.com/<用户名>/<仓库名>.git
   git push -u origin master
   ```

3. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**
4. 之后每次 push 到 `master`，Actions 会跑测试、构建并发布；页面地址是
   `https://<用户名>.github.io/<仓库名>/`

**其它静态托管**：`pnpm build` 之后把 `dist` 整个目录拖到 Netlify Drop / Cloudflare Pages 即可，无需配置。

> 必须是 HTTPS 或 localhost：`showDirectoryPicker()` 要求安全上下文。用局域网 IP 直接访问会退化成
> `<input webkitdirectory>`，能导入能播放，但刷新后恢复不了曲库。

## 能做什么

- 导入：一个「导入音乐」按钮（选择文件夹 / 选择文件），也可以把文件或文件夹拖进窗口
- 解析：标题、歌手、专辑、时长、封面；FLAC / MP3 / M4A / AAC / WAV / OGG
- 列表：搜索（标题 / 歌手 / 专辑）、点表头排序、移除单曲（5 秒内可撤销）、清空曲库
- 播放：播放暂停、上下曲、拖进度、调音量、静音
- 播放模式：顺序 / 列表循环 / 单曲循环 / 随机，按钮循环切换，选择记在本机
- 快捷键：空格播放暂停、←/→ 快退快进、Ctrl+←/→ 切歌、↑/↓ 音量、M 静音、`/` 搜索
- 大曲库：超过 150 首自动虚拟滚动，千首也不卡
- 刷新保留曲库；关掉标签页重新打开是空的

## 不能做什么（有意为之）

- 不支持 ape / wma / dsd——浏览器解不了
- 没有歌单、歌词、播放历史、系统媒体键（见 PRD §4.2）
- 不跨会话记进度：重开标签页就是新的会话
- 没有队列抽屉：上/下一首始终按导入顺序

## 目录

```
src/
  App.tsx        组合 hooks + 布局
  hooks/         useLibrary（曲库）/ usePlayback（播放）/ useImports（导入）/ useNotice / useShortcuts / useVirtualRows / useCoverUrl
  components/    TopBar / TrackList / ListHead / PlayerBar / ImportMenu / icons
  lib/           纯逻辑：标签解析、缓存、文件系统适配、播放模式、排序、虚拟滚动、格式化、搜索
docs/PRD.md      产品文档
tools/           net-exec-shim（dev 补丁）、smoke（冒烟检查）
```

## 测试

131 个用例，覆盖导入去重、标签缓存与编码兜底、移除撤销、刷新恢复、封面回退、播放模式与快捷键、排序、虚拟滚动，以及时间格式 / 搜索 / 并发 / 句柄转换等纯函数。
