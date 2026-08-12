# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

极刻 GEKE (`geke-launcher`) — a Raycast-style macOS app launcher built with **Tauri 2 + Vite**. One Rust backend and three webview windows (launcher, screenshot overlay, pinned-image windows). UI copy is Chinese-first with an English fallback.

## Commands

```bash
npm install               # install JS deps; Rust toolchain needed for app builds
npm run app:dev           # full app in dev: Tauri + Vite (dev server at 127.0.0.1:5173, strict port)
npm run dev               # renderer only in a browser (no Rust backend — falls back to mock bridge)
npm run build             # vite build + scripts/verify-build-output.mjs
npm run app:build         # rm -rf release, tauri build, then copy + codesign bundles into ./release
npm run verify:renderer-input   # jsdom DOM verification of src/renderer.js (de-facto frontend test)
npm run verify:screenshot-ui    # jsdom DOM verification of src/screenshot.js
cd src-tauri && cargo test      # Rust unit tests (`mod tests` in main.rs)
npm run app:build:screenshot-levels  # build .app variants at different screenshot-overlay levels
```

`app:build` produces `release/极刻 GEKE.app` and `release/极刻 GEKE_1.0.0_aarch64.dmg`, re-codesigned by `scripts/copy-tauri-release.mjs` (ad-hoc unless `GEKE_CODESIGN_IDENTITY` is set).

## Architecture

### Three webview windows sharing one stylesheet

`vite.config.js` builds three HTML entries (`index.html`, `screenshot.html`, `pin.html`); all three renderers share `styles.css` (~60 KB, CSS-variable theming for dark/light/appearance modes). `scripts/verify-build-output.mjs` fails the build if any of the three entries is missing from `dist/`.

- **`main`** (`index.html` → `src/renderer.js`, ~4,100 lines) — the launcher panel and the entire settings UI. Declared in `tauri.conf.json` (transparent, undecorated, hidden at launch, shown in `.setup()`).
- **`screenshot`** (`screenshot.html` → `src/screenshot.js`, ~2,400 lines) — full-screen capture overlay with pointer-drag selection and a toolbar. Created dynamically in Rust (`open_screenshot_window`, `WebviewWindowBuilder`, label `"screenshot"`), layered above other windows.
- **`pin-*`** (`pin.html` → `src/pin.js`, ~200 lines) — one window per pinned image; label is `pin-<timestamp>`, opened with `pin.html?pinId=…`. Resize/scale and drag are driven from Rust (`start_pin_drag`, `resize_pinned_image`).

### Frontend bridge pattern (important)

Every renderer starts with `window.geke ?? createTauriBridge() ?? createFallbackBridge()` (`screenshot.js` uses `window.gekeScreenshot`). The Tauri bridge wraps `window.__TAURI__.core.invoke` and `event.listen`; the fallback bridge returns mock data so the renderer runs in a plain browser. The jsdom verifications inject their own mock at `window.geke` before loading the renderer source (e.g. `scripts/verify-renderer-input.mjs:74`). **When you add a backend command, expose it on `createTauriBridge()` AND on the mock in the corresponding verify script** — the jsdom tests drive the UI through that mock, so a missing method there silently exercises nothing.

Events flow backend → renderer via `launcher:window-visible`, `launcher:settings-changed`, `launcher:open-settings`, `launcher:screenshot-error`, `screenshot:session-updated`.

### Rust backend — single-file `src-tauri/src/main.rs` (~3,900 lines)

- **State**: all app state lives in `Mutex`-managed Tauri state: `LauncherState` (apps + settings), `ScreenshotSessionState`, `PinnedImageState`, and `WakeRuntime` (`Arc<Mutex<…>>` settings + registered shortcut sets shared with the monitor threads).
- **Settings**: persisted as a JSON file in the app-data dir (`settings_path()`, `load_settings`/`save_settings`), normalized on every load (`normalize_settings`). `LauncherSettings::default()` is the source of truth for defaults; legacy 浮光截图 values are migrated to 极刻 names.
- **App search**: scans `.app` bundles under the configured paths, reads `Info.plist` (`CFBundleDisplayName`/`CFBundleName`), extracts icon → data URL, stores in a `BTreeMap`. Ranked by `app_score`, capped at `SEARCH_LIMIT` (40).
- **File search**: Spotlight via `mdfind` (`run_mdfind`/`build_file_search_query`), requires ≥2 chars, capped at 30.
- **Global shortcuts** — three layers: `tauri-plugin-global-shortcut` for normal registered combos; a polling thread (`start_wake_monitor`) detecting modifier **double-tap / long-press / mouse wake** from `CGEvent` flags; and a `CGEventTap` (`start_priority_shortcut_monitor`) for "priority" shortcuts that fire even under a fullscreen app — this needs macOS **Accessibility / Listen Event** permission (`open_priority_permission_settings`).
- **Screenshot plugin**: full-screen capture → overlay window → user drags a selection → save to file/clipboard or **pin** it. Includes macOS Vision OCR (`run_macos_vision_ocr`) and translation via Google Translate + MyMemory HTTP APIs. Requires **Screen Recording** permission.
- **Pin system**: pinned images persist as PNG files + a history JSON (capped by `pin_history_limit`, default 50); supports restore, resize (scale clamped 0.25–3.0), drag, history import/delete.
- **macOS-only paths** are `#[cfg(target_os = "macos")]` with no-op stubs elsewhere; window-level and ignore-mouse manipulation go through `objc2-app-kit`. Screenshot overlay level is a **compile-time** constant from the `GEKE_SCREENSHOT_OVERLAY_LEVEL` env var (`build.rs` reruns on it).

### Icons

`tauri.conf.json` points at `build/icon.icns`, generated by `scripts/generate-app-icon.mjs` (from `build/icon.svg`). The tray icon is `src-tauri/icons/menu-bar-icon.png`, embedded via `include_bytes!` — regenerate with `scripts/generate-menu-bar-icon.mjs` and rebuild if you change it.

## Conventions

- **2-space indent everywhere** — including Rust; `main.rs` is intentionally not `rustfmt`-formatted. Match it.
- JS: double quotes, semicolons, ESM, arrow functions.
- i18n: the `COPY` dict at the top of `renderer.js` is keyed by language (`zh-CN` default), read via `t(key)`. Rust has a parallel `menu_copy` for tray labels. Add new user-facing strings to both `zh-CN` and `en`.
- App display name 极刻 GEKE, bundle id `com.smithereensun.geke`. UI copy, comments, and log strings are in Chinese.

## 设计决策与已知问题

这些是代码/README 里读不到的"为什么",改动相关代码前先看:

- **长截图已移除**:曾实现过,因稳定性问题(滚轮事件 + 截图覆盖层 + 图片拼接导致无法滚动、无法取消、卡死)整个功能删除,以免影响普通截图和菜单栏截图。勿重新引入。
- **截图覆盖层级是权衡**:窗口必须压过菜单栏才能截到菜单栏,但层级过高会挡住系统窗口或造成鼠标异常 —— 所以覆盖层级是编译期常量,并用 `app:build:screenshot-levels` 出各层级变体实测。
- **截图启动顺序**有保护逻辑(`screenshot_capture_is_active_or_starting` / `restore_window_visibility_for_capture`),否则会闪出极刻面板或上一张截图选区。
- **文件搜索**曾直接扫用户目录,又卡又杂;现为 Spotlight `mdfind` + 用户可配置路径 + 过滤 + 限 30 条。
- **设置页是全量重绘**(`renderSettingsPanel` 每次重建整个面板 DOM),已知会导致滚动回顶部、展开组错位、开关状态不一致 —— 属于待优化项,改设置相关代码时注意。
- **新打包的 .app 需要重新授权**屏幕录制、辅助功能、文件访问;代码只能打开系统设置页,不能自授。
- **全局快捷键**易与系统/其他应用冲突(如 `Option+Space`),要处理录入、取消、冲突校验和「极刻优先」事件戳权限。
- **菜单栏图标**按 macOS 模板图标规则(`icon_as_template(true)` + 单色),否则发糊/带背景色/显方正。
- **钉图拖动**要区分控件区域,避免按钮、缩放、虚化滑杆误触拖动。

## Gotchas

- `scripts/copy-tauri-release.mjs` hard-codes the dmg filename `极刻 GEKE_1.0.0_aarch64.dmg` — update it when bumping the version.
- The `plugins` directory (`~/Library/Application Support/极刻 GEKE/plugins`) is future work; no backend code exists for it yet.
- Not a git repository — there is no history to consult or VCS worktree.
