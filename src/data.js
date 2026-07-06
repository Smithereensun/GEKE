export const product = {
  nameCn: "极刻",
  nameEn: "GEKE",
  tagline: "把常用动作压缩进一个真正能工作的 macOS 面板。",
  subtitle:
    "GEKE 现在以工具工作台作为主入口，围绕快速捕捉、Markdown 草稿、剪贴板历史、搜索筛选、菜单栏和快捷面板组织主流程。",
  repoUrl: "https://github.com/Smithereensun/GEKE",
};

export const fuguangSummary = [
  {
    title: "菜单栏常驻应用",
    body:
      "本地 `/Applications/浮光.app` 的 `Info.plist` 标明 `LSUIElement = 1`，说明它以常驻菜单栏工具而不是传统 Dock 应用为主。",
  },
  {
    title: "主面板 + 快速面板",
    body:
      "二进制符号里明确出现 `MainPanel`、`FloatingPanel`、`PanelShortcut`、`momentaryPanelEnabled` 等结构，核心交互是随时唤起的主面板和浮动面板。",
  },
  {
    title: "剪贴板与截图工作流",
    body:
      "可见符号包含 `ClipboardHistoryService`、`ScreenshotPinnedImage`、`ScreenshotAnnotationHistory`、`screenshotOCR`、`screenshotTranslate`，说明它把剪贴板和截图后续处理放在同一工作流内。",
  },
  {
    title: "Markdown 草稿能力",
    body:
      "`Info.plist` 注册了 Markdown 文档类型，二进制中有完整的 `MarkdownPanel`、最近文件、预览、导出等结构，说明 Markdown 是明确的核心模块。",
  },
  {
    title: "更多原生能力",
    body:
      "包内还出现 `VideoQuickCut`、`WallpaperBlur`、`TranslationPanel`、`CalendarPanel` 等模块。GEKE 本轮先对齐主面板、草稿和历史流，不伪造尚未完成的原生权限能力。",
  },
];

export const implementedFeatures = [
  "主入口改成 GEKE 工作台，不再默认打开宣传站。",
  "新增快速捕捉表单，支持普通记录、草稿、Markdown、链接与剪贴板快照。",
  "所有历史记录通过 Electron 主进程安全写入 `app.getPath(\"userData\")/workspace-data.json`。",
  "主界面支持搜索、按类型筛选、收藏、置顶、复制和删除。",
  "新增始终置顶的快速面板，可从菜单栏或全局快捷键 `CommandOrControl+Shift+Space` 唤起。",
  "新增托盘/菜单栏入口，辅助进入工作台、快速面板、更新日志、原型图和关于页。",
  "保留 changelog / prototype / about 作为辅助页面，不再承担产品主入口角色。",
];

export const changelog = [
  {
    version: "0.3.0",
    date: "2026-07-06",
    build: "mvp.001",
    label: "Functional MVP",
    summary: "把 GEKE 从展示站改成了真正可运行的 macOS 工具工作台。",
    bullets: [
      "新增 preload + contextBridge + IPC + JSON store，所有记录安全落在 userData 下。",
      "主入口改成工作台，支持快速捕捉、Markdown 草稿、剪贴板历史、搜索筛选和内容管理。",
      "新增菜单栏托盘、全局快捷键和始终置顶快速面板，辅助页只保留 changelog / prototype / about。",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-07-06",
    build: "test.004",
    label: "Electron Preview",
    summary: "把现有 GEKE Web UI 包装成可在 macOS 本地启动和打包的 Electron App 测试版。",
    bullets: [
      "新增 Electron 主进程与本地静态资源服务，可直接打开首页、更新日志和原型页。",
      "补齐 Vite 多页构建配置，确保 changelog 与 prototype 一并进入生产包。",
      "增加 app:dev、electron:dev、app:build 与 dist:mac 脚本，支持本地启动和 macOS 打包。",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-07-06",
    build: "test.001",
    label: "Initial Preview",
    summary: "完成 GEKE for Mac 测试版官网首发结构。",
    bullets: [
      "上线首页、更新日志页、SVG 原型图页。",
      "建立极刻 / GEKE 双语品牌表达与测试版下载占位。",
      "提炼启动器、截图标注、剪贴板、OCR 翻译等关键卖点。",
    ],
  },
];
