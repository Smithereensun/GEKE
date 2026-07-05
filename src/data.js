export const product = {
  nameCn: "极刻",
  nameEn: "GEKE",
  tagline: "把 Mac 上最常用的那几件事，压缩到一瞬间。",
  subtitle:
    "一个面向中文效率流的 Mac 工作台测试版。启动器、截图标注、剪贴板、翻译与快捷操作，先在网页里做出完整产品表达。",
};

export const metrics = [
  { value: "38", label: "可自定义快捷入口" },
  { value: "1s", label: "回到上次选区与标注" },
  { value: "5", label: "核心高频工作流" },
  { value: "Local", label: "以本地优先为设计原则" },
];

export const features = [
  {
    title: "启动更短",
    body:
      "用键位直接打开应用、文件夹、网页与 GEKE 内置动作。减少鼠标绕路，适合中文用户按习惯自定义。",
    chips: ["应用启动", "网页直达", "文件夹入口", "动作绑定"],
  },
  {
    title: "截图更顺",
    body:
      "截图面板围绕标注、步骤序号、主题色、尺寸与回退设计，优先处理真实分享与协作场景，而不是只做一个取图动作。",
    chips: ["标注工具栏", "最近选区", "主题色", "长截图预留"],
  },
  {
    title: "切换更少",
    body:
      "剪贴板、OCR、翻译、钉图与快速改图在同一个工作台语境里完成，减少在多个工具之间反复跳转。",
    chips: ["剪贴板历史", "OCR", "双向翻译", "钉图"],
  },
  {
    title: "中文工作流优先",
    body:
      "参考桌面素材里对启动器、截图、翻译的高频反馈，文案、操作路径和功能排列都按中文用户语境重排。",
    chips: ["中文文案", "快捷键提示", "场景导向"],
  },
  {
    title: "原型可直接评审",
    body:
      "这次测试版额外提供了可打开的 SVG 原型图，方便快速评审主界面布局、截图面板和信息层级。",
    chips: ["SVG 原型", "网页预览", "可下载"],
  },
  {
    title: "后续可接原生 App",
    body:
      "页面结构已经拆成主站、更新日志和原型资源页，后续接 GitHub Releases、下载页和原生应用截图不会推倒重来。",
    chips: ["多页结构", "版本日志", "发布占位"],
  },
];

export const changelog = [
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
  {
    version: "0.1.1",
    date: "2026-07-06",
    build: "test.002",
    label: "Flow Draft",
    summary: "补齐更接近产品演示的工作台预览块。",
    bullets: [
      "在首页加入类似 Mac 窗口的工作台演示区域。",
      "展示命令面板、截图控制卡和最近动作的信息层次。",
      "优化移动端布局与按钮分布，确保手机可浏览。",
    ],
  },
  {
    version: "0.1.2",
    date: "2026-07-06",
    build: "test.003",
    label: "Reference Pass",
    summary: "按参考站的单页节奏重组内容，形成可发布测试版本。",
    bullets: [
      "加入阶段说明、测试版定位与原型图入口。",
      "独立整理更新日志时间线，便于后续持续追加版本记录。",
      "准备 GitHub 发布所需的静态站项目结构与构建脚本。",
    ],
  },
];

export const proofPoints = [
  "参考了 `https://fg.vkr.me/mac` 的单页产品表达与 `https://fg.vkr.me/mac/changelog/` 的独立日志思路。",
  "参考了 `/Users/chen/Desktop/1` 中关于启动器、截图标注、OCR 翻译、钉图与最近选区的中文功能描述。",
  "当前目录原本为空且不是 git 仓库，本次从零初始化并构建可运行测试版。",
];
