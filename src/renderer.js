const launcher = window.geke ?? createTauriBridge() ?? createFallbackBridge();
const appElement = document.querySelector("#app");

const DEFAULT_LANGUAGE = "zh-CN";
const DEFAULT_TOGGLE_SHORTCUT = "Alt+Space";
const DEFAULT_SINGLE_WAKE_SHORTCUT = "F18";
const DEFAULT_MODIFIER_WAKE_KEY = "Alt";
const DEFAULT_SEARCH_ALL_SHORTCUT = "F1";
const DEFAULT_SEARCH_APPS_SHORTCUT = "F2";
const DEFAULT_SEARCH_FILES_SHORTCUT = "F3";
const DEFAULT_RESCAN_SHORTCUT = "CmdOrCtrl+R";
const DEFAULT_SEARCH_MODE = "all";
const DEFAULT_PREFER_GEKE_SHORTCUTS = true;
const DEFAULT_ANIMATION_MODE = "smooth";
const DEFAULT_PIN_HISTORY_LIMIT = 50;
const PATH_PERMISSION_COLLAPSED_LIMIT = 3;
const SETTINGS_MESSAGE_DISMISS_MS = 2200;
const SETTINGS_ERROR_DISMISS_MS = 4200;
const DEFAULT_APP_SEARCH_PATHS = ["/Applications", "~/Applications", "/System/Applications", "/System/Applications/Utilities"];
const DEFAULT_FILE_SEARCH_PATHS = ["~/Desktop", "~/Documents", "~/Downloads", "~/Pictures", "~/Movies", "~/Music"];
const LANGUAGE_OPTIONS = [
  { value: "zh-CN", label: "简体中文" },
  { value: "en", label: "English" },
];
const APPEARANCE_OPTIONS = [
  { value: "system", labelKey: "appearanceSystem" },
  { value: "light", labelKey: "appearanceLight" },
  { value: "dark", labelKey: "appearanceDark" },
];
const ANIMATION_OPTIONS = [
  { value: "smooth", labelKey: "animationSmooth" },
  { value: "snappy", labelKey: "animationSnappy" },
  { value: "spring", labelKey: "animationSpring" },
  { value: "none", labelKey: "animationNone" },
];
const DEFAULT_SCREENSHOT_SHORTCUT = "CmdOrCtrl+Shift+S";
const DEFAULT_PIN_RESTORE_SHORTCUT = "CmdOrCtrl+Shift+P";
const SCREENSHOT_TOOLS = [
  { id: "move", icon: "↕", labelKey: "screenshotToolMove", shortcut: "V" },
  { id: "note", icon: "✎", labelKey: "screenshotToolNote", shortcut: "1" },
  { id: "step", icon: "①", labelKey: "screenshotToolStep", shortcut: "2" },
  { id: "rectangle", icon: "□", labelKey: "screenshotToolRectangle", shortcut: "3" },
  { id: "circle", icon: "○", labelKey: "screenshotToolCircle", shortcut: "4" },
  { id: "arrow", icon: "↗", labelKey: "screenshotToolArrow", shortcut: "5" },
  { id: "text", icon: "T", labelKey: "screenshotToolText", shortcut: "6" },
  { id: "highlight", icon: "▰", labelKey: "screenshotToolHighlight", shortcut: "7" },
  { id: "mosaic", icon: "▦", labelKey: "screenshotToolMosaic", shortcut: "8" },
  { id: "brush", icon: "✎", labelKey: "screenshotToolBrush", shortcut: "9" },
  { id: "watermark", icon: "≈", labelKey: "screenshotToolWatermark", shortcut: "0" },
];
const SCREENSHOT_ACTIONS = [
  ...SCREENSHOT_TOOLS,
  { id: "ocr", icon: "⌘", labelKey: "screenshotActionOcr", shortcut: "R" },
  { id: "translate", icon: "⇄", labelKey: "screenshotActionTranslate", shortcut: "T" },
  { id: "qr", icon: "▦", labelKey: "screenshotActionQr", shortcut: "Q" },
  { id: "spotlightTranslate", icon: "↗", labelKey: "screenshotActionSpotlightTranslate", shortcut: "F" },
  { id: "record", icon: "◉", labelKey: "screenshotActionRecord", shortcut: "S" },
  { id: "delay", icon: "◷", labelKey: "screenshotActionDelay", shortcut: "D" },
  { id: "pin", icon: "⌖", labelKey: "screenshotActionPin", shortcut: "P" },
  { id: "copy", icon: "✓", labelKey: "screenshotActionCopy", shortcut: "Return" },
  { id: "download", icon: "⇩", labelKey: "screenshotActionDownload", shortcut: "CmdOrCtrl+S" },
  { id: "cancel", icon: "×", labelKey: "screenshotActionCancel", shortcut: "Escape" },
];
const DEFAULT_SCREENSHOT_PLUGIN = {
  installed: false,
  enabled: true,
  shortcut: DEFAULT_SCREENSHOT_SHORTCUT,
  pinRestoreShortcut: DEFAULT_PIN_RESTORE_SHORTCUT,
  defaultTool: "",
  toolShortcuts: Object.fromEntries(SCREENSHOT_ACTIONS.map((item) => [item.id, { shortcut: item.shortcut, enabled: true }])),
  fileNameFormat: "极刻截图_yyyy-MM-dd_HH-mm-ss.png",
  watermarkText: "极刻 GEKE",
  saveLocation: "~/Desktop",
  saveBehavior: "ask",
  autoOpenFolder: true,
  autoCopyPath: false,
  completionPreview: true,
  autoPasteAfterCapture: false,
  doubleClickFinish: true,
  confirmBeforeClose: false,
  autoFocusRecentArea: false,
  roundedCorners: true,
  shadow: true,
  pinPosition: "mouse",
  pinHistoryLimit: DEFAULT_PIN_HISTORY_LIMIT,
  guides: false,
};
const SETTINGS_SECTIONS = [
  { id: "basic", labelKey: "basicSettings" },
  { id: "paths", labelKey: "pathSettings" },
  { id: "sound", labelKey: "operationSound" },
  { id: "import-export", labelKey: "importExport" },
  { id: "appearance", labelKey: "appearance" },
  { id: "animation", labelKey: "animation" },
  { id: "tray-icon", labelKey: "menuIcon" },
  { id: "permissions", labelKey: "permissions" },
  { id: "autostart", labelKey: "launchAtLogin" },
  { id: "shortcuts", labelKey: "shortcutGuideTitle" },
  { id: "plugins", labelKey: "morePlugins" },
];
const COPY = {
  "zh-CN": {
    appTagline: "Raycast 风格应用启动器",
    scanningApplications: "正在扫描应用...",
    failedToScan: "扫描应用失败。",
    searchFailed: "搜索失败。",
    searchingAll: "搜索应用和文件",
    searchingApps: "只搜应用",
    searchingFiles: "只搜文件",
    fileSearchMode: "应用 + 文件",
    appSearchMode: "应用",
    filesSearchMode: "文件",
    opening: (name) => `正在打开 ${name}...`,
    failedToOpen: (name) => `打开 ${name} 失败。`,
    rescanStatus: "正在重新扫描应用...",
    applicationScanFailed: "应用扫描失败。",
    launchOnlyDesktop: "只能在桌面应用里启动应用。",
    launching: (name) => `正在启动 ${name}...`,
    failedToLaunch: (name) => `启动 ${name} 失败。`,
    resultCount: (count, query) => `找到 ${count} 个关于“${query}”的结果`,
    noResultsFor: (query) => `没有找到“${query}”`,
    indexedCount: (count) => `已索引 ${count} 个应用`,
    noApplications: "没有在扫描目录中找到应用。",
    ready: "就绪",
    lastScan: "上次扫描",
    settings: "设置",
    basicSettings: "基础设置",
    operationSound: "操作声音",
    importExport: "导入导出",
    menuIcon: "菜单图标",
    permissions: "功能权限",
    launchAtLogin: "开机自动启动",
    enabled: "已开启",
    disabled: "已关闭",
    soundEnabledDescription: "开启后，执行操作时播放提示音。",
    exportSettings: "导出配置",
    importSettings: "导入配置",
    settingsExported: "配置已导出。",
    settingsImported: "配置已导入。",
    exportCancelled: "已取消导出。",
    importCancelled: "已取消导入。",
    showMenuIcon: "显示菜单栏图标",
    showMenuIconDescription: "关闭后可通过快捷键打开极刻，再回到这里重新显示。",
    launchAtLoginDescription: "登录 macOS 后自动启动极刻。",
    fixedShortcuts: "固定快捷键",
    editableShortcuts: "可修改快捷键",
    shortcutConflict: "快捷键冲突，不能保存。",
    shortcutInvalidSingle: "不能只使用单个字母或数字，请加 Option、Command、Control、Shift，F1 这类功能键除外。",
    shortcutNeedComplete: "请继续按下一个按键。",
    wakeShortcuts: "唤醒面板",
    searchShortcuts: "搜索切换",
    actionShortcuts: "应用操作",
    searchAllShortcut: "切换为应用 + 文件搜索",
    searchAppsShortcut: "切换为应用搜索",
    searchFilesShortcut: "切换为文件搜索",
    rescanShortcut: "重新扫描应用",
    wakePanel: "唤起面板",
    resetDefaults: "全部默认",
    panelOpenDisplay: "主面板打开后显示",
    panelOpenDescription: "选择打开主面板时优先进入搜应用，还是先显示快捷入口。",
    appMode: "搜应用",
    wakeEntriesDescription: "这些入口可以同时启用；点击卡片可启用或录入对应唤起方式。",
    multiWake: "多键唤起",
    doubleWake: "双击唤起",
    longPressWake: "长按唤起",
    enableWake: "开启",
    disableWake: "关闭",
    editWake: "修改",
    atLeastOneWake: "至少需要保留一种唤起快捷键。",
    preferGekeShortcuts: "优先选择极刻快捷键",
    preferGekeShortcutsDescription: "开启需要 macOS 权限；授权后和其他 App 冲突时优先唤起极刻。",
    openPermissionSettings: "打开授权设置",
    screenRecordingPermission: "屏幕录制权限",
    screenRecordingPermissionDescription: "截图插件需要此权限；已有权限时不会再次弹出系统授权框。",
    appPathPermission: "应用搜索目录权限",
    appPathPermissionDescription: "手动授权极刻访问应用扫描目录。",
    filePathPermission: "文件搜索目录权限",
    filePathPermissionDescription: "手动授权极刻访问文件搜索目录，避免搜索时临时弹窗。",
    searchPlaceholder: "搜索应用、文件、拼音或首字母",
    searchPlaceholderAll: "搜索应用、文件、拼音或首字母",
    searchPlaceholderApps: "搜索应用、拼音或首字母",
    searchPlaceholderFiles: "搜索文件",
    rescan: "重新扫描",
    move: "移动",
    launch: "启动",
    clearHide: "清空 / 隐藏",
    showHide: "显示 / 隐藏",
    shortcutGuideTitle: "快捷键说明",
    shortcutGuideDescription: "这些快捷键在极刻窗口打开时可用，也可以在菜单栏图标里打开这里查看。",
    scannedFolders: "扫描目录",
    lastScanSetting: "上次扫描",
    closeSettings: "关闭设置",
    shortcut: "快捷键",
    language: "语言",
    appearance: "外观",
    appearanceSystem: "跟随系统",
    appearanceLight: "浅色",
    appearanceDark: "深色",
    animation: "动画效果",
    animationDescription: "控制界面过渡、开关滑动和唤醒启动器时的动画。",
    animationSmooth: "柔和",
    animationSnappy: "快速",
    animationSpring: "弹性",
    animationNone: "关闭",
    animationSaved: "动画效果已切换。",
    change: "更改",
    save: "保存",
    recording: "录入中...",
    cancelRecording: "取消",
    activeShortcut: (shortcut) => `当前：${shortcut}`,
    shortcutInactive: "快捷键未启用。",
    settingsHint: "选择用于显示或隐藏极刻的全局快捷键。",
    pressShortcut: "按下你想使用的快捷键。",
    pressNewShortcut: "按下新的快捷键",
    shortcutModifierRequired: "请至少使用一个修饰键，例如 Option、Command、Control 或 Shift。",
    multiShortcutRequired: "多键唤起需要修饰键加按键，例如 Option + Space。",
    shortcutCaptured: "快捷键已录入，正在保存...",
    shortcutUnchanged: "快捷键没有变化。",
    savingShortcut: "正在保存快捷键...",
    shortcutSaved: "快捷键已保存。",
    shortcutSaveFailed: "快捷键保存失败。",
    screenshotRunning: "正在启动截图...",
    screenshotRunFailed: "截图失败。",
    pluginInstalled: "插件已下载。",
    pluginUninstalled: "插件已卸载。",
    pluginEnabled: "插件已开启。",
    pluginDisabled: "插件已关闭。",
    screenshotSettingSaved: "截图插件设置已保存。",
    morePlugins: "更多插件",
    morePluginsDescription: "插件默认不下载；下载截图插件后才会进入搜索、快捷键说明和快捷键冲突校验。",
    pluginDownloaded: "已下载",
    pluginNotDownloaded: "未下载",
    pluginDownload: "下载",
    pluginUninstall: "卸载",
    pluginEnable: "开启",
    pluginDisable: "关闭",
    pluginSettings: "插件设置",
    pluginShortcuts: "插件快捷键",
    screenshotPlugin: "截图",
    screenshotPluginDescription: "交互式截图插件，支持独立设置、独立快捷键和保存策略。",
    screenshotCaptureCommand: "区域截图",
    screenshotRestorePinnedImage: "恢复最近钉图",
    screenshotDefaultTool: "默认标注工具",
    screenshotShortcutSection: "工具与快捷键",
    screenshotShortcutDescription: "关闭后隐藏截图框工具栏按钮，对应快捷键也会停用。",
    screenshotSaveSection: "保存设置",
    screenshotFileNameFormat: "格式",
    screenshotWatermarkText: "水印名称",
    screenshotSaveLocation: "保存目录",
    screenshotSaveAsk: "每次询问保存位置",
    screenshotSaveDefault: "保存到默认文件夹",
    screenshotSaveManual: "手动保存",
    screenshotAutoOpenFolder: "保存成功自动打开文件夹",
    screenshotAutoOpenFolderDescription: "保存后在 Finder 中显示截图文件。",
    screenshotAutoCopyPath: "保存成功自动复制完整文件路径",
    screenshotAutoCopyPathDescription: "保存后把截图路径写入剪贴板。",
    screenshotCompletionPreview: "完成预览",
    screenshotShowPreview: "显示完成预览",
    screenshotShowPreviewDescription: "截图完成后在右下角显示预览缩略图。",
    screenshotAutoPaste: "截图后自动粘贴",
    screenshotAutoPasteAfterCapture: "截图后自动粘贴",
    screenshotAutoPasteAfterCaptureDescription: "截图复制到剪贴板后自动粘贴到当前输入区域。",
    screenshotDoubleClick: "双击操作",
    screenshotDoubleClickFinish: "双击复制并结束",
    screenshotDoubleClickFinishDescription: "开启后可双击结束截图并复制截图。",
    screenshotCloseConfirm: "关闭确认",
    screenshotConfirmBeforeClose: "关闭前确认未保存内容",
    screenshotConfirmBeforeCloseDescription: "截图中途取消时提醒是否保存当前内容。",
    screenshotAdvanced: "高级设置",
    screenshotAutoFocusRecentArea: "自动聚焦最近截图区域",
    screenshotAutoFocusRecentAreaDescription: "进入截图后直接复用最近截图区域。",
    screenshotEffects: "图片效果",
    screenshotRoundedCorners: "圆角",
    screenshotRoundedCornersDescription: "导出图片时应用系统风格圆角。",
    screenshotShadow: "阴影",
    screenshotShadowDescription: "导出图片时增加柔和投影。",
    screenshotPinPosition: "钉图位置",
    screenshotPinMouse: "截图原位置",
    screenshotPinTopRight: "屏幕右上角",
    screenshotPinHistory: "钉图历史",
    screenshotPinHistoryDescription: "保存最近钉过的图片，可删除、添加或重新钉回屏幕。",
    screenshotPinHistoryLimit: "历史数量上限",
    screenshotPinHistoryLimitHint: "默认 50，范围 1-200。",
    screenshotPinHistoryEmpty: "还没有钉图历史。",
    screenshotPinHistoryLoading: "正在加载钉图历史...",
    screenshotPinHistoryImport: "添加图片",
    screenshotPinHistoryRestore: "钉回屏幕",
    screenshotPinHistoryDelete: "删除",
    screenshotPinHistoryLoaded: "钉图历史已刷新。",
    screenshotPinHistoryImported: "图片已添加到钉图历史。",
    screenshotPinHistoryDeleted: "钉图历史已删除。",
    screenshotPinHistoryRestored: "图片已钉回屏幕。",
    screenshotPinHistoryFailed: "钉图历史操作失败。",
    screenshotGuideLines: "截图辅助线",
    screenshotShowGuides: "显示辅助线",
    screenshotShowGuidesDescription: "选区时显示横竖辅助线和尺寸参考。",
    screenshotToolMove: "移动",
    screenshotToolNote: "备注",
    screenshotToolStep: "步骤",
    screenshotToolRectangle: "矩形",
    screenshotToolCircle: "圆形",
    screenshotToolArrow: "箭头",
    screenshotToolText: "文案",
    screenshotToolHighlight: "高亮",
    screenshotToolMosaic: "马赛克",
    screenshotToolBrush: "画笔",
    screenshotToolWatermark: "水印",
    screenshotActionOcr: "识字",
    screenshotActionTranslate: "翻译",
    screenshotActionQr: "识别二维码",
    screenshotActionSpotlightTranslate: "浮光翻译",
    screenshotActionRecord: "录屏",
    screenshotActionDelay: "延迟截图",
    screenshotActionPin: "钉图",
    screenshotActionCopy: "复制",
    screenshotActionDownload: "下载",
    screenshotActionCancel: "退出",
    savingSettings: "正在保存设置...",
    settingsSaved: "设置已保存。",
    settingsSaveFailed: "设置保存失败。",
    soundSaved: "操作声音已保存。",
    menuIconSaved: "菜单图标设置已保存。",
    launchAtLoginSaved: "开机自动启动已保存。",
    permissionSaved: "权限设置已保存。",
    permissionSaveFailed: "权限设置保存失败。",
    pathSaveFailed: "搜索路径保存失败。",
    pathSettings: "搜索路径",
    appSearchPaths: "应用扫描目录",
    fileSearchPaths: "文件搜索目录",
    pathSettingsHint: "应用和文件路径分开配置；每个目录单独显示，可选择、授权或删除。",
    pathPlaceholder: "/Users/chen/Documents",
    invalidPaths: "路径不存在或不是文件夹",
    pathsSaved: "搜索路径已保存。",
    authorizePaths: "授权",
    selectPaths: "选择",
    pathAuthorized: "路径权限已检查。",
    pathAuthorizationFailed: "部分路径无法访问，请检查权限或路径是否存在。",
    removePath: "删除",
    expandPaths: (count) => `展开全部 ${count} 条`,
    collapsePaths: "收起",
    pathAuthorizationCancelled: "未选择目录。",
    languageSaved: "语言已切换。",
    appearanceSaved: "外观已切换。",
    loadErrorTitle: "无法加载应用",
    retryScan: "重新扫描",
    scanningTitle: "正在扫描应用",
    scanningDescription: "极刻正在建立本地索引，窗口打开时不会是空白状态。",
    noMatchesTitle: "没有匹配的应用",
    noMatchesDescription: "试试其他应用名、英文片段或拼音缩写。",
    clearSearch: "清空搜索",
    enterKey: "回车",
    spaceKey: "空格",
  },
  en: {
    appTagline: "Raycast-style application launcher",
    scanningApplications: "Scanning applications...",
    failedToScan: "Failed to scan applications.",
    searchFailed: "Search failed.",
    searchingAll: "Searching apps and files",
    searchingApps: "Apps only",
    searchingFiles: "Files only",
    fileSearchMode: "Apps + Files",
    appSearchMode: "Apps",
    filesSearchMode: "Files",
    opening: (name) => `Opening ${name}...`,
    failedToOpen: (name) => `Failed to open ${name}.`,
    rescanStatus: "Rescanning applications...",
    applicationScanFailed: "Application scan failed.",
    launchOnlyDesktop: "Launching applications is only available inside the desktop app.",
    launching: (name) => `Launching ${name}...`,
    failedToLaunch: (name) => `Failed to launch ${name}.`,
    resultCount: (count, query) => `${count} result${count === 1 ? "" : "s"} for "${query}"`,
    noResultsFor: (query) => `No results for "${query}"`,
    indexedCount: (count) => `${count} applications indexed`,
    noApplications: "No applications were found in the scanned folders.",
    ready: "Ready",
    lastScan: "Last scan",
    settings: "Settings",
    basicSettings: "Basic Settings",
    operationSound: "Operation Sound",
    importExport: "Import / Export",
    menuIcon: "Menu Bar Icon",
    permissions: "Permissions",
    launchAtLogin: "Launch at Login",
    enabled: "On",
    disabled: "Off",
    soundEnabledDescription: "Play a short sound for launcher actions.",
    exportSettings: "Export Settings",
    importSettings: "Import Settings",
    settingsExported: "Settings exported.",
    settingsImported: "Settings imported.",
    exportCancelled: "Export cancelled.",
    importCancelled: "Import cancelled.",
    showMenuIcon: "Show menu bar icon",
    showMenuIconDescription: "When hidden, use your shortcut to open GEKE and turn it back on here.",
    launchAtLoginDescription: "Start GEKE automatically after signing in to macOS.",
    fixedShortcuts: "Fixed shortcuts",
    editableShortcuts: "Editable shortcuts",
    shortcutConflict: "Shortcut conflict. It was not saved.",
    shortcutInvalidSingle: "Use a modifier with single letters or numbers. Function keys like F1 are allowed.",
    shortcutNeedComplete: "Press another key to complete the shortcut.",
    wakeShortcuts: "Wake Panel",
    searchShortcuts: "Search Modes",
    actionShortcuts: "App Actions",
    searchAllShortcut: "Switch to apps + files",
    searchAppsShortcut: "Switch to apps",
    searchFilesShortcut: "Switch to files",
    rescanShortcut: "Rescan applications",
    wakePanel: "Wake Panel",
    resetDefaults: "Reset all",
    panelOpenDisplay: "Show after panel opens",
    panelOpenDescription: "Choose whether the launcher opens into app search or shortcut entries first.",
    appMode: "Apps",
    wakeEntriesDescription: "These entry methods can work together. Click a card to enable or record it.",
    multiWake: "Multi-key",
    doubleWake: "Double press",
    longPressWake: "Long press",
    enableWake: "Turn on",
    disableWake: "Turn off",
    editWake: "Edit",
    atLeastOneWake: "Keep at least one wake shortcut enabled.",
    preferGekeShortcuts: "Prefer GEKE shortcuts",
    preferGekeShortcutsDescription: "Requires macOS permission. When granted, GEKE wins conflicts with other apps.",
    openPermissionSettings: "Open Permission Settings",
    screenRecordingPermission: "Screen Recording Permission",
    screenRecordingPermissionDescription: "Required by the screenshot plugin. GEKE will not show the system prompt again when access is already granted.",
    appPathPermission: "Application folder permission",
    appPathPermissionDescription: "Authorize GEKE to access application search folders.",
    filePathPermission: "File folder permission",
    filePathPermissionDescription: "Authorize GEKE to access file search folders before searching.",
    searchPlaceholder: "Search applications, files, pinyin, or initials",
    searchPlaceholderAll: "Search applications, files, pinyin, or initials",
    searchPlaceholderApps: "Search applications, pinyin, or initials",
    searchPlaceholderFiles: "Search files",
    rescan: "Rescan",
    move: "Move",
    launch: "Launch",
    clearHide: "Clear / Hide",
    showHide: "Show / Hide",
    shortcutGuideTitle: "Shortcut Guide",
    shortcutGuideDescription: "These shortcuts work while the GEKE window is open. You can also open this panel from the menu bar icon.",
    scannedFolders: "Scanned folders",
    lastScanSetting: "Last scan",
    closeSettings: "Close settings",
    shortcut: "Shortcut",
    language: "Language",
    appearance: "Appearance",
    appearanceSystem: "System",
    appearanceLight: "Light",
    appearanceDark: "Dark",
    animation: "Animation",
    animationDescription: "Controls interface transitions, switch motion, and launcher wake animation.",
    animationSmooth: "Smooth",
    animationSnappy: "Snappy",
    animationSpring: "Spring",
    animationNone: "Off",
    animationSaved: "Animation changed.",
    change: "Change",
    save: "Save",
    recording: "Recording...",
    cancelRecording: "Cancel",
    activeShortcut: (shortcut) => `Active: ${shortcut}`,
    shortcutInactive: "Shortcut is not active.",
    settingsHint: "Choose a global shortcut to show or hide GEKE.",
    pressShortcut: "Press the shortcut you want to use.",
    pressNewShortcut: "Press a new shortcut",
    shortcutModifierRequired: "Use at least one modifier key, such as Option, Command, Control, or Shift.",
    multiShortcutRequired: "Multi-key wake needs a modifier plus a key, such as Option + Space.",
    shortcutCaptured: "Shortcut captured. Saving...",
    shortcutUnchanged: "Shortcut is unchanged.",
    savingShortcut: "Saving shortcut...",
    shortcutSaved: "Shortcut saved.",
    shortcutSaveFailed: "Shortcut could not be saved.",
    screenshotRunning: "Starting screenshot...",
    screenshotRunFailed: "Screenshot failed.",
    pluginInstalled: "Plugin downloaded.",
    pluginUninstalled: "Plugin uninstalled.",
    pluginEnabled: "Plugin enabled.",
    pluginDisabled: "Plugin disabled.",
    screenshotSettingSaved: "Screenshot plugin settings saved.",
    morePlugins: "More Plugins",
    morePluginsDescription: "Plugins are not downloaded by default. The screenshot plugin appears in search, shortcut guide, and conflict checks after download.",
    pluginDownloaded: "Downloaded",
    pluginNotDownloaded: "Not downloaded",
    pluginDownload: "Download",
    pluginUninstall: "Uninstall",
    pluginEnable: "Enable",
    pluginDisable: "Disable",
    pluginSettings: "Plugin Settings",
    pluginShortcuts: "Plugin Shortcuts",
    screenshotPlugin: "Screenshot",
    screenshotPluginDescription: "Interactive screenshot plugin with independent settings, shortcuts, and save behavior.",
    screenshotCaptureCommand: "Capture region",
    screenshotRestorePinnedImage: "Restore recent pin",
    screenshotDefaultTool: "Default Annotation Tool",
    screenshotShortcutSection: "Tools & Shortcuts",
    screenshotShortcutDescription: "Disabled tools are hidden from the screenshot toolbar and their shortcuts stop working.",
    screenshotSaveSection: "Save Settings",
    screenshotFileNameFormat: "Format",
    screenshotWatermarkText: "Watermark Text",
    screenshotSaveLocation: "Save Folder",
    screenshotSaveAsk: "Ask Every Time",
    screenshotSaveDefault: "Save to Default Folder",
    screenshotSaveManual: "Manual Save",
    screenshotAutoOpenFolder: "Open folder after saving",
    screenshotAutoOpenFolderDescription: "Reveal the screenshot file in Finder after saving.",
    screenshotAutoCopyPath: "Copy full file path after saving",
    screenshotAutoCopyPathDescription: "Copy the saved screenshot path to the clipboard.",
    screenshotCompletionPreview: "Completion Preview",
    screenshotShowPreview: "Show completion preview",
    screenshotShowPreviewDescription: "Show a small preview after the screenshot is completed.",
    screenshotAutoPaste: "Auto Paste",
    screenshotAutoPasteAfterCapture: "Paste after capture",
    screenshotAutoPasteAfterCaptureDescription: "Paste the captured image after it has been copied to the clipboard.",
    screenshotDoubleClick: "Double Click",
    screenshotDoubleClickFinish: "Double click to copy and finish",
    screenshotDoubleClickFinishDescription: "Double click to finish the capture and copy the image.",
    screenshotCloseConfirm: "Close Confirmation",
    screenshotConfirmBeforeClose: "Confirm before closing unsaved content",
    screenshotConfirmBeforeCloseDescription: "Ask before discarding unsaved screenshot edits.",
    screenshotAdvanced: "Advanced",
    screenshotAutoFocusRecentArea: "Focus recent capture area",
    screenshotAutoFocusRecentAreaDescription: "Reuse the most recent capture area when the tool opens.",
    screenshotEffects: "Image Effects",
    screenshotRoundedCorners: "Rounded corners",
    screenshotRoundedCornersDescription: "Apply macOS-style rounded corners to exported images.",
    screenshotShadow: "Shadow",
    screenshotShadowDescription: "Add a soft shadow to exported images.",
    screenshotPinPosition: "Pinned Image Position",
    screenshotPinMouse: "Original position",
    screenshotPinTopRight: "Screen top right",
    screenshotPinHistory: "Pinned Image History",
    screenshotPinHistoryDescription: "Manage recently pinned images. Delete, add, or pin them back to the screen.",
    screenshotPinHistoryLimit: "History limit",
    screenshotPinHistoryLimitHint: "Default 50, range 1-200.",
    screenshotPinHistoryEmpty: "No pinned image history yet.",
    screenshotPinHistoryLoading: "Loading pinned history...",
    screenshotPinHistoryImport: "Add Image",
    screenshotPinHistoryRestore: "Pin Again",
    screenshotPinHistoryDelete: "Delete",
    screenshotPinHistoryLoaded: "Pinned history refreshed.",
    screenshotPinHistoryImported: "Image added to pinned history.",
    screenshotPinHistoryDeleted: "Pinned history deleted.",
    screenshotPinHistoryRestored: "Image pinned back to the screen.",
    screenshotPinHistoryFailed: "Pinned history action failed.",
    screenshotGuideLines: "Guides",
    screenshotShowGuides: "Show guides",
    screenshotShowGuidesDescription: "Show axis guides and size reference while selecting.",
    screenshotToolMove: "Move",
    screenshotToolNote: "Note",
    screenshotToolStep: "Step",
    screenshotToolRectangle: "Rectangle",
    screenshotToolCircle: "Circle",
    screenshotToolArrow: "Arrow",
    screenshotToolText: "Text",
    screenshotToolHighlight: "Highlight",
    screenshotToolMosaic: "Mosaic",
    screenshotToolBrush: "Brush",
    screenshotToolWatermark: "Watermark",
    screenshotActionOcr: "OCR",
    screenshotActionTranslate: "Translate",
    screenshotActionQr: "QR",
    screenshotActionSpotlightTranslate: "Spotlight Translate",
    screenshotActionRecord: "Record",
    screenshotActionDelay: "Delay screenshot",
    screenshotActionPin: "Pin",
    screenshotActionCopy: "Copy",
    screenshotActionDownload: "Download",
    screenshotActionCancel: "Exit",
    savingSettings: "Saving settings...",
    settingsSaved: "Settings saved.",
    settingsSaveFailed: "Settings could not be saved.",
    soundSaved: "Operation sound saved.",
    menuIconSaved: "Menu bar icon setting saved.",
    launchAtLoginSaved: "Launch at login saved.",
    permissionSaved: "Permission setting saved.",
    permissionSaveFailed: "Permission setting could not be saved.",
    pathSaveFailed: "Search paths could not be saved.",
    pathSettings: "Search paths",
    appSearchPaths: "Application folders",
    fileSearchPaths: "File folders",
    pathSettingsHint: "Application and file paths are configured separately. Each folder can be selected, authorized, or removed.",
    pathPlaceholder: "/Users/chen/Documents",
    invalidPaths: "Path does not exist or is not a folder",
    pathsSaved: "Search paths saved.",
    authorizePaths: "Authorize",
    selectPaths: "Select",
    pathAuthorized: "Path permissions checked.",
    pathAuthorizationFailed: "Some paths cannot be accessed. Check permissions or whether the path exists.",
    removePath: "Remove",
    expandPaths: (count) => `Show all ${count}`,
    collapsePaths: "Collapse",
    pathAuthorizationCancelled: "No folder selected.",
    languageSaved: "Language changed.",
    appearanceSaved: "Appearance changed.",
    loadErrorTitle: "Unable to load applications",
    retryScan: "Retry scan",
    scanningTitle: "Scanning applications",
    scanningDescription: "The launcher is building its local index so the interface never opens as a blank window.",
    noMatchesTitle: "No matching applications",
    noMatchesDescription: "Try a different app name, an English fragment, or a pinyin abbreviation.",
    clearSearch: "Clear search",
    enterKey: "Enter",
    spaceKey: "Space",
  },
};

const state = {
  query: "",
  results: [],
  appResults: [],
  fileResults: [],
  screenshotResults: [],
  totalCount: 0,
  fileTotalCount: 0,
  screenshotTotalCount: 0,
  searchMode: DEFAULT_SEARCH_MODE,
  scannedPaths: [],
  lastScanAt: null,
  selectedIndex: 0,
  status: "loading",
  statusText: "",
  statusTone: "info",
  launchError: "",
  settings: {
    toggleShortcut: DEFAULT_TOGGLE_SHORTCUT,
    multiWakeEnabled: true,
    singleWakeEnabled: false,
    singleWakeShortcut: DEFAULT_SINGLE_WAKE_SHORTCUT,
    searchAllShortcut: DEFAULT_SEARCH_ALL_SHORTCUT,
    searchAppsShortcut: DEFAULT_SEARCH_APPS_SHORTCUT,
    searchFilesShortcut: DEFAULT_SEARCH_FILES_SHORTCUT,
    rescanShortcut: DEFAULT_RESCAN_SHORTCUT,
    doubleWakeEnabled: false,
    doubleWakeModifier: DEFAULT_MODIFIER_WAKE_KEY,
    longPressWakeEnabled: false,
    longPressWakeModifier: DEFAULT_MODIFIER_WAKE_KEY,
    mouseWakeEnabled: false,
    preferGekeShortcuts: DEFAULT_PREFER_GEKE_SHORTCUTS,
    operationSoundEnabled: false,
    menuIconVisible: true,
    launchAtLogin: false,
    appSearchPaths: DEFAULT_APP_SEARCH_PATHS,
    invalidAppSearchPaths: [],
    fileSearchPaths: DEFAULT_FILE_SEARCH_PATHS,
    invalidFileSearchPaths: [],
    language: DEFAULT_LANGUAGE,
    appearanceMode: "system",
    animationMode: DEFAULT_ANIMATION_MODE,
    screenshotPlugin: DEFAULT_SCREENSHOT_PLUGIN,
    shortcutStatus: {
      registered: false,
      shortcut: DEFAULT_TOGGLE_SHORTCUT,
      message: "Shortcut has not been registered yet.",
    },
  },
  settingsOpen: false,
  settingsSection: "basic",
  shortcutDraft: DEFAULT_TOGGLE_SHORTCUT,
  shortcutRecording: false,
  shortcutRecordingTarget: "multi",
  shortcutConflictTarget: "",
  shortcutErrorTarget: "",
  shortcutErrorMessage: "",
  shortcutGroupsOpen: {
    wake: true,
    search: true,
    actions: true,
    fixed: true,
  },
  pinnedImageHistory: [],
  pinnedImageHistoryLoading: false,
  pinnedImageHistoryLoaded: false,
  pinnedImageHistoryError: "",
  permissionPathGroupsOpen: {
    apps: false,
    files: false,
  },
  settingsMessage: "",
  settingsTone: "info",
};

let requestToken = 0;
let isComposing = false;
let ui = null;
let lastPointerPosition = null;
let searchDelayTimer = null;
let settingsMessageDismissTimer = null;
let settingsMessageDismissKey = "";
const systemThemeQuery = window.matchMedia?.("(prefers-color-scheme: dark)") ?? null;

applyAppearance();
bindEvents();
render();
void initialize();

function getLanguage() {
  return COPY[state.settings.language] ? state.settings.language : DEFAULT_LANGUAGE;
}

function t(key, ...args) {
  const value = COPY[getLanguage()][key] ?? COPY[DEFAULT_LANGUAGE][key] ?? key;
  return typeof value === "function" ? value(...args) : value;
}

function normalizeLanguage(value) {
  return COPY[value] ? value : DEFAULT_LANGUAGE;
}

function normalizeAppearanceMode(value) {
  return APPEARANCE_OPTIONS.some((option) => option.value === value) ? value : "system";
}

function normalizeAnimationMode(value) {
  return ANIMATION_OPTIONS.some((option) => option.value === value) ? value : DEFAULT_ANIMATION_MODE;
}

function normalizePinHistoryLimit(value) {
  const numeric = Number.parseInt(String(value ?? DEFAULT_PIN_HISTORY_LIMIT), 10);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_PIN_HISTORY_LIMIT;
  }
  return Math.min(Math.max(numeric, 1), 200);
}

function normalizeScreenshotPlugin(value = {}) {
  const toolShortcuts = { ...DEFAULT_SCREENSHOT_PLUGIN.toolShortcuts };
  for (const item of SCREENSHOT_ACTIONS) {
    const raw = value.toolShortcuts?.[item.id] || {};
    toolShortcuts[item.id] = {
      shortcut: raw.shortcut || toolShortcuts[item.id].shortcut,
      enabled: raw.enabled ?? toolShortcuts[item.id].enabled,
    };
  }
  const fileNameFormat = value.fileNameFormat === "浮光截图_yyyy-MM-dd_HH-mm-ss.png"
    ? DEFAULT_SCREENSHOT_PLUGIN.fileNameFormat
    : value.fileNameFormat || DEFAULT_SCREENSHOT_PLUGIN.fileNameFormat;
  return {
    ...DEFAULT_SCREENSHOT_PLUGIN,
    ...value,
    installed: Boolean(value.installed),
    enabled: value.enabled ?? DEFAULT_SCREENSHOT_PLUGIN.enabled,
    shortcut: value.shortcut || DEFAULT_SCREENSHOT_SHORTCUT,
    pinRestoreShortcut: value.pinRestoreShortcut || DEFAULT_PIN_RESTORE_SHORTCUT,
    defaultTool: "",
    toolShortcuts,
    fileNameFormat,
    watermarkText: value.watermarkText || DEFAULT_SCREENSHOT_PLUGIN.watermarkText,
    saveLocation: value.saveLocation || DEFAULT_SCREENSHOT_PLUGIN.saveLocation,
    saveBehavior: ["ask", "defaultFolder", "manual"].includes(value.saveBehavior) ? value.saveBehavior : DEFAULT_SCREENSHOT_PLUGIN.saveBehavior,
    pinPosition: ["mouse", "topRight"].includes(value.pinPosition) ? value.pinPosition : DEFAULT_SCREENSHOT_PLUGIN.pinPosition,
    pinHistoryLimit: normalizePinHistoryLimit(value.pinHistoryLimit),
  };
}

function screenshotPluginIsActive(plugin = state.settings.screenshotPlugin) {
  return Boolean(plugin.installed && plugin.enabled);
}

function resolveAppearanceMode(mode = state.settings.appearanceMode) {
  const normalized = normalizeAppearanceMode(mode);
  if (normalized === "system") {
    return systemThemeQuery?.matches ? "dark" : "light";
  }
  return normalized;
}

function applyAppearance() {
  const resolvedTheme = resolveAppearanceMode();
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.appearanceMode = normalizeAppearanceMode(state.settings.appearanceMode);
  document.documentElement.dataset.animationMode = normalizeAnimationMode(state.settings.animationMode);
  document.documentElement.style.colorScheme = resolvedTheme;
}

async function initialize() {
  state.status = "loading";
  state.statusText = t("scanningApplications");
  state.statusTone = "info";
  state.launchError = "";
  render();

  try {
    const [settings, payload] = await Promise.all([launcher.getSettings(), launcher.getInitialApps()]);
    applySettings(settings);
    applyPayload(payload);
    state.status = "ready";
    state.statusText = buildStatusText(state.query, payload.results.length, payload.totalCount);
    state.statusTone = "info";
  } catch (error) {
    state.status = "error";
    state.statusText = getErrorMessage(error, t("failedToScan"));
    state.statusTone = "error";
    state.results = [];
  }

  render();
  focusInput(state.query ? { cursorToEnd: true } : { selectAll: true });
}

function bindEvents() {
  launcher.onWindowVisible?.(() => {
    playLauncherWakeAnimation();
    focusInput({ cursorToEnd: true });
  });

  launcher.onSettingsChanged?.((settings) => {
    applySettings(settings);
    render();
  });

  launcher.onOpenSettings?.((section) => {
    openSettings(section);
  });

  launcher.onScreenshotError?.((message) => {
    state.launchError = getErrorMessage(message, t("screenshotRunFailed"));
    state.statusText = state.launchError;
    state.statusTone = "error";
    render();
    focusInput({ cursorToEnd: true });
  });

  window.addEventListener("focus", () => {
    focusInput({ cursorToEnd: true });
  });

  systemThemeQuery?.addEventListener?.("change", () => {
    if (state.settings.appearanceMode === "system") {
      applyAppearance();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (isComposing) {
      return;
    }

    if (state.shortcutRecording) {
      handleShortcutRecorderKeydown(event);
      return;
    }

    if (event.metaKey && event.key === ",") {
      event.preventDefault();
      openSettings();
      return;
    }

    if (eventMatchesShortcut(event, state.settings.rescanShortcut)) {
      event.preventDefault();
      void rescanApplications();
      return;
    }

    if (eventMatchesShortcut(event, state.settings.searchAllShortcut)) {
      event.preventDefault();
      setSearchMode("all");
      return;
    }

    if (eventMatchesShortcut(event, state.settings.searchAppsShortcut)) {
      event.preventDefault();
      setSearchMode("apps");
      return;
    }

    if (eventMatchesShortcut(event, state.settings.searchFilesShortcut)) {
      event.preventDefault();
      setSearchMode("files");
      return;
    }

    if (screenshotPluginIsActive() && eventMatchesShortcut(event, state.settings.screenshotPlugin.shortcut)) {
      event.preventDefault();
      void runScreenshotPlugin();
      return;
    }

    if (screenshotPluginIsActive() && eventMatchesShortcut(event, state.settings.screenshotPlugin.pinRestoreShortcut)) {
      event.preventDefault();
      void restoreRecentPinnedImage();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      void launchSelected();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      if (state.settingsOpen) {
        closeSettings();
        return;
      }
      void handleEscape();
    }
  });
}

function createFallbackBridge() {
  const fallbackPayload = {
    query: "",
    results: [],
    totalCount: 0,
    scannedPaths: ["/Applications", "~/Applications", "/System/Applications", "/System/Applications/Utilities"],
    lastScanAt: null,
  };

  return {
    async getInitialApps() {
      return fallbackPayload;
    },
    async searchApplications() {
      return fallbackPayload;
    },
    async searchFiles() {
      return [];
    },
    async rescanApplications() {
      return fallbackPayload;
    },
    async launchApplication() {
      throw new Error(t("launchOnlyDesktop"));
    },
    async openFile() {
      throw new Error(t("launchOnlyDesktop"));
    },
    async runScreenshotPlugin() {
      return true;
    },
    async restoreRecentPinnedImage() {
      return true;
    },
    async listPinnedImageHistory() {
      return [];
    },
    async importPinnedImageHistory() {
      return null;
    },
    async deletePinnedImageHistory() {
      return [];
    },
    async restorePinnedImage() {
      return true;
    },
    async selectSearchPaths() {
      return [];
    },
    async authorizeCurrentSearchPaths() {
      return [];
    },
    async openPriorityPermissionSettings() {
      return false;
    },
    async openScreenRecordingPermissionSettings() {
      return false;
    },
    async hideLauncher() {
      return true;
    },
    async getSettings() {
      return {
        toggleShortcut: DEFAULT_TOGGLE_SHORTCUT,
        multiWakeEnabled: true,
        singleWakeEnabled: false,
        singleWakeShortcut: DEFAULT_SINGLE_WAKE_SHORTCUT,
        searchAllShortcut: DEFAULT_SEARCH_ALL_SHORTCUT,
        searchAppsShortcut: DEFAULT_SEARCH_APPS_SHORTCUT,
        searchFilesShortcut: DEFAULT_SEARCH_FILES_SHORTCUT,
        rescanShortcut: DEFAULT_RESCAN_SHORTCUT,
        doubleWakeEnabled: false,
        doubleWakeModifier: DEFAULT_MODIFIER_WAKE_KEY,
        longPressWakeEnabled: false,
        longPressWakeModifier: DEFAULT_MODIFIER_WAKE_KEY,
        mouseWakeEnabled: false,
        preferGekeShortcuts: DEFAULT_PREFER_GEKE_SHORTCUTS,
        operationSoundEnabled: false,
        menuIconVisible: true,
        launchAtLogin: false,
        appSearchPaths: DEFAULT_APP_SEARCH_PATHS,
        invalidAppSearchPaths: [],
        fileSearchPaths: DEFAULT_FILE_SEARCH_PATHS,
        invalidFileSearchPaths: [],
        language: DEFAULT_LANGUAGE,
        appearanceMode: "system",
        animationMode: DEFAULT_ANIMATION_MODE,
        screenshotPlugin: DEFAULT_SCREENSHOT_PLUGIN,
        shortcutStatus: {
          registered: true,
          shortcut: DEFAULT_TOGGLE_SHORTCUT,
          message: "Shortcut registered.",
        },
      };
    },
    async updateSettings(settings) {
      return {
        ...settings,
        shortcutStatus: {
          registered: true,
          shortcut: settings.toggleShortcut,
          message: "Shortcut registered.",
        },
      };
    },
    async exportSettingsConfig() {
      return false;
    },
    async importSettingsConfig() {
      return null;
    },
    onWindowVisible() {},
    onSettingsChanged() {},
    onOpenSettings() {},
    onScreenshotError() {},
  };
}

function createTauriBridge() {
  const tauri = window.__TAURI__;
  const invoke = tauri?.core?.invoke;
  const listen = tauri?.event?.listen;
  if (typeof invoke !== "function") {
    return null;
  }

  return {
    getInitialApps: () => invoke("get_initial_apps"),
    searchApplications: (query = "") => invoke("search_applications", { query }),
    searchFiles: (query = "") => invoke("search_files", { query }),
    launchApplication: (appPath) => invoke("launch_application", { appPath }),
    openFile: (path) => invoke("open_file", { path }),
    runScreenshotPlugin: () => invoke("run_screenshot_plugin"),
    restoreRecentPinnedImage: () => invoke("restore_recent_pinned_image"),
    listPinnedImageHistory: () => invoke("list_pinned_image_history"),
    importPinnedImageHistory: () => invoke("import_pinned_image_history"),
    deletePinnedImageHistory: (pinId) => invoke("delete_pinned_image_history", { pinId }),
    restorePinnedImage: (pinId) => invoke("restore_pinned_image", { pinId }),
    selectSearchPaths: (kind, currentPaths = []) => invoke("select_search_paths", { kind, currentPaths }),
    authorizeCurrentSearchPaths: (currentPaths = []) => invoke("authorize_current_search_paths", { currentPaths }),
    rescanApplications: () => invoke("rescan_applications"),
    hideLauncher: () => invoke("hide_launcher"),
    getSettings: () => invoke("get_settings"),
    updateSettings: (settings) => invoke("update_settings", { settings }),
    openPriorityPermissionSettings: () => invoke("open_priority_permission_settings"),
    openScreenRecordingPermissionSettings: () => invoke("open_screen_recording_permission_settings"),
    exportSettingsConfig: () => invoke("export_settings_config"),
    importSettingsConfig: () => invoke("import_settings_config"),
    onWindowVisible(callback) {
      if (typeof callback === "function" && typeof listen === "function") {
        void listen("launcher:window-visible", () => callback());
      }
    },
    onSettingsChanged(callback) {
      if (typeof callback === "function" && typeof listen === "function") {
        void listen("launcher:settings-changed", (event) => callback(event.payload));
      }
    },
    onOpenSettings(callback) {
      if (typeof callback === "function" && typeof listen === "function") {
        void listen("launcher:open-settings", (event) => callback(event.payload));
      }
    },
    onScreenshotError(callback) {
      if (typeof callback === "function" && typeof listen === "function") {
        void listen("launcher:screenshot-error", (event) => callback(event.payload));
      }
    },
  };
}

function getErrorMessage(error, fallbackMessage) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  return fallbackMessage;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function syncSwitchDom(selector, active) {
  const control = document.querySelector(selector);
  if (!control) {
    return;
  }
  const row = control.closest(".settings-toggle-row, .wake-toggle-row");
  [control, row].filter(Boolean).forEach((element) => {
    element.dataset.active = String(active);
    if (element.getAttribute("role") === "switch") {
      element.setAttribute("aria-checked", String(active));
    }
  });
}

function playLauncherWakeAnimation() {
  if (normalizeAnimationMode(state.settings.animationMode) === "none") {
    return;
  }
  const panel = document.querySelector(".panel");
  if (!panel) {
    return;
  }
  panel.classList.remove("panel--wake-enter");
  void panel.offsetWidth;
  panel.classList.add("panel--wake-enter");
  window.setTimeout(() => {
    panel.classList.remove("panel--wake-enter");
  }, 420);
}

function getAnimationDelay() {
  const mode = normalizeAnimationMode(state.settings.animationMode);
  if (mode === "none") {
    return 0;
  }
  if (mode === "snappy") {
    return 150;
  }
  if (mode === "spring") {
    return 320;
  }
  return 240;
}

function clearSettingsMessageDismiss() {
  if (settingsMessageDismissTimer) {
    window.clearTimeout(settingsMessageDismissTimer);
  }
  settingsMessageDismissTimer = null;
  settingsMessageDismissKey = "";
}

function isPersistentSettingsMessage(message) {
  return new Set([
    t("savingSettings"),
    t("savingShortcut"),
    t("shortcutCaptured"),
    t("pressShortcut"),
    t("pressNewShortcut"),
  ]).has(message);
}

function scheduleSettingsMessageDismiss() {
  const message = state.settingsMessage;
  if (!message || state.shortcutRecording || isPersistentSettingsMessage(message)) {
    clearSettingsMessageDismiss();
    return;
  }

  const key = `${state.settingsTone}:${message}`;
  if (settingsMessageDismissKey === key && settingsMessageDismissTimer) {
    return;
  }

  clearSettingsMessageDismiss();
  settingsMessageDismissKey = key;
  const delay = state.settingsTone === "error" ? SETTINGS_ERROR_DISMISS_MS : SETTINGS_MESSAGE_DISMISS_MS;
  settingsMessageDismissTimer = window.setTimeout(() => {
    if (`${state.settingsTone}:${state.settingsMessage}` !== key) {
      return;
    }
    state.settingsMessage = "";
    state.settingsTone = "info";
    clearSettingsMessageDismiss();
    render();
  }, delay);
}

function buildStatusText(query, resultCount, totalCount) {
  if (query) {
    const matchCount = Number.isFinite(totalCount) ? totalCount : resultCount;
    return matchCount ? t("resultCount", matchCount, query) : t("noResultsFor", query);
  }

  return totalCount ? t("indexedCount", totalCount) : t("noApplications");
}

function getSearchModeLabel(mode = state.searchMode) {
  if (mode === "apps") {
    return t("appSearchMode");
  }
  if (mode === "files") {
    return t("filesSearchMode");
  }
  return t("fileSearchMode");
}

function buildModeStatusPrefix(mode = state.searchMode) {
  if (mode === "apps") {
    return t("searchingApps");
  }
  if (mode === "files") {
    return t("searchingFiles");
  }
  return t("searchingAll");
}

function getSearchPlaceholder(mode = state.searchMode) {
  if (mode === "apps") {
    return t("searchPlaceholderApps");
  }
  if (mode === "files") {
    return t("searchPlaceholderFiles");
  }
  return t("searchPlaceholderAll");
}

function normalizeAppResult(item) {
  return {
    ...item,
    id: item.id || `app:${item.path}`,
    type: "app",
    kind: "app",
    iconDataUrl: item.iconDataUrl || "",
  };
}

function normalizeFileResult(item) {
  return {
    ...item,
    id: item.id || `file:${item.path}`,
    type: "file",
    kind: item.kind || "file",
  };
}

function screenshotResultScore(query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return 1;
  }
  const name = `${t("screenshotPlugin")} ${t("screenshotCaptureCommand")} screenshot capture`.toLowerCase();
  if (name === normalizedQuery) {
    return 1200;
  }
  if (name.startsWith(normalizedQuery)) {
    return 900;
  }
  if (name.includes(normalizedQuery)) {
    return 680;
  }
  return 0;
}

function searchScreenshotCommand(query) {
  if (state.searchMode !== "all" || !screenshotPluginIsActive()) {
    return [];
  }
  const score = screenshotResultScore(query);
  if (score <= 0) {
    return [];
  }
  return [{
    id: "screenshot:capture",
    type: "screenshot",
    kind: "screenshot",
    name: t("screenshotCaptureCommand"),
    path: t("screenshotPlugin"),
    icon: "SHOT",
    shortcut: state.settings.screenshotPlugin.shortcut,
    score,
  }];
}

function combineResults(appResults = state.appResults, fileResults = state.fileResults, screenshotResults = state.screenshotResults, mode = state.searchMode) {
  if (mode === "apps") {
    return appResults;
  }
  if (mode === "files") {
    return fileResults;
  }
  return [...screenshotResults, ...appResults, ...fileResults];
}

function updateCombinedResults() {
  state.results = combineResults();
  state.selectedIndex = state.results.length ? Math.min(state.selectedIndex, state.results.length - 1) : 0;
}

function applyPayload(payload) {
  state.appResults = Array.isArray(payload.results) ? payload.results.map(normalizeAppResult) : [];
  state.fileResults = [];
  state.screenshotResults = searchScreenshotCommand("");
  state.totalCount = payload.totalCount ?? 0;
  state.fileTotalCount = 0;
  state.screenshotTotalCount = state.screenshotResults.length;
  state.scannedPaths = Array.isArray(payload.scannedPaths) ? payload.scannedPaths : [];
  state.lastScanAt = payload.lastScanAt ?? null;
  updateCombinedResults();
}

function applySettings(settings) {
  if (!settings || typeof settings !== "object") {
    return;
  }

  state.settings = {
    toggleShortcut: settings.toggleShortcut || state.settings.toggleShortcut,
    multiWakeEnabled: settings.multiWakeEnabled ?? state.settings.multiWakeEnabled,
    singleWakeEnabled: settings.singleWakeEnabled ?? state.settings.singleWakeEnabled,
    singleWakeShortcut: settings.singleWakeShortcut || state.settings.singleWakeShortcut,
    searchAllShortcut: settings.searchAllShortcut || state.settings.searchAllShortcut,
    searchAppsShortcut: settings.searchAppsShortcut || state.settings.searchAppsShortcut,
    searchFilesShortcut: settings.searchFilesShortcut || state.settings.searchFilesShortcut,
    rescanShortcut: settings.rescanShortcut || state.settings.rescanShortcut,
    doubleWakeEnabled: settings.doubleWakeEnabled ?? state.settings.doubleWakeEnabled,
    doubleWakeModifier: settings.doubleWakeModifier || state.settings.doubleWakeModifier,
    longPressWakeEnabled: settings.longPressWakeEnabled ?? state.settings.longPressWakeEnabled,
    longPressWakeModifier: settings.longPressWakeModifier || state.settings.longPressWakeModifier,
    mouseWakeEnabled: settings.mouseWakeEnabled ?? state.settings.mouseWakeEnabled,
    preferGekeShortcuts: settings.preferGekeShortcuts ?? state.settings.preferGekeShortcuts,
    operationSoundEnabled: settings.operationSoundEnabled ?? state.settings.operationSoundEnabled,
    menuIconVisible: settings.menuIconVisible ?? state.settings.menuIconVisible,
    launchAtLogin: settings.launchAtLogin ?? state.settings.launchAtLogin,
    appSearchPaths: Array.isArray(settings.appSearchPaths) ? settings.appSearchPaths : state.settings.appSearchPaths,
    invalidAppSearchPaths: Array.isArray(settings.invalidAppSearchPaths) ? settings.invalidAppSearchPaths : state.settings.invalidAppSearchPaths,
    fileSearchPaths: Array.isArray(settings.fileSearchPaths) ? settings.fileSearchPaths : state.settings.fileSearchPaths,
    invalidFileSearchPaths: Array.isArray(settings.invalidFileSearchPaths) ? settings.invalidFileSearchPaths : state.settings.invalidFileSearchPaths,
    language: normalizeLanguage(settings.language || state.settings.language),
    appearanceMode: normalizeAppearanceMode(settings.appearanceMode || state.settings.appearanceMode),
    animationMode: normalizeAnimationMode(settings.animationMode || state.settings.animationMode),
    screenshotPlugin: normalizeScreenshotPlugin(settings.screenshotPlugin || state.settings.screenshotPlugin),
    shortcutStatus: {
      registered: Boolean(settings.shortcutStatus?.registered),
      shortcut: settings.shortcutStatus?.shortcut || settings.toggleShortcut || state.settings.toggleShortcut,
      message: settings.shortcutStatus?.message || "",
    },
  };
  state.shortcutDraft = state.settings.toggleShortcut;
  applyAppearance();
}

function buildSettingsUpdate(overrides = {}) {
  return {
    toggleShortcut: state.settings.toggleShortcut,
    multiWakeEnabled: state.settings.multiWakeEnabled,
    singleWakeEnabled: state.settings.singleWakeEnabled,
    singleWakeShortcut: state.settings.singleWakeShortcut,
    searchAllShortcut: state.settings.searchAllShortcut,
    searchAppsShortcut: state.settings.searchAppsShortcut,
    searchFilesShortcut: state.settings.searchFilesShortcut,
    rescanShortcut: state.settings.rescanShortcut,
    doubleWakeEnabled: state.settings.doubleWakeEnabled,
    doubleWakeModifier: state.settings.doubleWakeModifier,
    longPressWakeEnabled: state.settings.longPressWakeEnabled,
    longPressWakeModifier: state.settings.longPressWakeModifier,
    mouseWakeEnabled: state.settings.mouseWakeEnabled,
    preferGekeShortcuts: state.settings.preferGekeShortcuts,
    operationSoundEnabled: state.settings.operationSoundEnabled,
    menuIconVisible: state.settings.menuIconVisible,
    launchAtLogin: state.settings.launchAtLogin,
    appSearchPaths: state.settings.appSearchPaths,
    fileSearchPaths: state.settings.fileSearchPaths,
    language: state.settings.language,
    appearanceMode: state.settings.appearanceMode,
    animationMode: state.settings.animationMode,
    screenshotPlugin: state.settings.screenshotPlugin,
    ...overrides,
  };
}

function focusInput({ selectAll = false, cursorToEnd = false } = {}) {
  if (state.settingsOpen || state.shortcutRecording) {
    return;
  }

  requestAnimationFrame(() => {
    const input = ui?.searchInput ?? document.querySelector(".search-input");
    if (!input || !input.isConnected || input.disabled || input.readOnly) {
      return;
    }

    input.focus({ preventScroll: true });

    if (selectAll) {
      input.select();
      return;
    }

    if (cursorToEnd) {
      const cursor = input.value.length;
      input.setSelectionRange(cursor, cursor);
    }
  });
}

function moveSelection(offset) {
  if (!state.results.length) {
    return;
  }

  state.selectedIndex = (state.selectedIndex + offset + state.results.length) % state.results.length;
  updateActiveResult({ scroll: true });
}

function updateActiveResult({ scroll = false } = {}) {
  document.querySelectorAll(".result-row").forEach((row, index) => {
    row.dataset.active = String(index === state.selectedIndex);
  });

  if (scroll) {
    document.querySelector(`[data-result-index="${state.selectedIndex}"]`)?.scrollIntoView({
      block: "nearest",
    });
  }
}

function scheduleSearch(query) {
  window.clearTimeout(searchDelayTimer);
  searchDelayTimer = window.setTimeout(() => {
    void performSearch(query);
  }, 160);
}

async function performSearch(query) {
  window.clearTimeout(searchDelayTimer);
  const currentToken = ++requestToken;
  state.launchError = "";

  try {
    const shouldSearchApps = state.searchMode === "all" || state.searchMode === "apps";
    const shouldSearchFiles = Boolean(query.trim()) && (state.searchMode === "all" || state.searchMode === "files");
    const [payload, files] = await Promise.all([
      shouldSearchApps ? launcher.searchApplications(query) : Promise.resolve(null),
      shouldSearchFiles ? launcher.searchFiles(query) : Promise.resolve([]),
    ]);
    if (currentToken !== requestToken) {
      return;
    }

    if (payload) {
      state.appResults = Array.isArray(payload.results) ? payload.results.map(normalizeAppResult) : [];
      state.totalCount = payload.totalCount ?? 0;
      state.scannedPaths = Array.isArray(payload.scannedPaths) ? payload.scannedPaths : state.scannedPaths;
      state.lastScanAt = payload.lastScanAt ?? state.lastScanAt;
    } else {
      state.appResults = [];
      state.totalCount = 0;
    }
    state.fileResults = Array.isArray(files) ? files.map(normalizeFileResult) : [];
    state.fileTotalCount = state.fileResults.length;
    state.screenshotResults = searchScreenshotCommand(query);
    state.screenshotTotalCount = state.screenshotResults.length;
    updateCombinedResults();
    state.status = "ready";
    state.statusText = query
      ? buildStatusText(query, state.results.length, state.results.length)
      : `${buildModeStatusPrefix()} · ${buildStatusText(query, state.results.length, state.totalCount)}`;
    state.statusTone = "info";
  } catch (error) {
    if (currentToken !== requestToken) {
      return;
    }

    state.status = state.results.length ? "ready" : "error";
    state.statusText = getErrorMessage(error, t("searchFailed"));
    state.statusTone = "error";
  }

  render();
}

async function rescanApplications() {
  const currentToken = ++requestToken;
  const nextQuery = state.query;
  state.status = "loading";
  state.statusText = t("rescanStatus");
  state.statusTone = "info";
  state.launchError = "";
  render();

  try {
    const payload = await launcher.rescanApplications();
    if (currentToken !== requestToken) {
      return;
    }

    applyPayload(payload);
    state.status = "ready";
    state.statusText = buildStatusText(payload.query, payload.results.length, payload.totalCount);
    state.statusTone = "info";

    if (nextQuery) {
      state.query = nextQuery;
      await performSearch(nextQuery);
      return;
    }
  } catch (error) {
    if (currentToken !== requestToken) {
      return;
    }

    state.status = "error";
    state.statusText = getErrorMessage(error, t("applicationScanFailed"));
    state.statusTone = "error";
    state.results = [];
  }

  render();
  focusInput({ cursorToEnd: true });
}

function setSearchMode(mode) {
  if (!["all", "apps", "files"].includes(mode) || state.searchMode === mode) {
    return;
  }

  state.searchMode = mode;
  state.selectedIndex = 0;
  state.statusText = buildModeStatusPrefix(mode);
  state.statusTone = "info";
  render();
  void performSearch(state.query);
  focusInput({ cursorToEnd: true });
}

async function handleEscape() {
  if (state.query) {
    state.query = "";
    state.selectedIndex = 0;
    syncInputValue({ force: true });
    await performSearch("");
    return;
  }

  if (state.launchError) {
    state.launchError = "";
    render();
    return;
  }

  await launcher.hideLauncher();
}

async function runScreenshotPlugin() {
  state.launchError = "";
  state.statusText = t("screenshotRunning");
  state.statusTone = "info";
  render();

  try {
    await launcher.runScreenshotPlugin();
    state.statusText = buildStatusText(state.query, state.results.length, state.totalCount);
    state.statusTone = "info";
    render();
  } catch (error) {
    state.launchError = getErrorMessage(error, t("screenshotRunFailed"));
    state.statusText = state.launchError;
    state.statusTone = "error";
    render();
  }
}

async function restoreRecentPinnedImage() {
  state.launchError = "";
  state.statusText = t("screenshotRestorePinnedImage");
  state.statusTone = "info";
  render();

  try {
    await launcher.restoreRecentPinnedImage();
    state.statusText = buildStatusText(state.query, state.results.length, state.totalCount);
    state.statusTone = "info";
  } catch (error) {
    state.launchError = getErrorMessage(error, t("screenshotRunFailed"));
    state.statusText = state.launchError;
    state.statusTone = "error";
  }

  render();
}

async function launchSelected() {
  const selectedItem = state.results[state.selectedIndex];
  if (!selectedItem) {
    return;
  }

  state.launchError = "";
  state.statusText = selectedItem.type === "screenshot"
    ? t("screenshotRunning")
    : selectedItem.type === "file"
      ? t("opening", selectedItem.name)
      : t("launching", selectedItem.name);
  state.statusTone = "info";
  render();

  try {
    if (selectedItem.type === "screenshot") {
      await launcher.runScreenshotPlugin();
    } else if (selectedItem.type === "file") {
      await launcher.openFile(selectedItem.path);
    } else {
      await launcher.launchApplication(selectedItem.path);
    }
    state.launchError = "";
    state.statusText = buildStatusText(state.query, state.results.length, state.totalCount);
    state.statusTone = "info";
    render();
    if (selectedItem.type !== "screenshot") {
      await launcher.hideLauncher();
    }
  } catch (error) {
    state.launchError = getErrorMessage(
      error,
      selectedItem.type === "screenshot"
        ? t("screenshotRunFailed")
        : selectedItem.type === "file"
          ? t("failedToOpen", selectedItem.name)
          : t("failedToLaunch", selectedItem.name),
    );
    state.statusText = state.launchError;
    state.statusTone = "error";
    render();
  }
}

function onInput(event) {
  state.query = event.currentTarget.value;
  state.selectedIndex = 0;

  if (event.isComposing || isComposing) {
    return;
  }

  scheduleSearch(state.query);
}

function onCompositionStart() {
  isComposing = true;
}

function onCompositionEnd(event) {
  isComposing = false;
  state.query = event.currentTarget.value;
  state.selectedIndex = 0;
  scheduleSearch(state.query);
}

function onResultHover(index) {
  if (state.selectedIndex === index) {
    return;
  }

  state.selectedIndex = index;
  updateActiveResult();
}

async function onResultClick(index) {
  state.selectedIndex = index;
  render();
  await launchSelected();
}

function formatTime(value) {
  if (!value) {
    return t("ready");
  }

  return new Intl.DateTimeFormat(getLanguage(), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat(getLanguage(), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInitials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "AP";
  }

  return parts
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toUpperCase();
}

function getResultIcon(item) {
  if (item.type === "screenshot") {
    return item.icon || "SHOT";
  }
  if (item.type === "file") {
    return item.kind === "folder" ? "DIR" : "FILE";
  }
  return getInitials(item.name);
}

function renderResultIcon(item) {
  if (item.type === "app" && item.iconDataUrl) {
    return `
      <span class="result-icon result-icon--image" data-type="app" aria-hidden="true">
        <img src="${escapeHtml(item.iconDataUrl)}" alt="" loading="lazy" />
      </span>
    `;
  }

  return `<span class="result-icon" data-type="${escapeHtml(item.type)}" aria-hidden="true">${escapeHtml(getResultIcon(item))}</span>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatShortcut(shortcut) {
  const labels = {
    CmdOrCtrl: "⌘",
    CommandOrControl: "⌘",
    Command: "⌘",
    Cmd: "⌘",
    Control: "⌃",
    Ctrl: "⌃",
    Alt: "⌥",
    Option: "⌥",
    Shift: "⇧",
    Space: t("spaceKey"),
    Return: t("enterKey"),
    Up: "↑",
    Down: "↓",
    Left: "←",
    Right: "→",
  };

  return String(shortcut || "")
    .split("+")
    .filter(Boolean)
    .map((part) => labels[part] || part)
    .join(" ");
}

function formatShortcutWords(shortcut) {
  const labels = {
    CmdOrCtrl: "Command",
    CommandOrControl: "Command",
    Command: "Command",
    Cmd: "Command",
    Control: "Control",
    Ctrl: "Control",
    Alt: "Option",
    Option: "Option",
    Shift: "Shift",
    Space: "Space",
    Return: "Enter",
    Up: "Up",
    Down: "Down",
    Left: "Left",
    Right: "Right",
  };

  return String(shortcut || "")
    .split("+")
    .filter(Boolean)
    .map((part) => labels[part] || part)
    .join(" + ");
}

function getShortcutKey(event) {
  if (/^Key[A-Z]$/.test(event.code)) {
    return event.code.slice(3);
  }

  if (/^Digit[0-9]$/.test(event.code)) {
    return event.code.slice(5);
  }

  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(event.code)) {
    return event.code;
  }

  const codeMap = {
    Space: "Space",
    Enter: "Return",
    Return: "Return",
    Tab: "Tab",
    Backspace: "Backspace",
    Delete: "Delete",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Escape: "Escape",
  };

  if (codeMap[event.code]) {
    return codeMap[event.code];
  }

  const keyMap = {
    " ": "Space",
    Spacebar: "Space",
    Enter: "Return",
    Return: "Return",
    Tab: "Tab",
    Backspace: "Backspace",
    Delete: "Delete",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Escape: "Escape",
  };

  if (keyMap[event.key]) {
    return keyMap[event.key];
  }

  if (event.key?.length === 1 && /[A-Za-z0-9]/.test(event.key)) {
    return event.key.toUpperCase();
  }

  return "";
}

function isModifierKeyEvent(event) {
  return ["Meta", "Control", "Alt", "Shift"].includes(event.key) || ["MetaLeft", "MetaRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "ShiftLeft", "ShiftRight"].includes(event.code);
}

function getShortcutModifiers(event) {
  const modifiers = [];
  if (event.altKey) {
    modifiers.push("Alt");
  }
  if (event.metaKey) {
    modifiers.push("CmdOrCtrl");
  }
  if (event.ctrlKey) {
    modifiers.push("Control");
  }
  if (event.shiftKey) {
    modifiers.push("Shift");
  }
  return modifiers;
}

function normalizeShortcutValue(shortcut) {
  return String(shortcut || "")
    .split("+")
    .filter(Boolean)
    .map((part) => {
      if (["Command", "Cmd", "CommandOrControl"].includes(part)) {
        return "CmdOrCtrl";
      }
      if (part === "Option") {
        return "Alt";
      }
      if (part === "Ctrl") {
        return "Control";
      }
      if (part === "Enter") {
        return "Return";
      }
      return part;
    })
    .join("+");
}

function shortcutFromEvent(event, { requireModifier = true } = {}) {
  const modifiers = getShortcutModifiers(event);
  const key = getShortcutKey(event);
  const isModifierKey = isModifierKeyEvent(event);

  if (!key || isModifierKey) {
    return "";
  }

  if (requireModifier && !modifiers.length) {
    return "";
  }

  return normalizeShortcutValue([...modifiers, key].join("+"));
}

function isFunctionKeyShortcut(shortcut) {
  return /^F([1-9]|1[0-9]|2[0-4])$/.test(normalizeShortcutValue(shortcut));
}

function isModifierOnlyShortcut(shortcut) {
  const parts = normalizeShortcutValue(shortcut).split("+").filter(Boolean);
  return Boolean(parts.length) && parts.every((part) => ["Alt", "CmdOrCtrl", "Control", "Shift"].includes(part));
}

function shortcutHasModifier(shortcut) {
  return normalizeShortcutValue(shortcut)
    .split("+")
    .some((part) => ["Alt", "CmdOrCtrl", "Control", "Shift"].includes(part));
}

function validateEditableShortcut(shortcut, target) {
  const normalized = normalizeShortcutValue(shortcut);
  if (!normalized || isModifierOnlyShortcut(normalized)) {
    return t("shortcutNeedComplete");
  }
  if (shortcutHasConflict(normalized, target)) {
    return t("shortcutConflict");
  }
  if (!shortcutHasModifier(normalized) && !isFunctionKeyShortcut(normalized)) {
    return t("shortcutInvalidSingle");
  }
  return "";
}

function buildShortcutFromEvent(event, target = "multi") {
  return shortcutFromEvent(event, { requireModifier: target === "multi" });
}

function eventMatchesShortcut(event, shortcut) {
  const normalized = normalizeShortcutValue(shortcut);
  if (!normalized) {
    return false;
  }
  const eventShortcut = shortcutFromEvent(event, { requireModifier: false });
  return eventShortcut === normalized;
}

function appShortcutDefinitions() {
  return [
    { target: "searchAllShortcut", group: "search", label: t("searchAllShortcut"), shortcut: state.settings.searchAllShortcut, defaultShortcut: DEFAULT_SEARCH_ALL_SHORTCUT },
    { target: "searchAppsShortcut", group: "search", label: t("searchAppsShortcut"), shortcut: state.settings.searchAppsShortcut, defaultShortcut: DEFAULT_SEARCH_APPS_SHORTCUT },
    { target: "searchFilesShortcut", group: "search", label: t("searchFilesShortcut"), shortcut: state.settings.searchFilesShortcut, defaultShortcut: DEFAULT_SEARCH_FILES_SHORTCUT },
    { target: "rescanShortcut", group: "actions", label: t("rescanShortcut"), shortcut: state.settings.rescanShortcut, defaultShortcut: DEFAULT_RESCAN_SHORTCUT },
  ];
}

function allEditableShortcutDefinitions() {
  const shortcuts = [
    ...appShortcutDefinitions(),
    { target: "toggleShortcut", group: "wake", label: t("showHide"), shortcut: state.settings.toggleShortcut, defaultShortcut: DEFAULT_TOGGLE_SHORTCUT },
    {
      target: "screenshotPluginShortcut",
      group: "screenshot",
      label: t("screenshotCaptureCommand"),
      shortcut: state.settings.screenshotPlugin.shortcut,
      defaultShortcut: DEFAULT_SCREENSHOT_SHORTCUT,
    },
    {
      target: "screenshotPinRestoreShortcut",
      group: "screenshot",
      label: t("screenshotRestorePinnedImage"),
      shortcut: state.settings.screenshotPlugin.pinRestoreShortcut,
      defaultShortcut: DEFAULT_PIN_RESTORE_SHORTCUT,
    },
  ];
  return shortcuts;
}

function fixedShortcutDefinitions() {
  return [
    { keys: ["↑", "↓"], label: t("move"), protectedShortcuts: ["Up", "Down"] },
    { keys: [t("enterKey")], label: t("launch"), protectedShortcuts: ["Return"] },
    { keys: ["Esc"], label: t("clearHide"), protectedShortcuts: ["Escape"] },
  ];
}

function shortcutHasConflict(shortcut, target) {
  const normalized = normalizeShortcutValue(shortcut);
  if (!normalized) {
    return true;
  }

  const protectedShortcuts = fixedShortcutDefinitions().flatMap((item) => item.protectedShortcuts);
  if (protectedShortcuts.includes(normalized)) {
    return true;
  }

  return allEditableShortcutDefinitions().some((item) => item.target !== target && normalizeShortcutValue(item.shortcut) === normalized);
}

function isEditableShortcutTarget(target) {
  return target in state.settings || target === "screenshotPluginShortcut" || target === "screenshotPinRestoreShortcut";
}

function settingTargetForRecordingTarget(target) {
  return target === "multi" ? "toggleShortcut" : target;
}

function draftValueForRecordingTarget(target) {
  if (target === "multi") {
    return state.settings.toggleShortcut;
  }
  if (target === "double") {
    return state.settings.doubleWakeModifier;
  }
  if (target === "long") {
    return state.settings.longPressWakeModifier;
  }
  if (target === "screenshotPluginShortcut") {
    return state.settings.screenshotPlugin.shortcut;
  }
  if (target === "screenshotPinRestoreShortcut") {
    return state.settings.screenshotPlugin.pinRestoreShortcut;
  }
  return target in state.settings ? state.settings[target] : "";
}

function cancelShortcutRecording({ renderAfter = true } = {}) {
  state.shortcutRecording = false;
  state.shortcutRecordingTarget = "multi";
  state.shortcutDraft = state.settings.toggleShortcut;
  state.shortcutConflictTarget = "";
  state.shortcutErrorTarget = "";
  state.shortcutErrorMessage = "";
  state.settingsMessage = "";
  state.settingsTone = "info";
  if (renderAfter) {
    render();
  }
}

function normalizeSettingsSection(section) {
  return SETTINGS_SECTIONS.some((item) => item.id === section) ? section : "basic";
}

function openSettings(section = "basic") {
  state.settingsOpen = true;
  state.settingsSection = normalizeSettingsSection(section);
  cancelShortcutRecording({ renderAfter: false });
  render();
  if (state.settingsSection === "plugins" && state.settings.screenshotPlugin.installed) {
    void loadPinnedImageHistory();
  }
}

function closeSettings() {
  state.settingsOpen = false;
  cancelShortcutRecording({ renderAfter: false });
  render();
  focusInput({ cursorToEnd: true });
}

function startShortcutRecording(target = "multi") {
  if (state.shortcutRecording && state.shortcutRecordingTarget === target) {
    cancelShortcutRecording();
    return;
  }

  if (state.shortcutRecording && state.shortcutRecordingTarget !== target) {
    return;
  }

  state.shortcutRecording = true;
  state.shortcutRecordingTarget = target;
  state.shortcutConflictTarget = "";
  state.shortcutErrorTarget = "";
  state.shortcutErrorMessage = "";
  state.shortcutDraft = draftValueForRecordingTarget(target);
  state.settingsMessage = "";
  state.settingsTone = "info";
  render();
}

function handleShortcutRecorderKeydown(event) {
  event.preventDefault();
  event.stopPropagation();

  if (event.key === "Escape") {
    cancelShortcutRecording();
    return;
  }

  if (isEditableShortcutTarget(state.shortcutRecordingTarget)) {
    const modifierPreview = getShortcutModifiers(event).join("+");
    const shortcut = shortcutFromEvent(event, { requireModifier: false }) || modifierPreview;
    if (!shortcut) {
      state.shortcutDraft = "";
      state.shortcutErrorTarget = state.shortcutRecordingTarget;
      state.shortcutErrorMessage = t("pressShortcut");
      render();
      return;
    }
    const errorMessage = validateEditableShortcut(shortcut, state.shortcutRecordingTarget);
    state.shortcutDraft = shortcut;
    if (errorMessage) {
      state.shortcutConflictTarget = state.shortcutRecordingTarget;
      state.shortcutErrorTarget = state.shortcutRecordingTarget;
      state.shortcutErrorMessage = errorMessage;
      render();
      return;
    }
    state.shortcutRecording = false;
    state.shortcutConflictTarget = "";
    state.shortcutErrorTarget = "";
    state.shortcutErrorMessage = "";
    state.settingsMessage = "";
    state.settingsTone = "info";
    render();
    void saveAppShortcut(state.shortcutRecordingTarget, shortcut);
    return;
  }

  if (state.shortcutRecordingTarget === "double" || state.shortcutRecordingTarget === "long") {
    const modifier = getShortcutModifiers(event).at(-1) || "";
    if (!modifier) {
      state.settingsMessage = t("shortcutModifierRequired");
      state.settingsTone = "error";
      render();
      return;
    }
    state.shortcutDraft = modifier;
    state.shortcutRecording = false;
    state.settingsMessage = t("shortcutCaptured");
    state.settingsTone = "info";
    render();
    void saveWakeSettings({ target: state.shortcutRecordingTarget, value: modifier });
    return;
  }

  const target = state.shortcutRecordingTarget;
  const shortcut = buildShortcutFromEvent(event, target);
  if (!shortcut) {
    const modifierPreview = getShortcutModifiers(event).join("+");
    const isModifierKey = isModifierKeyEvent(event);
    if (isModifierKey && modifierPreview) {
      state.shortcutDraft = modifierPreview;
      state.settingsMessage = t("pressShortcut");
      state.settingsTone = "info";
      render();
      return;
    }

    state.settingsMessage = t("multiShortcutRequired");
    state.settingsTone = "error";
    render();
    return;
  }

  const errorMessage = validateEditableShortcut(shortcut, settingTargetForRecordingTarget(target));
  if (errorMessage) {
    state.shortcutDraft = shortcut;
    state.shortcutConflictTarget = target;
    state.shortcutErrorTarget = target;
    state.shortcutErrorMessage = errorMessage;
    state.settingsMessage = "";
    state.settingsTone = "info";
    render();
    return;
  }

  state.shortcutDraft = shortcut;
  state.shortcutRecording = false;
  state.shortcutConflictTarget = "";
  state.shortcutErrorTarget = "";
  state.shortcutErrorMessage = "";
  state.settingsMessage = t("shortcutCaptured");
  state.settingsTone = "info";
  render();
  void saveShortcut({ force: true, target, shortcut });
}

async function saveAppShortcut(target, shortcut) {
  const errorMessage = isEditableShortcutTarget(target) ? validateEditableShortcut(shortcut, target) : t("shortcutConflict");
  if (errorMessage) {
    state.shortcutConflictTarget = target;
    state.shortcutErrorTarget = target;
    state.shortcutErrorMessage = errorMessage;
    render();
    return;
  }

  state.settingsMessage = t("savingShortcut");
  state.settingsTone = "info";
  render();

  try {
    const overrides = target === "screenshotPluginShortcut"
      ? { screenshotPlugin: { ...state.settings.screenshotPlugin, shortcut } }
      : target === "screenshotPinRestoreShortcut"
        ? { screenshotPlugin: { ...state.settings.screenshotPlugin, pinRestoreShortcut: shortcut } }
      : target === "toggleShortcut"
        ? { toggleShortcut: shortcut, multiWakeEnabled: true }
        : { [target]: shortcut };
    const settings = await launcher.updateSettings(buildSettingsUpdate(overrides));
    applySettings(settings);
    state.settingsMessage = t("shortcutSaved");
    state.shortcutErrorTarget = "";
    state.shortcutErrorMessage = "";
    state.settingsTone = target === "toggleShortcut" && !settings.shortcutStatus?.registered ? "error" : "success";
  } catch (error) {
    state.shortcutErrorTarget = target;
    state.shortcutErrorMessage = getErrorMessage(error, t("shortcutSaveFailed"));
    state.settingsMessage = "";
    state.settingsTone = "info";
  }

  render();
}

async function saveShortcut({ force = false, target = "multi", shortcut = state.shortcutDraft } = {}) {
  const currentShortcut = state.settings.toggleShortcut;
  const shortcutIsUnchanged = shortcut === currentShortcut;
  if (!shortcut || (shortcutIsUnchanged && state.settings.shortcutStatus.registered && !force)) {
    state.settingsMessage = t("shortcutUnchanged");
    state.settingsTone = "info";
    render();
    return;
  }

  state.settingsMessage = t("savingShortcut");
  state.settingsTone = "info";
  render();

  try {
    const overrides = { toggleShortcut: shortcut, multiWakeEnabled: true };
    const settings = await launcher.updateSettings(buildSettingsUpdate(overrides));
    applySettings(settings);
    state.settingsMessage = t("shortcutSaved");
    state.settingsTone = settings.shortcutStatus?.registered ? "success" : "error";
  } catch (error) {
    state.settingsMessage = getErrorMessage(error, t("shortcutSaveFailed"));
    state.settingsTone = "error";
  }

  render();
}

async function resetShortcutDefaults() {
  const settings = await launcher.updateSettings(
    buildSettingsUpdate({
      toggleShortcut: DEFAULT_TOGGLE_SHORTCUT,
      searchAllShortcut: DEFAULT_SEARCH_ALL_SHORTCUT,
      searchAppsShortcut: DEFAULT_SEARCH_APPS_SHORTCUT,
      searchFilesShortcut: DEFAULT_SEARCH_FILES_SHORTCUT,
      rescanShortcut: DEFAULT_RESCAN_SHORTCUT,
      multiWakeEnabled: true,
      singleWakeEnabled: false,
      singleWakeShortcut: DEFAULT_SINGLE_WAKE_SHORTCUT,
      doubleWakeEnabled: false,
      doubleWakeModifier: DEFAULT_MODIFIER_WAKE_KEY,
      longPressWakeEnabled: false,
      longPressWakeModifier: DEFAULT_MODIFIER_WAKE_KEY,
      mouseWakeEnabled: false,
      preferGekeShortcuts: DEFAULT_PREFER_GEKE_SHORTCUTS,
      screenshotPlugin: {
        ...state.settings.screenshotPlugin,
        shortcut: DEFAULT_SCREENSHOT_SHORTCUT,
        pinRestoreShortcut: DEFAULT_PIN_RESTORE_SHORTCUT,
      },
    }),
  );
  applySettings(settings);
  state.settingsMessage = t("shortcutSaved");
  state.settingsTone = "success";
  render();
}

function getWakeEnabled(target) {
  if (target === "multi") {
    return state.settings.multiWakeEnabled;
  }
  if (target === "double") {
    return state.settings.doubleWakeEnabled;
  }
  if (target === "long") {
    return state.settings.longPressWakeEnabled;
  }
  return false;
}

function enabledWakeCount(settings = state.settings) {
  return [settings.multiWakeEnabled, settings.doubleWakeEnabled, settings.longPressWakeEnabled].filter(Boolean).length;
}

async function saveWakeSettings({ target, value } = {}) {
  const overrides = {};
  const previousSettings = { ...state.settings };
  if (target === "multi") {
    overrides.multiWakeEnabled = !state.settings.multiWakeEnabled;
  } else if (target === "double") {
    overrides.doubleWakeEnabled = value ? true : !state.settings.doubleWakeEnabled;
    if (value) {
      overrides.doubleWakeModifier = value;
    }
  } else if (target === "long") {
    overrides.longPressWakeEnabled = value ? true : !state.settings.longPressWakeEnabled;
    if (value) {
      overrides.longPressWakeModifier = value;
    }
  } else {
    return;
  }

  const nextSettings = { ...state.settings, ...overrides };
  if (enabledWakeCount(nextSettings) === 0) {
    state.settingsMessage = t("atLeastOneWake");
    state.settingsTone = "error";
    render();
    return;
  }

  state.settingsMessage = t("savingSettings");
  state.settingsTone = "info";
  state.settings = { ...state.settings, ...overrides };
  render();

  try {
    const settings = await launcher.updateSettings(buildSettingsUpdate(overrides));
    applySettings(settings);
    state.settingsMessage = t("shortcutSaved");
    state.settingsTone = "success";
  } catch (error) {
    state.settings = previousSettings;
    state.settingsMessage = getErrorMessage(error, t("shortcutSaveFailed"));
    state.settingsTone = "error";
  }

  render();
}

async function togglePreferGekeShortcuts() {
  const nextValue = !state.settings.preferGekeShortcuts;
  const previousSettings = { ...state.settings };
  state.settings = { ...state.settings, preferGekeShortcuts: nextValue };
  state.settingsMessage = t("savingSettings");
  state.settingsTone = "info";
  syncSwitchDom('[data-action="toggle-prefer-geke-shortcuts"]', nextValue);

  try {
    const [settings] = await Promise.all([
      launcher.updateSettings(buildSettingsUpdate({ preferGekeShortcuts: nextValue })),
      wait(getAnimationDelay()),
    ]);
    applySettings(settings);
    state.settingsMessage = t("permissionSaved");
    state.settingsTone = "success";
  } catch (error) {
    state.settings = previousSettings;
    syncSwitchDom('[data-action="toggle-prefer-geke-shortcuts"]', previousSettings.preferGekeShortcuts);
    if (nextValue) {
      await openPriorityPermissionSettings({ silent: true });
    }
    state.settingsMessage = getErrorMessage(error, t("permissionSaveFailed"));
    state.settingsTone = "error";
  }

  render();
}

async function openPriorityPermissionSettings({ silent = false } = {}) {
  try {
    const opened = await launcher.openPriorityPermissionSettings();
    if (!silent) {
      state.settingsMessage = opened ? t("openPermissionSettings") : t("permissionSaveFailed");
      state.settingsTone = opened ? "success" : "error";
      render();
    }
    return opened;
  } catch (error) {
    if (!silent) {
      state.settingsMessage = getErrorMessage(error, t("permissionSaveFailed"));
      state.settingsTone = "error";
      render();
    }
    return false;
  }
}

async function openScreenRecordingPermissionSettings() {
  try {
    const opened = await launcher.openScreenRecordingPermissionSettings();
    state.settingsMessage = opened ? t("openPermissionSettings") : t("permissionSaveFailed");
    state.settingsTone = opened ? "success" : "error";
  } catch (error) {
    state.settingsMessage = getErrorMessage(error, t("permissionSaveFailed"));
    state.settingsTone = "error";
  }
  render();
}

async function setLanguage(language) {
  const nextLanguage = normalizeLanguage(language);
  if (nextLanguage === state.settings.language) {
    return;
  }

  const previousLanguage = state.settings.language;
  state.settings = {
    ...state.settings,
    language: nextLanguage,
  };
  state.settingsMessage = t("savingSettings");
  state.settingsTone = "info";
  render();

  try {
    const settings = await launcher.updateSettings(buildSettingsUpdate({ language: nextLanguage }));
    applySettings(settings);
    if (state.status === "ready") {
      state.statusText = buildStatusText(state.query, state.results.length, state.totalCount);
    }
    state.settingsMessage = t("languageSaved");
    state.settingsTone = "success";
  } catch (error) {
    state.settings = {
      ...state.settings,
      language: previousLanguage,
    };
    state.settingsMessage = getErrorMessage(error, t("settingsSaveFailed"));
    state.settingsTone = "error";
  }

  render();
}

async function setAppearanceMode(mode) {
  const nextMode = normalizeAppearanceMode(mode);
  if (nextMode === state.settings.appearanceMode) {
    return;
  }

  const previousMode = state.settings.appearanceMode;
  state.settings = {
    ...state.settings,
    appearanceMode: nextMode,
  };
  applyAppearance();
  state.settingsMessage = t("savingSettings");
  state.settingsTone = "info";
  render();

  try {
    const settings = await launcher.updateSettings(buildSettingsUpdate({ appearanceMode: nextMode }));
    applySettings(settings);
    state.settingsMessage = t("appearanceSaved");
    state.settingsTone = "success";
  } catch (error) {
    state.settings = {
      ...state.settings,
      appearanceMode: previousMode,
    };
    applyAppearance();
    state.settingsMessage = getErrorMessage(error, t("settingsSaveFailed"));
    state.settingsTone = "error";
  }

  render();
}

async function setAnimationMode(mode) {
  const nextMode = normalizeAnimationMode(mode);
  if (nextMode === state.settings.animationMode) {
    return;
  }

  const previousMode = state.settings.animationMode;
  state.settings = {
    ...state.settings,
    animationMode: nextMode,
  };
  applyAppearance();
  state.settingsMessage = t("savingSettings");
  state.settingsTone = "info";
  render();

  try {
    const settings = await launcher.updateSettings(buildSettingsUpdate({ animationMode: nextMode }));
    applySettings(settings);
    state.settingsMessage = t("animationSaved");
    state.settingsTone = "success";
  } catch (error) {
    state.settings = {
      ...state.settings,
      animationMode: previousMode,
    };
    applyAppearance();
    state.settingsMessage = getErrorMessage(error, t("settingsSaveFailed"));
    state.settingsTone = "error";
  }

  render();
}

function getBooleanSettingSuccessMessage(settingName) {
  if (settingName === "operationSoundEnabled") {
    return t("soundSaved");
  }
  if (settingName === "menuIconVisible") {
    return t("menuIconSaved");
  }
  if (settingName === "launchAtLogin") {
    return t("launchAtLoginSaved");
  }
  return t("settingsSaved");
}

async function toggleBooleanSetting(settingName) {
  if (!Object.prototype.hasOwnProperty.call(state.settings, settingName)) {
    return;
  }

  const previousSettings = { ...state.settings };
  const nextValue = !state.settings[settingName];
  state.settings = { ...state.settings, [settingName]: nextValue };
  state.settingsMessage = t("savingSettings");
  state.settingsTone = "info";
  syncSwitchDom(`[data-action="toggle-boolean-setting"][data-setting="${settingName}"]`, nextValue);

  try {
    const [settings] = await Promise.all([
      launcher.updateSettings(buildSettingsUpdate({ [settingName]: nextValue })),
      wait(getAnimationDelay()),
    ]);
    applySettings(settings);
    state.settingsMessage = getBooleanSettingSuccessMessage(settingName);
    state.settingsTone = "success";
  } catch (error) {
    state.settings = previousSettings;
    syncSwitchDom(`[data-action="toggle-boolean-setting"][data-setting="${settingName}"]`, previousSettings[settingName]);
    state.settingsMessage = getErrorMessage(error, t("settingsSaveFailed"));
    state.settingsTone = "error";
  }

  render();
}

async function saveScreenshotPlugin(nextPlugin, successMessage = t("screenshotSettingSaved")) {
  const previousSettings = { ...state.settings, screenshotPlugin: state.settings.screenshotPlugin };
  const screenshotPlugin = normalizeScreenshotPlugin(nextPlugin);
  state.settings = { ...state.settings, screenshotPlugin };
  state.settingsMessage = t("savingSettings");
  state.settingsTone = "info";
  render();

  try {
    const settings = await launcher.updateSettings(buildSettingsUpdate({ screenshotPlugin }));
    applySettings(settings);
    state.screenshotResults = searchScreenshotCommand(state.query);
    updateCombinedResults();
    state.settingsMessage = successMessage;
    state.settingsTone = "success";
    if (state.query || state.searchMode === "all") {
      await performSearch(state.query);
      return;
    }
  } catch (error) {
    state.settings = previousSettings;
    state.settingsMessage = getErrorMessage(error, t("settingsSaveFailed"));
    state.settingsTone = "error";
  }

  render();
}

async function manageScreenshotPlugin(action) {
  const current = state.settings.screenshotPlugin;
  const nextPlugin = action === "install"
    ? { ...current, installed: true, enabled: true }
    : action === "uninstall"
      ? DEFAULT_SCREENSHOT_PLUGIN
      : action === "enable"
        ? { ...current, enabled: true }
        : action === "disable"
          ? { ...current, enabled: false }
          : current;
  const message = action === "install"
    ? t("pluginInstalled")
    : action === "uninstall"
      ? t("pluginUninstalled")
      : action === "enable"
        ? t("pluginEnabled")
        : t("pluginDisabled");
  await saveScreenshotPlugin(nextPlugin, message);
  if (nextPlugin.installed) {
    void loadPinnedImageHistory({ force: true });
  }
}

async function updateScreenshotPluginSetting(key, value) {
  if (!key) {
    return;
  }
  const normalizedValue = key === "pinHistoryLimit" ? normalizePinHistoryLimit(value) : value;
  await saveScreenshotPlugin({ ...state.settings.screenshotPlugin, [key]: normalizedValue });
  if (key === "pinHistoryLimit") {
    void loadPinnedImageHistory({ force: true });
  }
}

async function updateScreenshotToolShortcut(toolId, patch) {
  const tool = state.settings.screenshotPlugin.toolShortcuts?.[toolId];
  if (!tool) {
    return;
  }
  await saveScreenshotPlugin({
    ...state.settings.screenshotPlugin,
    toolShortcuts: {
      ...state.settings.screenshotPlugin.toolShortcuts,
      [toolId]: { ...tool, ...patch },
    },
  });
}

async function loadPinnedImageHistory({ force = false } = {}) {
  if (!force && (state.pinnedImageHistoryLoaded || state.pinnedImageHistoryLoading)) {
    return;
  }
  state.pinnedImageHistoryLoading = true;
  state.pinnedImageHistoryError = "";
  render();
  try {
    const history = typeof launcher.listPinnedImageHistory === "function"
      ? await launcher.listPinnedImageHistory()
      : [];
    state.pinnedImageHistory = Array.isArray(history) ? history : [];
    state.pinnedImageHistoryLoaded = true;
  } catch (error) {
    state.pinnedImageHistoryError = getErrorMessage(error, t("screenshotPinHistoryFailed"));
  } finally {
    state.pinnedImageHistoryLoading = false;
  }
  render();
}

async function importPinnedImageHistory() {
  state.pinnedImageHistoryLoading = true;
  state.pinnedImageHistoryError = "";
  render();
  try {
    const imported = typeof launcher.importPinnedImageHistory === "function"
      ? await launcher.importPinnedImageHistory()
      : null;
    if (imported) {
      state.pinnedImageHistory = [
        imported,
        ...state.pinnedImageHistory.filter((item) => item.id !== imported.id),
      ].slice(0, state.settings.screenshotPlugin.pinHistoryLimit);
      state.pinnedImageHistoryLoaded = true;
      state.settingsMessage = t("screenshotPinHistoryImported");
      state.settingsTone = "success";
    }
  } catch (error) {
    state.pinnedImageHistoryError = getErrorMessage(error, t("screenshotPinHistoryFailed"));
    state.settingsMessage = state.pinnedImageHistoryError;
    state.settingsTone = "error";
  } finally {
    state.pinnedImageHistoryLoading = false;
  }
  render();
}

async function deletePinnedImageHistory(pinId) {
  if (!pinId) {
    return;
  }
  state.pinnedImageHistory = state.pinnedImageHistory.filter((item) => item.id !== pinId);
  render();
  try {
    const history = typeof launcher.deletePinnedImageHistory === "function"
      ? await launcher.deletePinnedImageHistory(pinId)
      : state.pinnedImageHistory;
    state.pinnedImageHistory = Array.isArray(history) ? history : state.pinnedImageHistory;
    state.pinnedImageHistoryLoaded = true;
    state.settingsMessage = t("screenshotPinHistoryDeleted");
    state.settingsTone = "success";
  } catch (error) {
    state.pinnedImageHistoryError = getErrorMessage(error, t("screenshotPinHistoryFailed"));
    state.settingsMessage = state.pinnedImageHistoryError;
    state.settingsTone = "error";
    await loadPinnedImageHistory({ force: true });
    return;
  }
  render();
}

async function restorePinnedImage(pinId) {
  if (!pinId) {
    return;
  }
  try {
    if (typeof launcher.restorePinnedImage === "function") {
      await launcher.restorePinnedImage(pinId);
    }
    state.settingsMessage = t("screenshotPinHistoryRestored");
    state.settingsTone = "success";
  } catch (error) {
    state.settingsMessage = getErrorMessage(error, t("screenshotPinHistoryFailed"));
    state.settingsTone = "error";
  }
  render();
}

async function exportSettingsConfig() {
  state.settingsMessage = t("savingSettings");
  state.settingsTone = "info";
  render();

  try {
    const exported = await launcher.exportSettingsConfig();
    state.settingsMessage = exported ? t("settingsExported") : t("exportCancelled");
    state.settingsTone = exported ? "success" : "info";
  } catch (error) {
    state.settingsMessage = getErrorMessage(error, t("settingsSaveFailed"));
    state.settingsTone = "error";
  }

  render();
}

async function importSettingsConfig() {
  state.settingsMessage = t("savingSettings");
  state.settingsTone = "info";
  render();

  try {
    const importedSettings = await launcher.importSettingsConfig();
    if (!importedSettings) {
      state.settingsMessage = t("importCancelled");
      state.settingsTone = "info";
      render();
      return;
    }
    const settings = await launcher.updateSettings(buildSettingsUpdate(importedSettings));
    applySettings(settings);
    state.settingsMessage = t("settingsImported");
    state.settingsTone = "success";
    await performSearch(state.query);
  } catch (error) {
    state.settingsMessage = getErrorMessage(error, t("settingsSaveFailed"));
    state.settingsTone = "error";
  }

  render();
}

function setSettingsSection(section) {
  state.settingsSection = normalizeSettingsSection(section);
  cancelShortcutRecording({ renderAfter: false });
  render();
  if (state.settingsSection === "plugins" && state.settings.screenshotPlugin.installed) {
    void loadPinnedImageHistory();
  }
}

function toggleShortcutGroup(group) {
  if (!group) {
    return;
  }
  cancelShortcutRecording({ renderAfter: false });
  const isOpen = state.shortcutGroupsOpen[group] !== false;
  state.shortcutGroupsOpen = {
    ...state.shortcutGroupsOpen,
    [group]: !isOpen,
  };
  render();
}

function togglePermissionPathGroup(kind) {
  if (!Object.prototype.hasOwnProperty.call(state.permissionPathGroupsOpen, kind)) {
    return;
  }
  state.permissionPathGroupsOpen = {
    ...state.permissionPathGroupsOpen,
    [kind]: !state.permissionPathGroupsOpen[kind],
  };
  render();
}

function parsePathTextarea(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function saveSearchPaths(kind) {
  const textarea = document.querySelector(`[data-path-input="${kind}"]`);
  if (!textarea) {
    return;
  }

  const paths = parsePathTextarea(textarea.value);
  const overrides = kind === "apps" ? { appSearchPaths: paths } : { fileSearchPaths: paths };

  state.settingsMessage = t("savingSettings");
  state.settingsTone = "info";
  render();

  try {
    const settings = await launcher.updateSettings(buildSettingsUpdate(overrides));
    applySettings(settings);
    state.settingsMessage = t("pathsSaved");
    state.settingsTone =
      state.settings.invalidAppSearchPaths.length || state.settings.invalidFileSearchPaths.length ? "error" : "success";
    await performSearch(state.query);
  } catch (error) {
    state.settingsMessage = getErrorMessage(error, t("pathSaveFailed"));
    state.settingsTone = "error";
  }

  render();
}

function mergeSearchPaths(existingPaths, selectedPaths) {
  const seen = new Set();
  return [...existingPaths, ...selectedPaths]
    .map((path) => String(path || "").trim())
    .filter(Boolean)
    .filter((path) => {
      if (seen.has(path)) {
        return false;
      }
      seen.add(path);
      return true;
    });
}

async function authorizeSearchPaths(kind) {
  const currentPaths = kind === "apps" ? state.settings.appSearchPaths : state.settings.fileSearchPaths;
  state.settingsMessage = t("savingSettings");
  state.settingsTone = "info";
  render();

  try {
    const blockedPaths = await launcher.authorizeCurrentSearchPaths(currentPaths);
    const blockedPathList = Array.isArray(blockedPaths) ? blockedPaths : [];
    state.settings = {
      ...state.settings,
      invalidAppSearchPaths: kind === "apps" ? blockedPathList : state.settings.invalidAppSearchPaths,
      invalidFileSearchPaths: kind === "files" ? blockedPathList : state.settings.invalidFileSearchPaths,
    };
    state.settingsMessage = blockedPathList.length ? t("pathAuthorizationFailed") : t("pathAuthorized");
    state.settingsTone = blockedPathList.length ? "error" : "success";
  } catch (error) {
    state.settingsMessage = getErrorMessage(error, t("permissionSaveFailed"));
    state.settingsTone = "error";
  }

  render();
}

async function selectSearchPaths(kind) {
  const currentPaths = kind === "apps" ? state.settings.appSearchPaths : state.settings.fileSearchPaths;
  state.settingsMessage = t("savingSettings");
  state.settingsTone = "info";
  render();

  try {
    const selectedPaths = await launcher.selectSearchPaths(kind, currentPaths);
    if (!Array.isArray(selectedPaths) || selectedPaths.length === 0) {
      state.settingsMessage = t("pathAuthorizationCancelled");
      state.settingsTone = "info";
      render();
      return;
    }

    const paths = mergeSearchPaths(currentPaths, selectedPaths);
    const overrides = kind === "apps" ? { appSearchPaths: paths } : { fileSearchPaths: paths };
    const settings = await launcher.updateSettings(buildSettingsUpdate(overrides));
    applySettings(settings);
    state.settingsMessage = t("pathsSaved");
    state.settingsTone =
      state.settings.invalidAppSearchPaths.length || state.settings.invalidFileSearchPaths.length ? "error" : "success";
    await performSearch(state.query);
    const blockedPaths = await launcher.authorizeCurrentSearchPaths(paths);
    const blockedPathList = Array.isArray(blockedPaths) ? blockedPaths : [];
    state.settings = {
      ...state.settings,
      invalidAppSearchPaths: kind === "apps" ? blockedPathList : state.settings.invalidAppSearchPaths,
      invalidFileSearchPaths: kind === "files" ? blockedPathList : state.settings.invalidFileSearchPaths,
    };
    if (blockedPathList.length) {
      state.settingsMessage = t("pathAuthorizationFailed");
      state.settingsTone = "error";
    }
  } catch (error) {
    state.settingsMessage = getErrorMessage(error, t("pathSaveFailed"));
    state.settingsTone = "error";
  }

  render();
}

async function removeSearchPath(kind, path) {
  if (!kind || !path) {
    return;
  }

  const sourcePaths = kind === "apps" ? state.settings.appSearchPaths : state.settings.fileSearchPaths;
  const nextPaths = sourcePaths.filter((item) => item !== path);
  const overrides = kind === "apps" ? { appSearchPaths: nextPaths } : { fileSearchPaths: nextPaths };

  state.settingsMessage = t("savingSettings");
  state.settingsTone = "info";
  render();

  try {
    const settings = await launcher.updateSettings(buildSettingsUpdate(overrides));
    applySettings(settings);
    state.settingsMessage = t("pathsSaved");
    state.settingsTone =
      state.settings.invalidAppSearchPaths.length || state.settings.invalidFileSearchPaths.length ? "error" : "success";
    await performSearch(state.query);
  } catch (error) {
    state.settingsMessage = getErrorMessage(error, t("pathSaveFailed"));
    state.settingsTone = "error";
  }

  render();
}

function renderPathInvalidList(paths) {
  if (!paths.length) {
    return "";
  }
  return `
    <div class="path-invalid">
      <strong>${escapeHtml(t("invalidPaths"))}</strong>
      ${paths.map((path) => `<span>${escapeHtml(path)}</span>`).join("")}
    </div>
  `;
}

function renderSearchPathSettings() {
  const groups = [
    {
      kind: "apps",
      label: t("appSearchPaths"),
      paths: state.settings.appSearchPaths,
      invalidPaths: state.settings.invalidAppSearchPaths,
    },
    {
      kind: "files",
      label: t("fileSearchPaths"),
      paths: state.settings.fileSearchPaths,
      invalidPaths: state.settings.invalidFileSearchPaths,
    },
  ];

  return `
    <section class="path-settings">
      <div class="path-settings-header">
        <div>
          <h3>${escapeHtml(t("pathSettings"))}</h3>
          <p>${escapeHtml(t("pathSettingsHint"))}</p>
        </div>
      </div>
      <div class="path-settings-grid">
        ${groups
          .map(
            (group) => renderSearchPathPermission({
              title: group.label,
              description: "",
              kind: group.kind,
              paths: group.paths,
              invalidPaths: group.invalidPaths,
            }),
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderShortcutGuide({ wakePanelMarkup = "" } = {}) {
  const editableShortcutRows = (shortcuts) =>
    shortcuts
      .map((shortcut) => {
        const isRecording = state.shortcutRecording && state.shortcutRecordingTarget === shortcut.target;
        const isLocked = state.shortcutRecording && !isRecording;
        const value = isRecording ? state.shortcutDraft || t("recording") : shortcut.shortcut;
        const hasError = state.shortcutErrorTarget === shortcut.target || state.shortcutConflictTarget === shortcut.target;
        const errorMessage = state.shortcutErrorTarget === shortcut.target ? state.shortcutErrorMessage : "";
        return `
          <div class="shortcut-edit-row" data-conflict="${String(hasError)}">
            <span>${escapeHtml(shortcut.label)}</span>
            <span class="shortcut-edit-control">
              <button
                class="shortcut-recorder"
                type="button"
                data-action="record-shortcut"
                data-wake-target="${escapeHtml(shortcut.target)}"
                data-recording="${String(isRecording)}"
                data-conflict="${String(hasError)}"
                data-disabled="${String(isLocked)}"
                ${isLocked ? "disabled" : ""}
              >
                <span>${escapeHtml(formatShortcutWords(value))}</span>
                ${isRecording ? `<small>${escapeHtml(t("cancelRecording"))}</small>` : ""}
              </button>
              ${errorMessage ? `<small class="shortcut-row-error">${escapeHtml(errorMessage)}</small>` : ""}
            </span>
          </div>
        `;
      })
      .join("");
  const appShortcuts = appShortcutDefinitions();
  const screenshotGroups = [{
    id: "screenshot",
    title: t("screenshotPlugin"),
    content: editableShortcutRows(allEditableShortcutDefinitions().filter((shortcut) => shortcut.group === "screenshot")),
  }];
  const fixedRows = fixedShortcutDefinitions()
    .map(
      (shortcut) => `
        <div class="shortcut-guide-row">
          <span class="shortcut-guide-keys">
            ${shortcut.keys.map((key) => `<span class="key">${escapeHtml(key)}</span>`).join("")}
          </span>
          <span>${escapeHtml(shortcut.label)}</span>
        </div>
      `,
    )
    .join("");
  const groupMarkup = [
    { id: "wake", title: t("wakePanel"), content: wakePanelMarkup },
    { id: "search", title: t("searchShortcuts"), content: editableShortcutRows(appShortcuts.filter((shortcut) => shortcut.group === "search")) },
    { id: "actions", title: t("actionShortcuts"), content: editableShortcutRows(appShortcuts.filter((shortcut) => shortcut.group === "actions")) },
    ...screenshotGroups,
    { id: "fixed", title: t("fixedShortcuts"), content: `<div class="shortcut-guide-list">${fixedRows}</div>` },
  ]
    .map((group) => {
      const isOpen = state.shortcutGroupsOpen[group.id] !== false;
      return `
        <div class="shortcut-guide-group" data-open="${String(isOpen)}">
          <button
            class="shortcut-group-toggle"
            type="button"
            data-action="toggle-shortcut-group"
            data-shortcut-group="${escapeHtml(group.id)}"
            aria-expanded="${String(isOpen)}"
          >
            <span>${escapeHtml(group.title)}</span>
            <span aria-hidden="true">${isOpen ? "⌃" : "⌄"}</span>
          </button>
          ${isOpen ? `<div class="shortcut-edit-list">${group.content}</div>` : ""}
        </div>
      `;
    })
    .join("");

  return `
    <section class="shortcut-guide">
      <div>
        <h3>${escapeHtml(t("shortcutGuideTitle"))}</h3>
        <p>${escapeHtml(t("shortcutGuideDescription"))}</p>
      </div>
      ${groupMarkup}
    </section>
  `;
}

function renderSettingsSection(id, title, content) {
  return `
    <section class="settings-section" data-settings-section="${escapeHtml(id)}">
      <div class="settings-section-header">
        <h3>${escapeHtml(title)}</h3>
      </div>
      ${content}
    </section>
  `;
}

function renderToggleSetting({ title, description, active, action, setting }) {
  return `
    <button
      class="settings-toggle-row"
      type="button"
      role="switch"
      aria-checked="${String(active)}"
      data-active="${String(active)}"
      data-action="${escapeHtml(action)}"
      data-setting="${escapeHtml(setting || "")}"
    >
      <span class="settings-toggle-copy">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(description)}</span>
      </span>
      <span class="switch-indicator" aria-hidden="true"></span>
    </button>
  `;
}

function renderPermissionAction({ title, description, kind = "", action = "authorize-search-paths", buttonLabel = t("authorizePaths") }) {
  return `
    <div class="settings-permission-row">
      <span class="settings-toggle-copy">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(description)}</span>
      </span>
      <button
        class="path-save-button"
        type="button"
        data-action="${escapeHtml(action)}"
        data-path-kind="${escapeHtml(kind)}"
      >
        ${escapeHtml(buttonLabel)}
      </button>
    </div>
  `;
}

function renderPriorityShortcutPermission() {
  return `
    <div class="settings-toggle-row settings-toggle-row--with-action" data-active="${String(state.settings.preferGekeShortcuts)}">
      <span class="settings-toggle-copy">
        <strong>${escapeHtml(t("preferGekeShortcuts"))}</strong>
        <span>${escapeHtml(t("preferGekeShortcutsDescription"))}</span>
      </span>
      <span class="settings-toggle-controls">
        <button
          class="path-save-button"
          type="button"
          data-action="open-priority-permission-settings"
        >
          ${escapeHtml(t("openPermissionSettings"))}
        </button>
        <button
          class="settings-switch-button"
          type="button"
          role="switch"
          aria-checked="${String(state.settings.preferGekeShortcuts)}"
          data-active="${String(state.settings.preferGekeShortcuts)}"
          data-action="toggle-prefer-geke-shortcuts"
        >
          <span class="switch-indicator" aria-hidden="true"></span>
        </button>
      </span>
    </div>
  `;
}

function renderSearchPathPermission({ title, description, kind, paths, invalidPaths = [] }) {
  const invalidSet = new Set(invalidPaths);
  const isOpen = state.permissionPathGroupsOpen[kind] === true;
  const canCollapse = paths.length > PATH_PERMISSION_COLLAPSED_LIMIT;
  const visiblePaths = canCollapse && !isOpen ? paths.slice(0, PATH_PERMISSION_COLLAPSED_LIMIT) : paths;
  const pathRows = visiblePaths.length
    ? visiblePaths
      .map((path) => {
        const invalid = invalidSet.has(path);
        return `
          <div class="permission-path-row" data-invalid="${String(invalid)}">
            <span title="${escapeHtml(path)}">${escapeHtml(path)}</span>
            <button
              class="permission-path-remove"
              type="button"
              data-action="remove-search-path"
              data-path-kind="${escapeHtml(kind)}"
              data-path-value="${escapeHtml(path)}"
              aria-label="${escapeHtml(t("removePath"))}"
            >
              ${escapeHtml(t("removePath"))}
            </button>
          </div>
        `;
      })
      .join("")
    : `<div class="permission-path-empty">${escapeHtml(t("pathAuthorizationCancelled"))}</div>`;
  const collapseButton = canCollapse
    ? `
      <button
        class="permission-path-toggle"
        type="button"
        data-action="toggle-permission-path-group"
        data-path-kind="${escapeHtml(kind)}"
        aria-expanded="${String(isOpen)}"
      >
        <span>${escapeHtml(isOpen ? t("collapsePaths") : t("expandPaths", paths.length))}</span>
        <span aria-hidden="true">${isOpen ? "⌃" : "⌄"}</span>
      </button>
    `
    : "";

  return `
    <div class="settings-permission-row settings-permission-row--paths" data-permission-path-kind="${escapeHtml(kind)}">
      <div class="settings-permission-top">
        <span class="settings-toggle-copy">
          <strong>${escapeHtml(title)}</strong>
          ${description ? `<span>${escapeHtml(description)}</span>` : ""}
        </span>
        <span class="settings-permission-actions">
          <button
            class="path-save-button"
            type="button"
            data-action="authorize-search-paths"
            data-path-kind="${escapeHtml(kind)}"
          >
            ${escapeHtml(t("authorizePaths"))}
          </button>
          <button
            class="path-save-button"
            type="button"
            data-action="select-search-paths"
            data-path-kind="${escapeHtml(kind)}"
          >
            ${escapeHtml(t("selectPaths"))}
          </button>
        </span>
      </div>
      <div class="permission-path-list">
        ${pathRows}
      </div>
      ${collapseButton}
    </div>
  `;
}

function renderWakePanelSettings({ statusTone, statusText, message, draftShortcut }) {
  const wakeCards = [
    {
      icon: "⌨",
      title: t("multiWake"),
      value: state.shortcutRecording && state.shortcutRecordingTarget === "multi" ? draftShortcut || t("recording") : draftShortcut,
      active: state.settings.multiWakeEnabled,
      target: "multi",
    },
    {
      icon: "⌥",
      title: t("doubleWake"),
      value: state.shortcutRecording && state.shortcutRecordingTarget === "double"
        ? draftShortcut || t("recording")
        : state.settings.doubleWakeEnabled
          ? formatShortcutWords(state.settings.doubleWakeModifier)
          : t("disabled"),
      active: state.settings.doubleWakeEnabled,
      target: "double",
    },
    {
      icon: "⏱",
      title: t("longPressWake"),
      value: state.shortcutRecording && state.shortcutRecordingTarget === "long"
        ? draftShortcut || t("recording")
        : state.settings.longPressWakeEnabled
          ? formatShortcutWords(state.settings.longPressWakeModifier)
          : t("disabled"),
      active: state.settings.longPressWakeEnabled,
      target: "long",
    },
  ];
  const wakeCardsMarkup = wakeCards
    .map((card) => {
      const isRecording = state.shortcutRecording && state.shortcutRecordingTarget === card.target;
      const isLocked = state.shortcutRecording && !isRecording;
      const hasError = state.shortcutErrorTarget === card.target || state.shortcutConflictTarget === card.target;
      const errorMessage = state.shortcutErrorTarget === card.target ? state.shortcutErrorMessage : "";
      return `
        <div
          class="wake-card"
          data-active="${String(card.active)}"
          data-wake-target="${escapeHtml(card.target)}"
          data-recording="${String(isRecording)}"
          data-conflict="${String(hasError)}"
        >
          <div class="wake-card-top">
            <span class="wake-icon">${escapeHtml(card.icon)}</span>
            <button
              class="wake-state-button"
              type="button"
              data-action="toggle-wake"
              data-wake-target="${escapeHtml(card.target)}"
              data-active="${String(card.active)}"
              aria-label="${escapeHtml(card.active ? t("disableWake") : t("enableWake"))}"
              ${state.shortcutRecording ? "disabled" : ""}
            >
              ${escapeHtml(card.active ? t("enabled") : t("disabled"))}
            </button>
          </div>
          <span class="wake-title">${escapeHtml(card.title)}</span>
          <button
            class="shortcut-recorder wake-value"
            type="button"
            data-action="record-shortcut"
            data-wake-target="${escapeHtml(card.target)}"
            data-recording="${String(isRecording)}"
            data-conflict="${String(hasError)}"
            data-disabled="${String(isLocked)}"
            ${isLocked ? "disabled" : ""}
          >
            <span>${escapeHtml(card.value)}</span>
            <small>${escapeHtml(isRecording ? t("cancelRecording") : t("editWake"))}</small>
          </button>
          ${errorMessage ? `<small class="shortcut-row-error">${escapeHtml(errorMessage)}</small>` : ""}
        </div>
      `;
    })
    .join("");

  return `
    <section class="wake-panel-settings">
      <div class="wake-panel-header">
        <button class="wake-reset-button" type="button" data-action="reset-shortcut">${escapeHtml(t("resetDefaults"))}</button>
      </div>

      <p class="wake-description">${escapeHtml(t("wakeEntriesDescription"))}</p>
      <div class="wake-card-grid">${wakeCardsMarkup}</div>
      <div class="settings-status" data-tone="${escapeHtml(statusTone)}">${escapeHtml(statusText)}</div>
      <div class="settings-message" data-tone="${escapeHtml(state.settingsTone)}">${escapeHtml(message)}</div>
    </section>
  `;
}

function renderScreenshotPluginManager() {
  const plugin = state.settings.screenshotPlugin;
  const screenshotIcon = `
    <span class="plugin-icon plugin-icon--screenshot" aria-hidden="true">
      <i></i><b></b><em></em>
    </span>
  `;
  if (!plugin.installed) {
    return `
      <div class="screenshot-config">
        <article class="plugin-card" data-plugin-id="screenshot" data-installed="false">
          <div class="plugin-card-header">
            ${screenshotIcon}
            <span class="plugin-card-copy">
              <strong>${escapeHtml(t("screenshotPlugin"))}</strong>
              <span>${escapeHtml(t("screenshotPluginDescription"))}</span>
            </span>
            <span class="plugin-status">${escapeHtml(t("pluginNotDownloaded"))}</span>
          </div>
          <div class="plugin-card-actions">
        <button class="path-save-button" type="button" data-action="manage-screenshot-plugin" data-plugin-id="screenshot" data-plugin-action="install">
              ${escapeHtml(t("pluginDownload"))}
            </button>
          </div>
        </article>
      </div>
    `;
  }

  const renderConfigSection = (title, description, content) => `
    <section class="screenshot-config-section">
      <div class="screenshot-section-header">
        <strong>${escapeHtml(title)}</strong>
        ${description ? `<span>${escapeHtml(description)}</span>` : ""}
      </div>
      ${content}
    </section>
  `;
  const renderSwitch = (key, title, description) => `
    <button
      class="settings-toggle-row screenshot-toggle-row"
      type="button"
      role="switch"
      aria-checked="${String(Boolean(plugin[key]))}"
      data-active="${String(Boolean(plugin[key]))}"
      data-action="toggle-screenshot-setting"
      data-screenshot-setting="${escapeHtml(key)}"
    >
      <span class="settings-toggle-copy">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(description)}</span>
      </span>
      <span class="switch-indicator" aria-hidden="true"></span>
    </button>
  `;
  const shortcutRows = SCREENSHOT_ACTIONS.map((item) => {
    const shortcut = plugin.toolShortcuts?.[item.id] || DEFAULT_SCREENSHOT_PLUGIN.toolShortcuts[item.id];
    return `
      <div class="screenshot-shortcut-row">
        <span class="screenshot-shortcut-name">
          <span aria-hidden="true">${escapeHtml(item.icon)}</span>
          ${escapeHtml(t(item.labelKey))}
        </span>
        <input
          class="screenshot-key-input"
          type="text"
          value="${escapeHtml(formatShortcutWords(shortcut.shortcut))}"
          data-screenshot-tool-shortcut="${escapeHtml(item.id)}"
        />
        <button
          class="settings-switch-button"
          type="button"
          role="switch"
          aria-checked="${String(Boolean(shortcut.enabled))}"
          data-active="${String(Boolean(shortcut.enabled))}"
          data-action="toggle-screenshot-tool"
          data-tool-id="${escapeHtml(item.id)}"
        >
          <span class="switch-indicator" aria-hidden="true"></span>
        </button>
      </div>
    `;
  }).join("");
  const saveChoices = [
    { value: "ask", labelKey: "screenshotSaveAsk" },
    { value: "defaultFolder", labelKey: "screenshotSaveDefault" },
    { value: "manual", labelKey: "screenshotSaveManual" },
  ].map((option) => `
    <button
      class="screenshot-choice"
      type="button"
      data-active="${String(plugin.saveBehavior === option.value)}"
      data-action="set-screenshot-setting"
      data-screenshot-setting="saveBehavior"
      data-value="${escapeHtml(option.value)}"
    >
      ${escapeHtml(t(option.labelKey))}
    </button>
  `).join("");
  const pinChoices = [
    { value: "mouse", labelKey: "screenshotPinMouse" },
    { value: "topRight", labelKey: "screenshotPinTopRight" },
  ].map((option) => `
    <button
      class="screenshot-choice"
      type="button"
      data-active="${String(plugin.pinPosition === option.value)}"
      data-action="set-screenshot-setting"
      data-screenshot-setting="pinPosition"
      data-value="${escapeHtml(option.value)}"
    >
      ${escapeHtml(t(option.labelKey))}
    </button>
  `).join("");
  const historyRows = state.pinnedImageHistory.map((item) => `
    <article class="pin-history-card" data-pin-id="${escapeHtml(item.id)}">
      <button class="pin-history-preview" type="button" data-action="restore-pinned-image" data-pin-id="${escapeHtml(item.id)}" title="${escapeHtml(t("screenshotPinHistoryRestore"))}">
        <img src="${escapeHtml(item.imageDataUrl || "")}" alt="" loading="lazy" />
      </button>
      <div class="pin-history-meta">
        <strong>${escapeHtml(`${item.width || 0} x ${item.height || 0}`)}</strong>
        <span>${escapeHtml(formatDateTime(item.createdAt) || item.path || "")}</span>
      </div>
      <div class="pin-history-actions">
        <button class="pin-history-button" type="button" data-action="restore-pinned-image" data-pin-id="${escapeHtml(item.id)}">
          ${escapeHtml(t("screenshotPinHistoryRestore"))}
        </button>
        <button class="pin-history-button pin-history-button--danger" type="button" data-action="delete-pinned-image" data-pin-id="${escapeHtml(item.id)}">
          ${escapeHtml(t("screenshotPinHistoryDelete"))}
        </button>
      </div>
    </article>
  `).join("");
  const historyContent = `
    <div class="pin-history-toolbar">
      <label class="plugin-setting-row plugin-setting-row--compact">
        <span>
          ${escapeHtml(t("screenshotPinHistoryLimit"))}
          <small>${escapeHtml(t("screenshotPinHistoryLimitHint"))}</small>
        </span>
        <input
          class="plugin-setting-input plugin-setting-input--number"
          type="number"
          min="1"
          max="200"
          step="1"
          value="${escapeHtml(plugin.pinHistoryLimit)}"
          data-screenshot-input="pinHistoryLimit"
        />
      </label>
      <button class="path-save-button" type="button" data-action="import-pinned-image">
        ${escapeHtml(t("screenshotPinHistoryImport"))}
      </button>
    </div>
    ${state.pinnedImageHistoryLoading ? `<div class="pin-history-empty">${escapeHtml(t("screenshotPinHistoryLoading"))}</div>` : ""}
    ${state.pinnedImageHistoryError ? `<div class="pin-history-error">${escapeHtml(state.pinnedImageHistoryError)}</div>` : ""}
    ${!state.pinnedImageHistoryLoading && !state.pinnedImageHistory.length ? `<div class="pin-history-empty">${escapeHtml(t("screenshotPinHistoryEmpty"))}</div>` : ""}
    ${historyRows ? `<div class="pin-history-grid">${historyRows}</div>` : ""}
  `;

  return `
    <div class="screenshot-config" data-enabled="${String(plugin.enabled)}">
      <article class="plugin-card" data-plugin-id="screenshot" data-installed="true" data-enabled="${String(plugin.enabled)}">
        <div class="plugin-card-header">
          ${screenshotIcon}
          <span class="plugin-card-copy">
            <strong>${escapeHtml(t("screenshotPlugin"))}</strong>
            <span>${escapeHtml(t("screenshotPluginDescription"))}</span>
          </span>
          <span class="plugin-status">${escapeHtml(plugin.enabled ? t("enabled") : t("disabled"))}</span>
        </div>
        <div class="plugin-card-actions">
          <button class="path-save-button" type="button" data-action="manage-screenshot-plugin" data-plugin-id="screenshot" data-plugin-action="${escapeHtml(plugin.enabled ? "disable" : "enable")}">
            ${escapeHtml(plugin.enabled ? t("pluginDisable") : t("pluginEnable"))}
          </button>
          <button class="path-save-button" type="button" data-action="manage-screenshot-plugin" data-plugin-id="screenshot" data-plugin-action="uninstall">
            ${escapeHtml(t("pluginUninstall"))}
          </button>
        </div>
      </article>

      ${renderConfigSection(t("screenshotShortcutSection"), t("screenshotShortcutDescription"), `<div class="screenshot-shortcut-list">${shortcutRows}</div>`)}
      ${renderConfigSection(t("screenshotSaveSection"), "", `
        <label class="plugin-setting-row">
          <span>${escapeHtml(t("screenshotFileNameFormat"))}</span>
          <input class="plugin-setting-input" type="text" value="${escapeHtml(plugin.fileNameFormat)}" data-screenshot-input="fileNameFormat" />
        </label>
        <label class="plugin-setting-row">
          <span>${escapeHtml(t("screenshotWatermarkText"))}</span>
          <input class="plugin-setting-input" type="text" value="${escapeHtml(plugin.watermarkText)}" data-screenshot-input="watermarkText" />
        </label>
        <label class="plugin-setting-row">
          <span>${escapeHtml(t("screenshotSaveLocation"))}</span>
          <input class="plugin-setting-input" type="text" value="${escapeHtml(plugin.saveLocation)}" data-screenshot-input="saveLocation" />
        </label>
        <div class="screenshot-choice-row">${saveChoices}</div>
        ${renderSwitch("autoOpenFolder", t("screenshotAutoOpenFolder"), t("screenshotAutoOpenFolderDescription"))}
        ${renderSwitch("autoCopyPath", t("screenshotAutoCopyPath"), t("screenshotAutoCopyPathDescription"))}
      `)}
      ${renderConfigSection(t("screenshotCompletionPreview"), "", renderSwitch("completionPreview", t("screenshotShowPreview"), t("screenshotShowPreviewDescription")))}
      ${renderConfigSection(t("screenshotAutoPaste"), "", renderSwitch("autoPasteAfterCapture", t("screenshotAutoPasteAfterCapture"), t("screenshotAutoPasteAfterCaptureDescription")))}
      ${renderConfigSection(t("screenshotDoubleClick"), "", renderSwitch("doubleClickFinish", t("screenshotDoubleClickFinish"), t("screenshotDoubleClickFinishDescription")))}
      ${renderConfigSection(t("screenshotCloseConfirm"), "", renderSwitch("confirmBeforeClose", t("screenshotConfirmBeforeClose"), t("screenshotConfirmBeforeCloseDescription")))}
      ${renderConfigSection(t("screenshotAdvanced"), "", renderSwitch("autoFocusRecentArea", t("screenshotAutoFocusRecentArea"), t("screenshotAutoFocusRecentAreaDescription")))}
      ${renderConfigSection(t("screenshotEffects"), "", `
        ${renderSwitch("roundedCorners", t("screenshotRoundedCorners"), t("screenshotRoundedCornersDescription"))}
        ${renderSwitch("shadow", t("screenshotShadow"), t("screenshotShadowDescription"))}
      `)}
      ${renderConfigSection(t("screenshotPinPosition"), "", `<div class="screenshot-choice-row screenshot-choice-row--two">${pinChoices}</div>`)}
      ${renderConfigSection(t("screenshotPinHistory"), t("screenshotPinHistoryDescription"), historyContent)}
      ${renderConfigSection(t("screenshotGuideLines"), "", renderSwitch("guides", t("screenshotShowGuides"), t("screenshotShowGuidesDescription")))}
    </div>
  `;
}

function renderSettingsPanel() {
  if (!state.settingsOpen) {
    return "";
  }

  const currentShortcut = formatShortcutWords(state.settings.toggleShortcut);
  const draftShortcut = formatShortcutWords(state.shortcutDraft);
  const statusTone = !state.settings.multiWakeEnabled ? "info" : state.settings.shortcutStatus.registered ? "success" : "error";
  const statusText = state.settings.shortcutStatus.registered
    ? t("activeShortcut", currentShortcut)
    : state.settings.shortcutStatus.message || t("shortcutInactive");
  const message = state.shortcutRecording
    ? t("pressNewShortcut")
    : state.settingsMessage || t("settingsHint");
  const languageButtons = LANGUAGE_OPTIONS.map(
    (option) => `
      <button
        class="segmented-option"
        type="button"
        data-action="set-language"
        data-language="${escapeHtml(option.value)}"
        data-active="${String(option.value === state.settings.language)}"
      >
        ${escapeHtml(option.label)}
      </button>
    `,
  ).join("");
  const appearanceButtons = APPEARANCE_OPTIONS.map(
    (option) => `
      <button
        class="segmented-option"
        type="button"
        data-action="set-appearance"
        data-appearance="${escapeHtml(option.value)}"
        data-active="${String(option.value === state.settings.appearanceMode)}"
      >
        ${escapeHtml(t(option.labelKey))}
      </button>
    `,
  ).join("");
  const animationButtons = ANIMATION_OPTIONS.map(
    (option) => `
      <button
        class="segmented-option"
        type="button"
        data-action="set-animation"
        data-animation="${escapeHtml(option.value)}"
        data-active="${String(option.value === state.settings.animationMode)}"
      >
        ${escapeHtml(t(option.labelKey))}
      </button>
    `,
  ).join("");
  const sectionButtons = SETTINGS_SECTIONS.map(
    (section) => `
      <button
        class="settings-nav-button"
        type="button"
        data-action="set-settings-section"
        data-settings-section-target="${escapeHtml(section.id)}"
        data-active="${String(section.id === state.settingsSection)}"
      >
        ${escapeHtml(t(section.labelKey))}
      </button>
    `,
  ).join("");
  const basicSection = renderSettingsSection(
    "basic",
    t("basicSettings"),
    `
      <div class="settings-row">
        <span class="settings-label">${escapeHtml(t("language"))}</span>
        <div class="segmented-control" role="group" aria-label="${escapeHtml(t("language"))}">
          ${languageButtons}
        </div>
      </div>
    `,
  );
  const appearanceSection = renderSettingsSection(
    "appearance",
    t("appearance"),
    `
      <div class="settings-row">
        <span class="settings-label">${escapeHtml(t("appearance"))}</span>
        <div class="segmented-control segmented-control--three" role="group" aria-label="${escapeHtml(t("appearance"))}">
          ${appearanceButtons}
        </div>
      </div>
    `,
  );
  const animationSection = renderSettingsSection(
    "animation",
    t("animation"),
    `
      <div class="settings-row settings-row--stack">
        <span class="settings-description">${escapeHtml(t("animationDescription"))}</span>
        <div class="segmented-control segmented-control--four" role="group" aria-label="${escapeHtml(t("animation"))}">
          ${animationButtons}
        </div>
      </div>
    `,
  );
  const soundSection = renderSettingsSection(
    "sound",
    t("operationSound"),
    renderToggleSetting({
      title: t("operationSound"),
      description: t("soundEnabledDescription"),
      active: state.settings.operationSoundEnabled,
      action: "toggle-boolean-setting",
      setting: "operationSoundEnabled",
    }),
  );
  const importExportSection = renderSettingsSection(
    "import-export",
    t("importExport"),
    `
      <div class="settings-actions">
        <button class="action-button" type="button" data-action="export-settings">${escapeHtml(t("exportSettings"))}</button>
        <button class="action-button action-button--primary" type="button" data-action="import-settings">${escapeHtml(t("importSettings"))}</button>
      </div>
    `,
  );
  const trayIconSection = renderSettingsSection(
    "tray-icon",
    t("menuIcon"),
    renderToggleSetting({
      title: t("showMenuIcon"),
      description: t("showMenuIconDescription"),
      active: state.settings.menuIconVisible,
      action: "toggle-boolean-setting",
      setting: "menuIconVisible",
    }),
  );
  const permissionsSection = renderSettingsSection(
    "permissions",
    t("permissions"),
    `
      ${renderPriorityShortcutPermission()}
      ${renderPermissionAction({
        title: t("screenRecordingPermission"),
        description: t("screenRecordingPermissionDescription"),
        action: "open-screen-recording-permission-settings",
        buttonLabel: t("openPermissionSettings"),
      })}
      ${renderSearchPathPermission({
        title: t("appPathPermission"),
        description: t("appPathPermissionDescription"),
        kind: "apps",
        paths: state.settings.appSearchPaths,
        invalidPaths: state.settings.invalidAppSearchPaths,
      })}
      ${renderSearchPathPermission({
        title: t("filePathPermission"),
        description: t("filePathPermissionDescription"),
        kind: "files",
        paths: state.settings.fileSearchPaths,
        invalidPaths: state.settings.invalidFileSearchPaths,
      })}
    `,
  );
  const autostartSection = renderSettingsSection(
    "autostart",
    t("launchAtLogin"),
    renderToggleSetting({
      title: t("launchAtLogin"),
      description: t("launchAtLoginDescription"),
      active: state.settings.launchAtLogin,
      action: "toggle-boolean-setting",
      setting: "launchAtLogin",
    }),
  );
  const shortcutSection = renderSettingsSection(
    "shortcuts",
    t("shortcutGuideTitle"),
    renderShortcutGuide({
      wakePanelMarkup: renderWakePanelSettings({ statusTone, statusText, message, draftShortcut }),
    }),
  );
  const pluginsSection = renderSettingsSection(
    "plugins",
    t("morePlugins"),
    renderScreenshotPluginManager(),
  );
  const sectionMarkupById = {
    basic: basicSection,
    paths: renderSettingsSection("paths", t("pathSettings"), renderSearchPathSettings()),
    sound: soundSection,
    "import-export": importExportSection,
    appearance: appearanceSection,
    animation: animationSection,
    "tray-icon": trayIconSection,
    permissions: permissionsSection,
    autostart: autostartSection,
    shortcuts: shortcutSection,
    plugins: pluginsSection,
  };
  const activeSectionMarkup = sectionMarkupById[state.settingsSection] || basicSection;

  return `
    <div class="settings-backdrop" data-action="close-settings">
      <section class="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="settings-header">
          <h2 id="settings-title">${escapeHtml(t("settings"))}</h2>
          <button class="icon-button" type="button" data-action="close-settings" aria-label="${escapeHtml(t("closeSettings"))}">×</button>
        </div>

        <div class="settings-nav" role="tablist" aria-label="${escapeHtml(t("settings"))}">
          ${sectionButtons}
        </div>

        ${activeSectionMarkup}
        <div class="settings-message" data-tone="${escapeHtml(state.settingsTone)}">${escapeHtml(state.settingsMessage || "")}</div>
      </section>
    </div>
  `;
}

function renderResults() {
  const launchErrorMarkup = state.launchError
    ? `<div class="result-error" data-tone="error">${escapeHtml(state.launchError)}</div>`
    : "";

  if (state.status === "error" && !state.results.length) {
    return `
      ${launchErrorMarkup}
      <div class="state-card">
        <div>
          <h2>${escapeHtml(t("loadErrorTitle"))}</h2>
          <p>${escapeHtml(state.statusText)}</p>
          <div class="state-actions">
            <button class="action-button" type="button" data-action="retry">${escapeHtml(t("retryScan"))}</button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.status === "loading" && !state.results.length) {
    return `
      ${launchErrorMarkup}
      <div class="state-card">
        <div>
          <h2>${escapeHtml(t("scanningTitle"))}</h2>
          <p>${escapeHtml(t("scanningDescription"))}</p>
        </div>
      </div>
    `;
  }

  if (!state.results.length) {
    return `
      ${launchErrorMarkup}
      <div class="state-card">
        <div>
          <h2>${escapeHtml(t("noMatchesTitle"))}</h2>
          <p>${escapeHtml(t("noMatchesDescription"))}</p>
          <div class="state-actions">
            <button class="action-button" type="button" data-action="clear">${escapeHtml(t("clearSearch"))}</button>
          </div>
        </div>
      </div>
    `;
  }

  return launchErrorMarkup + state.results
    .map(
      (item, index) => `
        <button
          class="result-row"
          type="button"
          data-result-index="${index}"
          data-active="${String(index === state.selectedIndex)}"
        >
          ${renderResultIcon(item)}
          <span class="result-copy">
            <span class="result-name">${escapeHtml(item.name)}</span>
            <span class="result-path">${escapeHtml(item.path)}</span>
          </span>
          <span class="result-shortcut">${escapeHtml(item.type === "screenshot" && item.shortcut ? formatShortcut(item.shortcut) : t("enterKey"))}</span>
        </button>
      `,
    )
    .join("");
}

function renderShell() {
  appElement.innerHTML = `
    <main class="shell">
      <section class="panel" aria-live="polite">
        <label class="search">
          <span class="search-icon" aria-hidden="true">⌘</span>
          <input
            class="search-input"
            type="text"
            placeholder="${escapeHtml(getSearchPlaceholder())}"
            autocomplete="off"
            spellcheck="false"
            autofocus
          />
        </label>

        <div class="results"></div>
      </section>
      <div class="settings-layer"></div>
    </main>
  `;

  ui = {
    searchInput: document.querySelector(".search-input"),
    results: document.querySelector(".results"),
    settingsLayer: document.querySelector(".settings-layer"),
  };

  bindRenderedEvents();
  focusInput({ cursorToEnd: true });
}

function syncInputValue({ force = false } = {}) {
  if (!ui?.searchInput || ui.searchInput.value === state.query) {
    return;
  }

  const inputIsActive = document.activeElement === ui.searchInput;
  if (force || (!inputIsActive && !isComposing)) {
    ui.searchInput.value = state.query;
  }
}

function render() {
  if (!ui) {
    renderShell();
  }

  syncInputValue();

  if (ui.searchInput) {
    ui.searchInput.placeholder = getSearchPlaceholder();
  }

  if (ui.results) {
    ui.results.innerHTML = renderResults();
  }

  if (ui.settingsLayer) {
    const settingsPanel = ui.settingsLayer.querySelector(".settings-panel");
    const settingsScrollTop = state.settingsOpen ? settingsPanel?.scrollTop ?? 0 : 0;
    ui.settingsLayer.innerHTML = renderSettingsPanel();
    if (state.settingsOpen && settingsScrollTop > 0) {
      requestAnimationFrame(() => {
        const nextSettingsPanel = ui.settingsLayer?.querySelector(".settings-panel");
        if (nextSettingsPanel) {
          nextSettingsPanel.scrollTop = settingsScrollTop;
        }
      });
    }
  }

  scheduleSettingsMessageDismiss();
  requestAnimationFrame(() => updateActiveResult());
}

function bindRenderedEvents() {
  ui?.searchInput?.addEventListener("input", onInput);
  ui?.searchInput?.addEventListener("compositionstart", onCompositionStart);
  ui?.searchInput?.addEventListener("compositionend", onCompositionEnd);

  appElement.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;

    if (action === "retry" || action === "rescan") {
      void rescanApplications();
      return;
    }

    if (action === "open-settings") {
      openSettings();
      return;
    }

    if (action === "close-settings") {
      if (event.target.closest(".settings-panel") && !event.target.closest(".icon-button")) {
        return;
      }

      closeSettings();
      return;
    }

    if (action === "record-shortcut") {
      startShortcutRecording(event.target.closest("[data-wake-target]")?.dataset.wakeTarget || "multi");
      return;
    }

    if (action === "toggle-wake") {
      void saveWakeSettings({ target: event.target.closest("[data-wake-target]")?.dataset.wakeTarget });
      return;
    }

    if (action === "toggle-prefer-geke-shortcuts") {
      void togglePreferGekeShortcuts();
      return;
    }

    if (action === "reset-shortcut") {
      void resetShortcutDefaults();
      return;
    }

    if (action === "set-language") {
      void setLanguage(event.target.closest("[data-language]")?.dataset.language);
      return;
    }

    if (action === "set-appearance") {
      void setAppearanceMode(event.target.closest("[data-appearance]")?.dataset.appearance);
      return;
    }

    if (action === "set-animation") {
      void setAnimationMode(event.target.closest("[data-animation]")?.dataset.animation);
      return;
    }

    if (action === "set-settings-section") {
      setSettingsSection(event.target.closest("[data-settings-section-target]")?.dataset.settingsSectionTarget);
      return;
    }

    if (action === "toggle-shortcut-group") {
      toggleShortcutGroup(event.target.closest("[data-shortcut-group]")?.dataset.shortcutGroup);
      return;
    }

    if (action === "toggle-permission-path-group") {
      togglePermissionPathGroup(event.target.closest("[data-path-kind]")?.dataset.pathKind);
      return;
    }

    if (action === "toggle-boolean-setting") {
      void toggleBooleanSetting(event.target.closest("[data-setting]")?.dataset.setting);
      return;
    }

    if (action === "manage-screenshot-plugin") {
      void manageScreenshotPlugin(event.target.closest("[data-plugin-action]")?.dataset.pluginAction);
      return;
    }

    if (action === "set-screenshot-setting") {
      const target = event.target.closest("[data-screenshot-setting][data-value]");
      void updateScreenshotPluginSetting(target?.dataset.screenshotSetting, target?.dataset.value);
      return;
    }

    if (action === "toggle-screenshot-setting") {
      const key = event.target.closest("[data-screenshot-setting]")?.dataset.screenshotSetting;
      void updateScreenshotPluginSetting(key, !state.settings.screenshotPlugin[key]);
      return;
    }

    if (action === "toggle-screenshot-tool") {
      const toolId = event.target.closest("[data-tool-id]")?.dataset.toolId;
      const current = state.settings.screenshotPlugin.toolShortcuts?.[toolId];
      void updateScreenshotToolShortcut(toolId, { enabled: !current?.enabled });
      return;
    }

    if (action === "import-pinned-image") {
      void importPinnedImageHistory();
      return;
    }

    if (action === "delete-pinned-image") {
      void deletePinnedImageHistory(event.target.closest("[data-pin-id]")?.dataset.pinId);
      return;
    }

    if (action === "restore-pinned-image") {
      void restorePinnedImage(event.target.closest("[data-pin-id]")?.dataset.pinId);
      return;
    }

    if (action === "export-settings") {
      void exportSettingsConfig();
      return;
    }

    if (action === "import-settings") {
      void importSettingsConfig();
      return;
    }

    if (action === "save-search-paths") {
      void saveSearchPaths(event.target.closest("[data-path-kind]")?.dataset.pathKind);
      return;
    }

    if (action === "authorize-search-paths") {
      void authorizeSearchPaths(event.target.closest("[data-path-kind]")?.dataset.pathKind);
      return;
    }

    if (action === "select-search-paths") {
      void selectSearchPaths(event.target.closest("[data-path-kind]")?.dataset.pathKind);
      return;
    }

    if (action === "remove-search-path") {
      const target = event.target.closest("[data-path-kind][data-path-value]");
      void removeSearchPath(target?.dataset.pathKind, target?.dataset.pathValue);
      return;
    }

    if (action === "open-priority-permission-settings") {
      void openPriorityPermissionSettings();
      return;
    }

    if (action === "open-screen-recording-permission-settings") {
      void openScreenRecordingPermissionSettings();
      return;
    }

    if (action === "save-shortcut") {
      void saveShortcut();
      return;
    }

    if (action === "clear") {
      state.query = "";
      state.selectedIndex = 0;
      syncInputValue({ force: true });
      void performSearch("");
      return;
    }

    const row = event.target.closest(".result-row");
    if (!row) {
      return;
    }

    const index = Number(row.dataset.resultIndex);
    if (Number.isNaN(index)) {
      return;
    }

    void onResultClick(index);
  });

  appElement.addEventListener("change", (event) => {
    const settingsInput = event.target.closest("[data-screenshot-input]");
    if (settingsInput) {
      void updateScreenshotPluginSetting(settingsInput.dataset.screenshotInput, settingsInput.value);
      return;
    }
    const shortcutInput = event.target.closest("[data-screenshot-tool-shortcut]");
    if (shortcutInput) {
      const shortcut = normalizeShortcutValue(shortcutInput.value.replaceAll(" + ", "+").replaceAll("Option", "Alt").replaceAll("Command", "CmdOrCtrl"));
      void updateScreenshotToolShortcut(shortcutInput.dataset.screenshotToolShortcut, { shortcut: shortcut || shortcutInput.value });
    }
  });

  ui?.results?.addEventListener("pointermove", (event) => {
    const pointerPosition = `${event.clientX}:${event.clientY}`;
    if (lastPointerPosition === pointerPosition) {
      return;
    }
    lastPointerPosition = pointerPosition;

    const row = event.target.closest(".result-row");
    if (!row) {
      return;
    }

    const index = Number(row.dataset.resultIndex);
    if (!Number.isNaN(index)) {
      onResultHover(index);
    }
  });
}
