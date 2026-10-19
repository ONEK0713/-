@echo off
rem 双击启动开发服务器（http://localhost:8787）。
rem 本机 PATH 里没有 node，所以这里显式补上运行时目录。
rem net-exec-shim 让 Vite 跳过沙箱里会被拒的 net use 探测。
setlocal
cd /d "%~dp0"
set "PATH=Y:\插件\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin;%PATH%"
set "NODE_OPTIONS=--import=./tools/net-exec-shim.mjs"
"Y:\插件\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" "node_modules\vite\bin\vite.js" --port 8787 --strictPort
endlocal
