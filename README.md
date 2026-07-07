# 极刻 GEKE

极刻 GEKE 是一个 Raycast 风格的 macOS 应用启动器。当前版本使用 Tauri + Vite 构建，打开 App 后会直接显示居中的命令面板，输入应用名称或英文片段即可即时筛选并启动本机应用。

## 运行

```bash
npm install
npm run app:dev
```

首次运行 Tauri 需要安装 Rust 工具链。

## 构建

```bash
npm run build
npm run app:build
```

默认构建产物：

- `dist/index.html`
- `src-tauri/target/release/bundle/macos/极刻 GEKE.app`
- `src-tauri/target/release/bundle/dmg/*.dmg`

## 键盘操作

- `↑ / ↓` 切换结果
- `Enter` 启动当前应用
- `Esc` 清空搜索，空搜索时隐藏窗口
- `Cmd + R` 重新扫描应用目录
- 全局打开/隐藏快捷键可在设置里调整，默认 `Option + Space`

## 菜单栏

极刻会在 macOS 菜单栏显示 `极刻` 入口，可从这里打开主窗口、打开设置、查看快捷键说明和退出应用。

## 扫描路径

- `/Applications`
- `~/Applications`
- `/System/Applications`
- `/System/Applications/Utilities`

Rust 后端会扫描上述目录中的 `.app` bundle，并读取 `Contents/Info.plist` 里的 `CFBundleDisplayName` / `CFBundleName`。

## 插件目录

插件系统的第一阶段目录约定为：

- `~/Library/Application Support/极刻 GEKE/plugins`

每个插件目录可放置一个 `plugin.json` 清单文件。当前版本已提供 `list_plugins` 后端命令作为后续插件 SDK 和插件市场的基础。
