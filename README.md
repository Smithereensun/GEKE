# 极刻 GEKE

极刻 GEKE 是一个 Raycast 风格的 macOS 应用启动器。打开 App 后会直接显示居中的命令面板，输入应用名称、英文片段、拼音或首字母即可即时筛选并启动本机应用。

## 运行

```bash
npm install
npm run app:dev
```

## 构建

```bash
npm run build
npm run app:build
```

默认构建产物：

- `dist/index.html`
- `release/mac-arm64/极刻 GEKE.app`
- `release/GEKE-1.0.0-arm64.zip`

## 键盘操作

- `↑ / ↓` 切换结果
- `Enter` 启动当前应用
- `Esc` 清空搜索，空搜索时隐藏窗口
- `Cmd + R` 重新扫描应用目录

## 扫描路径

- `/Applications`
- `~/Applications`
- `/System/Applications`
- `/System/Applications/Utilities`

主进程会扫描上述目录中的 `.app` bundle，并读取 `Contents/Info.plist` 里的 `CFBundleDisplayName` / `CFBundleName`。搜索支持大小写无关、包含匹配、子序列匹配，以及中文应用名的拼音全拼和首字母匹配。
