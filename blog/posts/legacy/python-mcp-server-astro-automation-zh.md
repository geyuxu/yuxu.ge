---
date: 2025-07-27
tags: [devops, mcp, python, astro, 自动化, fastmcp]
legacy: true
---

# 用Python脚本快速实现MCP服务器：Astro博客自动化实践

在深入代码之前，我们先来认识一下核心库 `fastmcp`。你可以把它想象成一根魔法棒，只要对着一个普通的Python函数挥舞一下（即使用一个装饰器），这个函数就能立刻被封装成一个符合MCP协议标准的工具，可供AI客户端调用。

`FastMCP` 的设计哲学是"简约而不简单"。它为你处理了所有与MCP协议相关的底层细节，如JSON-RPC通信、工具发现和异步执行。开发者唯一需要做的，就是专注于编写工具函数的业务逻辑。

在我们的脚本中，`FastMCP` 的使用体现在以下两行核心代码上：

```python
# 1. 初始化一个MCP应用实例
app = FastMCP(
    name="Astro Deployment MCP Server",
    instructions="Exposes publish_article and commit_code tools for an Astro blog",
)

# 2. 使用 @app.tool() 装饰器将函数注册为工具
@app.tool()
async def my_tool_function():
    # ... tool logic ...
    return "Tool execution result"
```

`name` 和 `instructions` 字段是元数据，它们会告诉MCP客户端这个服务器的用途和它所提供的能力，非常有助于AI理解上下文。而 `@app.tool()` 装饰器则是这一切的核心，它自动将任何被其装饰的 `async` 函数注册为可供远程调用的工具。

## 目标：自动化Astro博客的工作流

我们的目标非常明确：让AI能够独立完成发布一篇新博客文章的完整流程。这个流程可以分解为三个核心动作：
1. **保存文章**：将AI生成的Markdown内容保存到Astro项目指定的目录中。
2. **提交代码**：将新添加的文章文件通过Git进行暂存（add）、提交（commit）和推送（push）。
3. **发布网站**：执行部署命令，将最新的博客内容发布到线上服务器。

接下来，我们将逐一分析实现这三个动作的工具函数。

## 代码实现详解

我们的MCP服务器是一个独立的Python脚本 `astro_mcp_server.py`。让我们看看它的构成。

### 1. 环境配置与辅助函数

脚本首先要做的是确定Astro博客项目的根目录。通过读取环境变量 `ASTRO_DIR`，我们实现了配置的灵活性，同时提供了一个默认值 `./astro`。这里巧妙地使用了 `pathlib` 库，它是现代Python中处理文件路径的最佳实践。

```python
import os
import pathlib

# 配置
ASTRO_DIR = pathlib.Path(os.getenv("ASTRO_DIR", "./astro")).expanduser().resolve()
if not ASTRO_DIR.is_dir():
    raise RuntimeError(
        f"ASTRO_DIR {ASTRO_DIR} does not exist or is not a directory"
    )
```

为了避免在每个工具函数中重复编写执行命令行指令的代码，我们定义了一个辅助函数 `_run`。它使用 `subprocess.run` 在指定的 `ASTRO_DIR` 目录中执行命令，并捕获其标准输出和错误流。返回的日志中包含了执行的命令本身，这对于调试和追踪非常有帮助。

```python
import subprocess
from typing import List

def _run(cmd: List[str]) -> str:
    """在ASTRO_DIR中运行命令并返回输出"""
    proc = subprocess.run(cmd, cwd=ASTRO_DIR, capture_output=True, text=True)
    banner = f"$ {' '.join(cmd)}\n"
    return banner + proc.stdout + proc.stderr
```

### 2. 工具一：`save_article` - 智能保存文章

这是最核心的工具之一。它接收目录、文件名和文章内容作为参数，并将其写入文件。

```python
@app.tool()
async def save_article(directory: str, content: str, filename: str) -> str:
    """Save article content to a file in the specified directory within ASTRO_DIR."""
    import datetime
    
    target_dir = ASTRO_DIR / directory
    target_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = target_dir / filename
    
    # 为Markdown文件添加frontmatter
    if filename.endswith(('.md', '.mdx')) and not content.startswith('---'):
        title = filename.replace('.md', '').replace('.mdx', '').replace('-', ' ').title()
        lines = content.split('\n')
        for line in lines[:5]:
            if line.startswith('# '):
                title = line[2:].strip()
                break
        
        frontmatter = f"""---
title: "{title}"
pubDate: {datetime.date.today().isoformat()}
description: "Article published via MCP"
author: "AI Assistant"
---

"""
        content = frontmatter + content
    
    file_path.write_text(content, encoding='utf-8')
    return f"Successfully saved article to: {file_path}"
```

这个函数最亮眼的部分是它**智能添加Frontmatter**的逻辑。Frontmatter是静态网站生成器（如Astro, Hugo, Jekyll）用来定义页面元数据（如标题、发布日期）的块。此脚本的逻辑是：
1. 检查文件是否为Markdown (`.md` 或 `.mdx`)。
2. 检查内容是否已经包含Frontmatter (`---`)。
3. 如果需要添加，它会智能地推断文章标题：优先使用文件名，但如果文章开头几行内找到了一个H1标题（`# `），则会使用该H1标题。
4. 自动生成包含标题、当前日期、描述和作者的Frontmatter，并将其添加到文章内容的最前面。

这个小小的功能极大地提升了AI生成文章的规范性，无需AI客户端操心Frontmatter的格式细节。

### 3. 工具二：`commit_code` - 自动化版本控制

文章保存后，下一步就是将其纳入版本控制。`commit_code` 工具封装了标准的Git工作流。

```python
@app.tool()
async def commit_code(message: str = "chore: automated commit") -> str:
    """Stage, commit, and push code changes in ASTRO_DIR."""
    outputs: List[str] = []
    
    outputs.append(_run(["git", "add", "-A"]))
    
    commit_result = _run(["git", "commit", "-m", message])
    outputs.append(commit_result)
    
    if "nothing to commit" not in commit_result:
        outputs.append(_run(["git", "push"]))
    else:
        outputs.append("No changes to push.\n")
    
    return "\n".join(outputs)
```

这个函数按顺序执行 `git add -A`、`git commit` 和 `git push`。它还包含一个实用的检查：只有当 `git commit` 成功创建了一个新的提交时（即输出中不包含 "nothing to commit"），它才会执行 `git push`，避免了不必要的推送操作。函数的返回值是所有Git命令的完整输出，便于AI客户端了解每一步的执行情况。

### 4. 工具三：`publish_article` - 一键发布

这是最简单但也是最终临门一脚的工具。它只做一件事：执行部署命令。

```python
@app.tool()
async def publish_article() -> str:
    """Deploy the Astro blog to production by running npm run deploy."""
    return _run(["npm", "run", "deploy"])
```

该工具假设你的Astro项目 `package.json` 文件中已经定义了一个名为 `deploy` 的脚本，该脚本负责处理所有构建和部署到生产环境的逻辑（例如，推送到Vercel、Netlify或你自己的服务器）。这种设计将部署的复杂性与MCP服务器本身解耦，非常灵活。

## 如何运行与使用

现在我们已经拥有了全套工具，如何让它工作起来呢？

### 1. 准备工作
- 确保你的系统安装了Python 3。
- 安装 `fastmcp` 库：`pip install fastmcp`。
- 准备一个Astro博客项目，并确保它是一个Git仓库。
- 在Astro项目的 `package.json` 中，添加一个 `deploy` 脚本。例如：
  ```json
  "scripts": {
    "dev": "astro dev",
    "start": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "deploy": "astro build && gh-pages -d dist --branch gh-pages"
  }
  ```

### 2. 运行MCP服务器
- 将 `astro_mcp_server.py` 脚本放置在你的工作区。
- 在终端中，设置 `ASTRO_DIR` 环境变量，指向你的博客项目根目录：
  ```bash
  export ASTRO_DIR="/path/to/your/astro-blog"
  ```
- 运行脚本：
  ```bash
  python3 astro_mcp_server.py
  ```

执行后，脚本不会有任何输出，它会静默地在后台等待来自标准输入的MCP指令。

### 3. 与MCP客户端交互

这个脚本本身是一个"服务器"，它需要一个"客户端"来与之对话。这个客户端通常是AI智能体所在的执行环境。客户端会启动 `astro_mcp_server.py` 作为一个子进程，然后通过该进程的标准输入（stdin）发送JSON-RPC格式的请求，并从其标准输出（stdout）读取结果。

例如，一个AI客户端想调用 `save_article` 工具时，可能会向脚本的stdin写入类似下面这样的JSON数据：
```json
{
  "jsonrpc": "2.0", 
  "method": "save_article", 
  "params": {
    "directory": "src/content/blog", 
    "filename": "new-ai-article.md", 
    "content": "# A New Beginning\n\nThis is my first article written by AI!"
  }, 
  "id": 1
}
```

脚本在收到指令后，会执行对应的 `save_article` 函数，并将执行结果（成功信息或错误）以JSON-RPC响应的格式写回stdout，供客户端解析。

## 总结

我们通过一个不到100行的Python脚本，成功地为Astro博客构建了一个功能强大的自动化MCP服务器。这个案例完美地诠释了"小而美"的工程哲学：

- **简单直接**：纯Python脚本，无复杂的框架或配置。
- **职责单一**：专注于提供与博客交互的工具，不处理其他无关逻辑。
- **善用现有工具**：通过 `subprocess` 巧妙地封装了 `git` 和 `npm` 等成熟的命令行工具，而不是在Python中重新发明轮子。
- **高度可扩展**：需要新功能？只需添加一个新的 `@app.tool()` 装饰的函数即可。

这种模式不仅限于Astro博客，你可以轻松地将其改造，用于自动化任何可以通过命令行或脚本操作的工作流——无论是管理云服务、操作数据库，还是控制本地的物联网设备。MCP和 `FastMCP` 为我们打开了一扇门，让AI能够更深入、更无缝地融入我们的数字生活和工作中。