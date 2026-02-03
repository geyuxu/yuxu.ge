---
date: 2024-01-01
tags: [devops, mcp, astro, 自动化, github pages, devops]
legacy: true
---

# MCP-Blog：一键搞定 Astro 博客发布，告别繁琐流程

1. 在博客项目 `geyuxu.com` 中写完文章
2. 执行 `git add .`、`git commit -m "..."`、`git push` 将源码推送到主分支
3. 执行 `npm run build` 构建静态文件到 `dist` 目录
4. 将 `dist` 目录中的内容推送到 `gh-pages` 分支以完成部署

这个过程不仅涉及多个命令，还可能因为 `dist` 目录未被 Git 正确管理而引发各种问题。更重要的是，我希望有一个"管理中心"来统一处理这类任务，而不是在项目目录中堆积各种脚本。

于是，我创建了 **MCP-Blog** 项目。它的核心目标是：**在一个独立的、专门的目录中，通过一个命令，自动化完成另一个目录（博客项目）的全部提交流程。**

这解决了两大痛点：
1. **操作隔离**：将管理脚本与博客内容分离，保持博客仓库的纯净
2. **流程自动化**：将多步操作简化为一步，减少人为错误，提升效率

## 二、技术架构：MCP 的设计哲学

### 什么是 MCP (Model Context Protocol)？

"模型上下文协议"（Model Context Protocol）并非一个公开的网络协议，而是我为本项目设计的一套**命令行交互规范**。它的核心思想是：

> 让一个独立的执行脚本（模型），能够理解并操作特定上下文（Context）中的目标项目。

在这个项目中：
- **模型 (Model)**：就是我们的 `mcp-blog` 项目，它是一个主动的执行者
- **上下文 (Context)**：指的是我们的 `geyuxu.com` 博客项目，它是被操作的对象
- **协议 (Protocol)**：是我们定义的命令行接口和脚本执行逻辑。例如，`./mcp.sh "commit message"` 就是一个协议的实现

### 架构图

整个工作流非常直观：

```
+-----------+       +-------------------------+       +---------------------+       +----------------+
|           |       |                         |       |                     |       |                |
|   用户     |------>|  MCP 脚本 (mcp.sh)      |------>|  Astro 博客项目     |------>|  GitHub 仓库   |
|           |       |                         |       | (geyuxu.com)        |       | (main/gh-pages)|
+-----------+       +-------------------------+       +---------------------+       +----------------+
      |                        |                                |                           |
      | 1. 提供 commit 消息    | 2. cd 到博客目录              | 3. 执行 Git 操作 & build | 4. 部署到 Pages
      |                        | 4. 执行部署命令               |                           |
```

这个架构的关键在于 **MCP 脚本** 如何有效地"穿越"到 **Astro 博客项目** 的目录中去执行操作。

## 三、实现细节：一步步构建自动化利器

现在，我们来看最核心的代码实现。整个项目由一个 Shell 脚本驱动。

**项目结构:**
```
/Users/geyuxu/repo/blog/
├── mcp-blog/         # MCP 项目
│   └── mcp.sh
└── geyuxu.com/       # Astro 博客项目
    ├── src/
    ├── public/
    ├── package.json
    └── ...
```

### 1. 核心脚本 `mcp.sh`

这是我们所有自动化的心脏。它负责接收参数、切换目录、执行命令和处理错误。

```bash
#!/bin/bash

# 脚本出错时立即退出
set -e

# --- 配置区 ---
# 定义 MCP 项目路径 (脚本所在位置)
MCP_PROJECT_PATH="/Users/geyuxu/repo/blog/mcp-blog"
# 定义博客仓库路径 (需要操作的目标)
BLOG_REPO_PATH="/Users/geyuxu/repo/blog/geyuxu.com"
# --- 配置区结束 ---

# 1. 检查输入参数：必须提供 commit message
if [ -z "$1" ]; then
  echo "❌ 错误: 请提供一个 commit message."
  echo "用法: ./mcp.sh \"你的提交信息\""
  exit 1
fi

COMMIT_MESSAGE=$1

echo "🚀 MCP-Blog 任务启动..."
echo "================================="

# 2. 跨目录权限管理与操作核心
echo "📂 正在进入博客仓库目录: $BLOG_REPO_PATH"
cd "$BLOG_REPO_PATH"

# 3. Git 自动化操作：提交源码
echo "🔄 正在同步源码到 main 分支..."
git add .
git commit -m "$COMMIT_MESSAGE"
git push origin main

echo "✅ 源码同步完成。"
echo "================================="

# 4. Astro 博客系统集成：构建项目
echo "🛠️  正在构建 Astro 项目..."
npm run build

echo "✅ 构建完成。"
echo "================================="

# 5. GitHub Pages 部署
echo "🚀 部署到 GitHub Pages..."
# 这里我们使用 gh-pages 包来简化部署
# 它会自动将 dist 目录的内容推送到 gh-pages 分支
npm run deploy

echo "✅ 部署成功！"
echo "================================="
echo "🎉 所有任务完成，博客已更新！"

# 返回原始目录 (可选，良好实践)
cd "$MCP_PROJECT_PATH"
```

### 2. 关键技术点解析

- **跨目录权限管理 (`cd "$BLOG_REPO_PATH"`)**:
  这看似简单的一行 `cd` 是实现跨目录操作的关键。脚本启动后，它首先将当前的工作目录切换到博客项目下。这样，后续所有的 `git` 和 `npm` 命令就好像是直接在 `geyuxu.com` 目录里执行的一样，自然就拥有了操作该目录文件的"上下文权限"。

- **Git 自动化 (`git add/commit/push`)**:
  脚本通过标准的 Git 命令来处理源码的提交。将 commit message 作为脚本的第一个参数 (`$1`) 传入，增加了灵活性。

- **Astro 集成 (`npm run build`)**:
  每个 Astro 项目都有一个 `build` 脚本定义在 `package.json` 中。我们的自动化脚本直接调用它，无需关心其内部复杂的构建过程，实现了完美的解耦。

- **GitHub Pages 部署 (`npm run deploy`)**:
  为了简化部署，我强烈推荐使用 `gh-pages` 这个 npm 包。
  
  首先，在你的 **Astro 项目 (`geyuxu.com`)** 中安装它：
  ```bash
  npm install gh-pages --save-dev
  ```
  然后，在 `geyuxu.com/package.json` 的 `scripts` 中添加一个 `deploy` 命令：
  ```json
  {
    "scripts": {
      "dev": "astro dev",
      "start": "astro dev",
      "build": "astro build",
      "preview": "astro preview",
      "astro": "astro",
      "deploy": "gh-pages -d dist" 
    }
  }
  ```
  `gh-pages -d dist` 命令会自动将 `dist` 目录的内容推送到名为 `gh-pages` 的分支。

## 四、使用示例：如何运行 MCP-Blog

假设你已经完成了上述配置，现在发布一篇新博客就像呼吸一样简单。

1. **赋予脚本执行权限** (只需做一次):
   ```bash
   cd /Users/geyuxu/repo/blog/mcp-blog
   chmod +x mcp.sh
   ```

2. **一键发布**:
   当你在 `geyuxu.com` 中完成写作后，打开终端，执行以下命令：
   ```bash
   ./mcp.sh "feat: 添加关于 MCP-Blog 的新文章"
   ```

然后，你就可以泡杯咖啡，看着终端自动完成所有工作：

```
🚀 MCP-Blog 任务启动...
=================================
📂 正在进入博客仓库目录: /Users/geyuxu/repo/blog/geyuxu.com
🔄 正在同步源码到 main 分支...
[main 1234567] feat: 添加关于 MCP-Blog 的新文章
 1 file changed, 1 insertion(+)
 ...
✅ 源码同步完成。
=================================
🛠️  正在构建 Astro 项目...
> geyuxu.com@0.0.1 build
> astro build
...
✅ 构建完成。
=================================
🚀 部署到 GitHub Pages...
> geyuxu.com@0.0.1 deploy
> gh-pages -d dist
Published
✅ 部署成功！
=================================
🎉 所有任务完成，博客已更新！
```

几分钟后，你的新文章就会出现在线上。

## 五、总结与展望

**MCP-Blog** 项目通过一个简单的 Shell 脚本，成功地将复杂的博客发布流程自动化，实现了：
- **效率提升**：将 5-6 个步骤简化为 1 个命令
- **降低错误率**：程序化的操作避免了手动执行时的遗漏或失误
- **代码整洁**：将管理逻辑与业务逻辑（博客内容）分离

**未来可以探索的方向：**
1. **功能增强**：增加创建新文章的命令，例如 `./mcp.sh new "文章标题"`，自动生成带有 frontmatter 的 Markdown 模板
2. **平台化**：将 Shell 脚本升级为更健壮的 Node.js 或 Python CLI 工具，提供更丰富的交互和错误处理
3. **CI/CD 集成**：虽然本地脚本很方便，但最终极的自动化方案是将其迁移到 GitHub Actions。当 `main` 分支有新的 push 时，自动触发构建和部署流程

希望这个小项目能给你带来启发。自动化是我们工程师的第二天性，把重复的工作交给机器，我们才能专注于创造更有价值的内容。