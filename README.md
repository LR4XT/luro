# luro

本地 Markdown 博客编辑器（当前版本 **0.2.0**）。用 Markdown 写文章，生成与 GitHub Pages 静态博客（如 [lr4xt.com](https://lr4xt.com)）相同结构的 HTML，再 `git push` 到个人仓库对外访问。

也可打包为独立桌面应用，不必单独开浏览器。

## 支持版本

| 用途 | 要求 |
| --- | --- |
| 桌面应用 · macOS | **macOS 11 Big Sur 及以上**，Apple Silicon（arm64）与 Intel（x64） |
| 桌面应用 · Windows | **Windows 10 / 11**，x64 与 ARM64 |
| 从源码开发 / 打包 | **Node.js 18+**、已安装 **Git** |
| 站点仓库 | 含 `index.html`、`post/`、`atom.xml` 的 GitHub Pages 静态站点（可指向已有仓库，也可使用首次启动自动创建的本地站点） |

未提供 Linux 桌面包。Electron 33 已不再支持 macOS 10.15 及更早系统。

## 功能

### 文章（Post）

- 文章列表：从远程同步、提交并推送、批量删除；未提交改动会标出新增 / 已修改
- Markdown 编辑：标题、粗体、斜体、链接、引用、代码块；工具栏一键插入
- **所见即所得式编辑**（CodeMirror）：光标不在该行时隐藏标记，标题可折叠
- 编辑 / 预览切换；已有 HTML 文章可转回 Markdown 继续改
- **插入图片**：工具栏上传、拖拽或粘贴（截图、 Finder / 资源管理器文件均可），保存到站点 `post-images/`（单张最大 15MB）
- **字号**：`{20}大号文字{/}` 渲染为 20px；也可用 HTML `<span style="font-size:20px">`；工具栏「应用字号」包裹选区
- 封面图可单独上传；上传第一张正文图时若尚未设封面会自动填入
- 标题拼音自动生成 slug，可手动改
- 保存时写入 `post/{slug}/index.html`，并更新首页、归档、RSS、标签页；Markdown 草稿保存在应用数据目录的 `drafts/`

### 标签（Tag）

- 创建、重命名、删除标签；会同步生成 / 更新站点 `tag/{id}/` 与 `tags/index.html`
- 写文章时可勾选已有标签，或当场新建

### 导航（Page）

- 管理站点侧栏导航（首页、归档、标签、外链等）
- 保存后会写回站点内相关静态页

### 主题（Theme）

- **站点主题**（推送后才影响线上站点）：Classic、Midnight、Forest、Paper、Ocean；也可导入自定义 CSS
- **编辑器外观**：侧栏可切换浅色 / 深色，只改编辑器，不改站点

### 设置与 Git

- **Site repository**：选择本地静态站点目录；首次启动若未配置，会在 `~/Documents/blog-site` 建一份空站点并引导到设置页
- **Remote repository**：HTTP（用户名 + GitHub Token）或 SSH（私钥，可选口令），凭据保存在本机，无需在终端 `ssh-add`
- 保存后可 **Test connection**、**Sync from remote**；文章列表里可单独 **Push**

### 终端（桌面版）

- 内置终端，工作目录为当前站点仓库
- 仅 Electron 桌面应用可用（浏览器里打开开发页没有终端桥接）

## 桌面应用

### 开发模式

```bash
npm install
npm run electron:dev
```

首次启动会使用或创建 `~/Documents/blog-site`；已有 GitHub Pages 仓库时，到 **Setting → Site repository** 改路径并保存（应用会重启）。

桌面版内嵌 Express，自动占用空闲端口，不再固定 `3456`。

### 打包

```bash
# macOS：Apple Silicon + Intel DMG（Intel 产物文件名带 -intel）
npm run build:mac

# Windows：x64 + ARM64 zip
npm run build:win

# 两个平台一起打
npm run build:all
```

产物在 `release/`：

- macOS：`luro-<version>-arm64.dmg`、`luro-<version>-intel.dmg`
- Windows：`luro-<version>-x64-win.zip`、`luro-<version>-arm64-win.zip`

已签名 / 公证的正式包一般可直接打开。若你本地打的是未签名包，macOS 可能提示「已损坏」：

```bash
xattr -cr /Applications/luro.app
```

或在「应用程序」中 **右键 → 打开**。

### 数据目录

凭据与站点路径保存在应用用户数据目录（已 gitignore 对应开发目录）：

- macOS：`~/Library/Application Support/luro/`
- Windows：`%APPDATA%\luro\`

其中 `.credentials/` 存放站点路径与远程凭据；`drafts/` 存放已保存文章的 Markdown。

## 浏览器开发模式

```bash
npm install
npm run dev
```

打开 **http://localhost:5173**

- 前端：Vite + React（**5173**）
- API：Express（**3456**；访问根路径会跳转到 5173）

需要 Git 同步 / 推送时，同样在 **Setting** 里配置远程，不必在终端 `ssh-add`。

## 远程连接（Setting）

### HTTP

- Repository URL：`https://github.com/user/your-blog.git`
- Username：GitHub 用户名
- Password / Token：Personal Access Token（Fine-grained Token 可直接粘贴）

### SSH

- Repository URL：`git@github.com:user/your-blog.git`（填 HTTPS 地址也会自动转换）
- Private Key：完整私钥
- Passphrase：私钥密码（如有）

保存后 **Test connection**，再 **Sync from remote**。

## 发布流程

1. 在 Post 列表点新建，或打开已有文章
2. 填标题、日期、标签、封面，写 Markdown（可插入图片）
3. 点保存：生成本地 HTML / 草稿，**此时不 push**
4. 回到列表，确认改动后点推送（需已配置远程）

编辑器会：

1. 将 Markdown 转为与现有文章一致的 HTML
2. 写入 `post/{slug}/index.html`
3. 保存草稿到用户数据目录 `drafts/{slug}.md`
4. 更新 `index.html`、`archives/index.html`、`atom.xml` 以及相关标签页
5. 推送时执行 `git add`、`commit`、`push`

只想本地看结果：保存即可，不要点推送。

## 目录结构

```
.
├── electron/        # 桌面壳、内置终端 (node-pty)
├── server/          # 发布 API、Markdown 转换、标签 / 主题 / Git
├── src/             # React 编辑器界面
├── config/          # 主题预设、站点导航等
├── build/           # 图标与 macOS entitlements
├── scripts/         # 公证、DMG 命名等打包脚本
└── package.json
```

站点仓库（由 Setting 指向，默认 `~/Documents/blog-site`）大致为：

```
blog-site/
├── index.html
├── atom.xml
├── archives/
├── post/{slug}/index.html
├── post-images/
├── tags/
└── tag/{id}/
```

## 注意事项

- 有效站点目录必须包含 `index.html`、`post/`、`atom.xml`
- 标签页由编辑器自动维护，一般不必再手写 `tag/` 索引
- 站点主题要 push 之后，GitHub Pages 上才会变；编辑器浅色 / 深色只影响本机 UI
- 内置终端只在桌面应用中可用
