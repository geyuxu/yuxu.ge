---
title: "一夜 Vibe Coding：将静态站点生成器迁移到 Deno"
date: 2026-02-03
tags: [staticflow, deno, typescript, vibe-coding, open-source]
description: "记录将 Shell 脚本静态站点生成器迁移到 Deno 平台的一夜经历"
---

# 一夜 Vibe Coding：将静态站点生成器迁移到 Deno

昨天晚上开始，今天完成。一夜的 vibe coding，我成功将自己的静态站点生成器从 Shell 脚本迁移到了 Deno 平台。

## 迁移成果

- ✅ 完全移除所有 Shell 脚本依赖
- ✅ 彻底消除 Node.js 代码
- ✅ 干净、现代的 TypeScript 代码库
- ⏳ 仍在努力移除一些外部程序依赖

## 为什么要迁移？

我一直在用自己写的基于 Shell 脚本的静态博客生成器（就是 [yuxu.ge](https://yuxu.ge) 这个站），用起来还不错。但和主流方案对比后，发现了一个关键问题：

|          | Hugo | Jekyll | Astro | Gatsby | StaticFlow |
|----------|------|--------|-------|--------|------------|
| 构建速度 | 快   | 慢     | 快    | 慢     | 快         |
| 内容格式 | MD   | MD     | MD    | MD     | 40+ 格式   |
| Notebook | ✗    | ✗      | 插件  | 插件   | 原生支持   |
| 搜索     | ✗    | ✗      | ✗     | ✗      | 混合搜索   |
| AI 功能  | ✗    | ✗      | ✗     | ✗      | RAG + 翻译 |

功能上已经超越主流方案，但有个致命问题：**依赖太多**。

当前需要安装 Node.js + ImageMagick + LibreOffice。让用户装这么多东西？不可接受。

## Deno 迁移方案

目标很明确：

```bash
curl -fsSL https://xxx/install.sh | sh
staticflow build
# Done. 零依赖。
```

功能对标 Astro/Gatsby，体验对标 Hugo。

### 为什么选 Deno

```bash
# 一行命令编译成单文件
deno compile -A -o staticflow scripts/cli.ts
```

生成单个二进制文件，无需安装任何运行时。这正是我需要的。

## 代码重构

### 重构前的混乱状态

```
旧架构:
├── build.sh          # 主构建脚本
├── compress.sh       # 图片压缩
├── convert-heic.sh   # HEIC 转换
├── blog/build.ts     # Node.js 脚本
└── 各种零散脚本...
```

Shell 和 Node.js 混用，依赖管理混乱，跨平台兼容性差。

### 重构后的清晰结构

```
新架构:
├── scripts/
│   ├── cli.ts              # 统一 CLI 入口
│   ├── config.ts           # 配置加载
│   ├── build.ts            # 构建逻辑
│   ├── build-static.ts     # 静态 HTML 生成
│   ├── build-posts-json.ts # 博客索引
│   ├── build-photos-json.ts# 相册索引
│   ├── compress-photos.ts  # 图片压缩
│   ├── convert-heic.ts     # HEIC 转换
│   └── index-builder.ts    # 搜索索引构建
├── staticflow.config.yaml  # 统一配置
└── deno.json               # Deno 任务配置
```

所有代码统一用 TypeScript，一个配置文件控制所有行为。

### 统一配置设计

```yaml
# staticflow.config.yaml
site:
  name: "My Blog"
  url: "https://yuxu.ge"

paths:
  posts: "content/posts"
  photos: "content/photos"
  output: "dist"
  theme: "themes/default"
  static: "static"

features:
  search: true
  vectorSearch: true
  gallery: true
  chat: true
  translation: false

build:
  imageCompression: true
  maxImageWidth: 2000
  imageQuality: 85
```

前端通过 `features.json` 读取配置，动态启用/禁用功能模块：

```typescript
// 构建时生成 features.json
const featuresJson = JSON.stringify(config.features, null, 2);
await Deno.writeTextFile(join(distDir, "features.json"), featuresJson);
```

## 部署优化：Git Worktree 方案

这是本次迁移最大的优化。

### 问题：复制文件太慢

最初的部署流程：

```
1. 创建临时目录
2. clone gh-pages 分支到临时目录 (慢!)
3. 清空临时目录
4. 复制 dist/* 到临时目录 (慢!)
5. commit & push
6. 清理临时目录
```

每次部署需要 **12 秒**，大部分时间花在 clone 和复制文件上。

### 解决方案：Worktree

Git Worktree 允许在同一仓库中同时 checkout 多个分支到不同目录：

```bash
# 将 gh-pages 分支 checkout 到 dist 目录
git worktree add dist gh-pages
```

这样 `dist` 目录就是 gh-pages 分支的工作目录，build 直接输出到这里，deploy 时无需复制！

### 实现细节

**1. 检测 dist 是否是 worktree**

```typescript
const distGitFile = join(distDir, ".git");
if (existsSync(distGitFile)) {
  const content = await Deno.readTextFile(distGitFile);
  if (content.includes("gitdir:")) {
    // 是 worktree，检查分支
    const branch = await getBranch(distDir);
    if (branch === "gh-pages") {
      distIsWorktree = true;
    }
  }
}
```

Worktree 的 `.git` 是一个文件（不是目录），内容类似：
```
gitdir: /path/to/repo/.git/worktrees/dist
```

**2. 自动设置 worktree**

首次 deploy 时自动检测并设置：

```typescript
if (!existsSync(distDir) || !isWorktree(distDir)) {
  console.log("Setting up dist/ as gh-pages worktree...");
  await setupDeploy();
}
```

**3. setupDeploy 实现**

```typescript
async function setupDeploy() {
  // 检查本地是否有 gh-pages 分支
  const localExists = await branchExists("gh-pages");

  if (!localExists) {
    // 检查远程
    const remoteExists = await remoteBranchExists("gh-pages");
    if (remoteExists) {
      // fetch 远程分支
      await run("git", ["fetch", "origin", "gh-pages:gh-pages"]);
    } else {
      // 创建孤儿分支并推送
      await createOrphanBranch("gh-pages");
    }
  }

  // 创建 worktree
  await run("git", ["worktree", "add", distDir, "gh-pages"]);
}
```

**4. build 时跳过 .git**

关键：复制主题文件时必须跳过 `.git`，否则会破坏 worktree：

```typescript
async function copyDir(src: string, dest: string) {
  for await (const entry of Deno.readDir(src)) {
    if (entry.name === ".git") continue;  // 跳过!
    // ... 复制文件
  }
}
```

**5. deploy 流程（优化后）**

```typescript
if (distIsWorktree) {
  // 直接在 dist 目录操作，无需复制
  console.log("dist/ is gh-pages worktree, deploying directly...");

  // 同步远程
  await run("git", ["pull", "--rebase", "origin", "gh-pages"], distDir);

  // 提交
  await run("git", ["add", "-A"], distDir);
  await run("git", ["commit", "-m", message], distDir);

  // 推送
  const pushResult = await run("git", ["push", "origin", "gh-pages"], distDir);

  if (!pushResult.success) {
    // 冲突时询问是否 force push
    const answer = await prompt("Force push? [y/N]");
    if (answer === "y") {
      await run("git", ["push", "--force", "origin", "gh-pages"], distDir);
    }
  }
}
```

### 性能对比

| 操作 | 优化前 | 优化后 |
|------|--------|--------|
| 检查分支 | clone (慢) | git ls-remote (快) |
| 准备目录 | 复制文件 | 直接使用 worktree |
| 总耗时 | **12 秒** | **3 秒** |

## CLI 设计

遵循 Unix 哲学，命令简洁明了：

```bash
# 构建
staticflow build              # 完整构建
staticflow build --static     # 仅生成静态 HTML
staticflow build --photos     # 仅处理图片

# 开发
staticflow serve              # 开发服务器 :8080
staticflow serve --port=3000  # 自定义端口

# 部署
staticflow deploy             # 部署到 gh-pages
staticflow deploy --build     # 构建并部署（推荐）
staticflow deploy -m "msg"    # 自定义提交信息

# 设置
staticflow setup              # 检查依赖
staticflow setup-deploy       # 手动设置 worktree
staticflow init               # 初始化项目
staticflow clean              # 清理生成文件
```

一条命令完成全部：

```bash
staticflow deploy --build
# 自动: setup worktree → build → commit → push
```

## 当前功能

项目已经相当完善：

- **多格式内容支持** - Markdown、Jupyter Notebook、LaTeX、Office 文档
- **混合搜索** - BM25 关键词 + Voy 向量语义搜索（WASM）
- **AI 聊天助手** - 基于 RAG 的问答
- **相册功能** - 自动压缩、HEIC 转换、AI 生成描述
- **多语言翻译** - AI 驱动的内容翻译

## 仍需外部依赖

目前还有一些功能依赖外部程序：

| 功能 | 当前依赖 | 计划方案 |
|------|----------|----------|
| 图片压缩 | ImageMagick | WASM |
| HEIC 转换 | ImageMagick | libde265 WASM |
| Office 转 PDF | LibreOffice | 待定 |
| LaTeX 编译 | pdflatex | TeX WASM |

下一步计划：将核心格式转换代码精简并编译为 WASM，嵌入到单个约 15MB 的二进制文件中。

比如 HEIC 解码，计划将 libde265（HEVC 解码器）从 5 万行 C 代码精简到 1.5 万行，移除多线程、SIMD、编码器模块，编译成约 300KB 的 WASM。

## AI 辅助开发

这次迁移大量使用了 Claude Code 作为 AI 结对编程伙伴。几点体会：

1. **描述意图而非实现** - 说"部署太慢，因为要复制文件"，AI 会建议 worktree 方案
2. **增量迭代** - 先实现基础功能，测试通过后再优化
3. **即时测试** - 每次改动后立即 `staticflow deploy --build` 验证
4. **保持上下文** - AI 记得之前的讨论，可以说"按刚才的方案继续"

一夜能完成迁移，AI 功不可没。

## 踩坑记录

### 1. 编译后的二进制需要重新生成

修改代码后，`staticflow` 命令还是旧版本：

```bash
# 必须重新编译
deno task compile
```

我在 `deno.json` 中配置了自动删除旧文件：

```json
{
  "tasks": {
    "compile": "rm -f /opt/staticflow/bin/staticflow && deno compile -A -o /opt/staticflow/bin/staticflow scripts/cli.ts"
  }
}
```

### 2. Worktree 残留导致创建失败

如果上次 worktree 没清理干净，新建会失败：

```typescript
// 先 prune 清理残留
await run("git", ["worktree", "prune"]);
await run("git", ["worktree", "add", distDir, "gh-pages"]);
```

### 3. WASM MIME 类型

开发服务器必须正确配置 MIME 类型，否则浏览器拒绝加载：

```typescript
const mimeTypes = {
  ".wasm": "application/wasm",  // 不是 octet-stream!
};
```

## 开源计划

项目即将开源，敬请期待！🔜

---

*#Deno #TypeScript #StaticSiteGenerator #VibeCoding #OpenSource*
