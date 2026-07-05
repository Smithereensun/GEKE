# 极刻 / GEKE

现有 GEKE 项目在保留 Vite 多页展示站的基础上，新增了一个可本地运行的 Electron macOS App 测试版。主窗口会直接打开当前产品页，并保留更新日志与原型图入口。

## 环境要求

- macOS
- Node.js 20 或更高版本
- npm

## 本地运行 Web 版本

```bash
npm install
npm run dev
```

默认地址是 `http://127.0.0.1:5173`。

## 本地运行 macOS App 测试版

```bash
npm install
npm run app:dev
```

也可以使用别名命令：

```bash
npm run electron:dev
```

运行后会启动 Vite 开发服务器，并自动打开一个标题为 `极刻 / GEKE` 的 Electron 窗口。

## 构建 macOS App

```bash
npm run dist:mac
```

或：

```bash
npm run app:build
```

构建会先产出前端静态资源，再通过 `electron-builder` 生成 macOS 产物。默认输出目录是 `release/`，其中会包含：

- `release/mac-*/极刻 GEKE.app`
- `release/GEKE-<version>-<arch>.zip`

说明：运行时显示名称是 `极刻 / GEKE`，但 macOS 文件名不能包含 `/`，所以打包产物会使用安全文件名 `极刻 GEKE.app`。

## 原型图位置

- 源文件：`public/prototypes/geke-workbench.svg`
- 页面入口：`/prototype/`

## 目录说明

- `src/`: 首页与更新日志页面逻辑
- `prototype/`: 原型图展示页
- `electron/`: Electron 主进程与本地静态资源服务
- `public/prototypes/`: 原型 SVG 资源
