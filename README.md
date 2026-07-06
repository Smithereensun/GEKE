# 极刻 GEKE

极刻 GEKE 现在是一个单用途的 macOS 应用启动器。打开 App 后直接出现居中的搜索面板，输入应用名称、英文片段、拼音或首字母即可筛选并启动本机应用。

## 功能

- 启动即显示搜索框，并自动聚焦。
- 扫描以下应用目录：
  - `/Applications`
  - `~/Applications`
  - `/System/Applications`
  - `/System/Applications/Utilities`
- 识别 `.app` bundle，并优先读取 `Info.plist` 中的 `CFBundleDisplayName` / `CFBundleName`。
- 支持大小写无关、名称包含、路径包含、连续字符子序列、拼音全拼与首字母匹配。
- `Enter` 或点击结果启动应用，主进程通过 Electron `shell.openPath()` 真实打开 `.app`。
- 键盘操作：
  - `↑ / ↓` 切换结果
  - `Enter` 启动
  - `Esc` 清空或隐藏窗口
  - `Cmd + R` 重新扫描

## 安全

- `renderer` 未开启 `nodeIntegration`
- 通过 `preload + contextBridge` 仅暴露 `search / launch / rescan / hide` API
- 应用扫描和启动全部在主进程完成

## 开发

```bash
npm install
npm run app:dev
```

如果只看前端界面，也可以运行：

```bash
npm run dev
```

## 构建

```bash
npm run build
npm run app:build
```

默认构建产物输出到：

- `release/mac-arm64/极刻 GEKE.app`
- `release/GEKE-0.3.0-arm64.zip`

## 目录

- `electron/main.js`: 主进程窗口、应用扫描、模糊检索、应用启动
- `electron/preload.js`: 安全桥接 API
- `src/launcher.js`: 启动器渲染和键盘交互
- `styles.css`: 启动器界面样式
