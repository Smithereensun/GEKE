# 极刻 / GEKE

GEKE 现在不是宣传网站外壳，而是一个可本地运行的 macOS 工具工作台。主入口已经切到工作台，围绕快速捕捉、Markdown 草稿、剪贴板历史、搜索筛选、菜单栏入口和快捷面板组织核心流程；`changelog / prototype / about` 只保留为辅助页面。

## 浮光公开功能摘要

- 本机 `/Applications/浮光.app` 的 `Info.plist` 显示 `LSUIElement = 1`，说明它是菜单栏常驻型工具。
- 可见符号里出现 `MainPanel`、`FloatingPanel`、`PanelShortcut`，说明主面板和快速面板是核心入口。
- 可见模块包含 `ClipboardHistoryService`、`ScreenshotPinnedImage`、`screenshotOCR`、`screenshotTranslate`，说明剪贴板和截图后处理是一条主工作流。
- 应用注册了 Markdown 文档类型，且存在完整 `MarkdownPanel` 相关结构，Markdown 草稿是明确核心能力。
- 同包里还能看到 `VideoQuickCut`、`WallpaperBlur`、`TranslationPanel` 等更深的原生模块；GEKE 本轮没有伪造这些未完成能力。

## 当前已实现

- 工作台主入口：快速捕捉、新建记录、Markdown 草稿、本地历史管理。
- 本地持久化：所有记录与设置通过 `preload + contextBridge + IPC` 写入 `userData/workspace-data.json`。
- 搜索与筛选：按关键词和类型检索本地历史。
- 快速面板：全局快捷键 `CommandOrControl+Shift+Space` 唤起，窗口始终置顶。
- 菜单栏 / 托盘入口：打开工作台、快速面板、更新日志、原型图和关于页。
- 内容动作：复制、收藏、置顶、删除、手动抓取当前剪贴板。
- 辅助页面：`/changelog/`、`/prototype/`、`/about/`。

## 运行

首次拉起依赖时执行：

```bash
npm install
```

浏览器预览：

```bash
npm run dev
```

Electron 开发版：

```bash
npm run app:dev
```

等价别名：

```bash
npm run electron:dev
```

## 构建

```bash
npm run build
npm run app:build
```

默认产物输出到 `release/`：

- `release/mac-arm64/极刻 GEKE.app`
- `release/GEKE-0.3.0-arm64.zip`
- `release/GEKE-0.3.0-arm64.zip.blockmap`

## 数据存储

Electron 运行时数据默认写入：

```text
~/Library/Application Support/极刻 GEKE/workspace-data.json
```

浏览器预览模式只用于开发调试，会退化到 `localStorage`，不代表正式 App 的持久化方式。

## 目录说明

- `electron/`: 主进程、预加载桥、本地 JSON 存储、本地静态资源服务。
- `src/home.js`: 工作台与快速面板渲染逻辑。
- `src/about.js`: 浮光摘要、实现范围与安全说明。
- `src/changelog.js`: 版本日志页面。
- `prototype/`: 原型页入口。
- `public/prototypes/`: 原型 SVG 资源。
