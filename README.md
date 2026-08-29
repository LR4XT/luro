# LR Blog Editor

本地 Markdown 博客编写器，生成与 [lr4xt.com](https://lr4xt.com) 相同结构的静态 HTML，并支持推送到你的个人仓库（类似 `git@github.com:LR4XT/lr4xt.github.io.git`），通过github pages提供对外访问功能。

## 功能

- **Markdown 语法**：标题、粗体、斜体、链接、引用、代码块等
- **插入图片**：工具栏上传或拖拽到编辑器，图片保存到站点根目录 `post-images/`
- **字号控制**：
  - 快捷语法：`{20}大号文字{/}` → 渲染为 20px
  - HTML：`<span style="font-size:20px">文字</span>`
  - 工具栏「应用字号」可包裹选中文字
- **一键发布**：生成 `post/{slug}/index.html`，更新首页、归档、RSS，可选 git commit + push

## 后续规划

- [x] 更多博客主题切换

## macOS 桌面应用

可将编辑器打包为独立 `.app` / `.dmg`，无需单独打开浏览器。

### 环境要求

- Node.js 18+（仅构建时需要）
- macOS 上已安装 **git**（`/usr/bin/git` 或 Homebrew）
- 本地已克隆 `lr4xt.github.io` 仓库

### 开发模式运行 Electron

```bash
cd blog-editor
npm install
npm run electron:dev
```

首次启动会尝试自动定位 `lr4xt.github.io`；找不到时会弹出文件夹选择对话框。

> 运行 Electron 前请先停止 `npm run dev`，避免 3456 端口冲突。

### 打包 macOS 应用

```bash
npm run build:mac
```

产物在 `release/` 目录：`LR Blog Editor.app` 与 `.dmg` 安装包。

### 从 Release 安装后无法打开？

通过浏览器下载的未签名应用，macOS 可能提示 **「已损坏，无法打开」**（并非文件真的损坏，是 Gatekeeper 隔离标记）。

任选一种方式解决：

**方式 1（推荐）** — 终端移除隔离属性：

```bash
xattr -cr "/Applications/LR Blog Editor.app"
```

**方式 2** — 右键打开：

1. 在「应用程序」中找到 **LR Blog Editor**
2. **右键 → 打开** → 再次点 **打开**

**方式 3** — 系统设置：

系统设置 → 隐私与安全性 → 找到被拦截提示 → **仍要打开**

### 桌面应用说明

- 应用内嵌 Express API，界面加载 `http://127.0.0.1:3456`
- 凭据与站点路径保存在 `~/Library/Application Support/lr4xt-blog-editor/`
- 在 **Setting → Site repository** 可修改本地博客仓库路径
- 在 **Setting → Remote repository** 配置 GitHub 连接（HTTP Token 或 SSH Key）
- 修改站点路径后应用会自动重启

## 环境要求

- Node.js 18+
- 远程仓库凭据在编辑器 **Setting** 页面配置（HTTP 或 SSH），无需在终端执行 `ssh-add`

## 远程连接（Setting）

支持两种方式，凭据保存在本地 `blog-editor/.credentials/`（已 gitignore）：

### HTTP
- Repository URL：`https://github.com/LR4XT/lr4xt.github.io.git`
- Username：GitHub 用户名
- Password / Token：GitHub Personal Access Token

### SSH
- Repository URL：`git@github.com:LR4XT/lr4xt.github.io.git` 或 HTTPS 地址（会自动转换）
- Private Key：粘贴完整私钥内容
- Passphrase：私钥密码（如有）

保存后点击 **Test connection** 验证，再 **Sync from remote** 同步内容。

## 启动

```bash
cd blog-editor
npm install
npm run dev
```

浏览器打开 **http://localhost:5173**（编辑器界面）

- 前端 UI：Vite + React（**5173**）
- 后端 API：Express（3456，仅接口；访问根路径会自动跳转到 5173）

## 发布流程

1. 填写标题、日期、标签（可选）
2. 编写 Markdown 正文，插入图片
3. 勾选「发布后立即 git push 到 origin」
4. 点击「发布并推送」

编辑器会：

1. 将 Markdown 转为 HTML（与现有文章格式一致）
2. 写入 `../post/{slug}/index.html`
3. 保存 Markdown 草稿到 `blog-editor/drafts/{slug}.md`
4. 更新 `index.html`、`archives/index.html`、`atom.xml`
5. 执行 `git add`、`commit`、`push`

若只想本地预览生成结果，取消勾选 push，使用「仅生成本地文件」。

## 目录结构

```
blog-editor/
├── server/          # 发布 API、Markdown 转换、Git 操作
├── src/             # React 编辑器界面
├── drafts/          # 发布后保存的 Markdown 源文件
└── package.json
```

## 注意事项

- Slug 默认由标题拼音自动生成，可手动修改
- 封面图使用 `post-images/` 下的文件名；上传第一张正文图时会自动填入
- 标签页链接格式为 `/tag/{标签名}/`，需确保站点已有对应标签页（新标签需后续手动补充标签索引页）
