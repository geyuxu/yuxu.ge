---
date: 2025-07-27
tags: [devops, mcp, python, astro, automation, fastmcp]
legacy: true
---

# Automating an Astro Blog with a Python MCP Server: A Hands-On Guide

Before diving into the code, let's get to know the core library, `fastmcp`. You can think of it as a magic wand: with a simple wave over a standard Python function (i.e., by using a decorator), that function is instantly wrapped into an MCP-compliant tool, ready to be called by an AI client.

The design philosophy of `FastMCP` is "minimalist yet powerful." It handles all the low-level details of the MCP protocol for you, such as JSON-RPC communication, tool discovery, and asynchronous execution. The only thing a developer needs to do is focus on writing the business logic of the tool functions.

In our script, the use of `FastMCP` is demonstrated in these two core lines of code:

```python
# 1. Initialize an MCP application instance
app = FastMCP(
    name="Astro Deployment MCP Server",
    instructions="Exposes publish_article and commit_code tools for an Astro blog",
)

# 2. Register a function as a tool using the @app.tool() decorator
@app.tool()
async def my_tool_function():
    # ... tool logic ...
    return "Tool execution result"
```

The `name` and `instructions` fields are metadata that tell the MCP client the purpose of this server and the capabilities it offers, which is very helpful for the AI to understand the context. The `@app.tool()` decorator is the heart of it all, automatically registering any `async` function it decorates as a tool that can be called remotely.

## The Goal: Automating the Astro Blog Workflow

Our goal is clear: to enable an AI to independently complete the entire process of publishing a new blog post. This process can be broken down into three core actions:
1. **Save the Article**: Save the AI-generated Markdown content to the specified directory in the Astro project.
2. **Commit the Code**: Stage (`add`), commit (`commit`), and push (`push`) the newly added article file using Git.
3. **Publish the Website**: Execute the deployment command to publish the latest blog content to the live server.

Next, we will analyze the tool functions that implement these three actions one by one.

## Code Implementation Deep Dive

Our MCP server is a standalone Python script, `astro_mcp_server.py`. Let's examine its structure.

### 1. Environment Configuration and Helper Functions

The script's first task is to determine the root directory of the Astro blog project. By reading the `ASTRO_DIR` environment variable, we achieve configuration flexibility while providing a default value of `./astro`. The script cleverly uses the `pathlib` library, which is the modern best practice for handling file paths in Python.

```python
import os
import pathlib

# Configuration
ASTRO_DIR = pathlib.Path(os.getenv("ASTRO_DIR", "./astro")).expanduser().resolve()
if not ASTRO_DIR.is_dir():
    raise RuntimeError(
        f"ASTRO_DIR {ASTRO_DIR} does not exist or is not a directory"
    )
```

To avoid repetitive code for executing command-line instructions in each tool function, we define a helper function `_run`. It uses `subprocess.run` to execute commands in the specified `ASTRO_DIR`, capturing their standard output and error streams. The returned log includes the command that was executed, which is invaluable for debugging and tracking.

```python
import subprocess
from typing import List

def _run(cmd: List[str]) -> str:
    """Runs a command in ASTRO_DIR and returns its output."""
    proc = subprocess.run(cmd, cwd=ASTRO_DIR, capture_output=True, text=True)
    banner = f"$ {' '.join(cmd)}\n"
    return banner + proc.stdout + proc.stderr
```

### 2. Tool #1: `save_article` - Intelligently Saving Articles

This is one of the most crucial tools. It accepts a directory, filename, and article content as parameters and writes them to a file.

```python
@app.tool()
async def save_article(directory: str, content: str, filename: str) -> str:
    """Save article content to a file in the specified directory within ASTRO_DIR."""
    import datetime
    
    target_dir = ASTRO_DIR / directory
    target_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = target_dir / filename
    
    # Add frontmatter to Markdown files
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

The most impressive part of this function is its logic for **intelligently adding frontmatter**. Frontmatter is the block used by static site generators (like Astro, Hugo, and Jekyll) to define page metadata such as title and publication date. The logic in this script is as follows:
1. Check if the file is a Markdown file (`.md` or `.mdx`).
2. Check if the content already includes frontmatter (`---`).
3. If frontmatter needs to be added, it intelligently infers the article title: it defaults to using the filename, but if an H1 heading (`# `) is found within the first few lines of the article, it will use that H1 as the title.
4. It automatically generates frontmatter containing the title, current date, a description, and the author, and prepends it to the article content.

This small feature greatly improves the quality of AI-generated articles, freeing the AI client from worrying about the details of frontmatter formatting.

### 3. Tool #2: `commit_code` - Automating Version Control

Once the article is saved, the next step is to get it into version control. The `commit_code` tool encapsulates the standard Git workflow.

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

This function executes `git add -A`, `git commit`, and `git push` in sequence. It also includes a practical check: it only executes `git push` if `git commit` successfully created a new commit (i.e., the output does not contain "nothing to commit"), thus avoiding unnecessary push operations. The function's return value is the complete output of all Git commands, allowing the AI client to understand the status of each step.

### 4. Tool #3: `publish_article` - One-Click Publishing

This is the simplest tool, but it delivers the final, critical step. It does only one thing: execute the deployment command.

```python
@app.tool()
async def publish_article() -> str:
    """Deploy the Astro blog to production by running npm run deploy."""
    return _run(["npm", "run", "deploy"])
```

This tool assumes that your Astro project's `package.json` file has a script named `deploy` defined, which handles all the logic for building and deploying to the production environment (e.g., pushing to Vercel, Netlify, or your own server). This design decouples the complexity of deployment from the MCP server itself, making it very flexible.

## How to Run and Use It

Now that we have a full set of tools, how do we get it working?

### 1. Prerequisites
- Ensure you have Python 3 installed on your system.
- Install the `fastmcp` library: `pip install fastmcp`.
- Prepare an Astro blog project and make sure it's a Git repository.
- In your Astro project's `package.json`, add a `deploy` script. For example:
  ```json
  "scripts": {
    "dev": "astro dev",
    "start": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "deploy": "astro build && gh-pages -d dist --branch gh-pages"
  }
  ```

### 2. Run the MCP Server
- Place the `astro_mcp_server.py` script in your workspace.
- In your terminal, set the `ASTRO_DIR` environment variable to point to your blog's root directory:
  ```bash
  export ASTRO_DIR="/path/to/your/astro-blog"
  ```
- Run the script:
  ```bash
  python3 astro_mcp_server.py
  ```

After execution, the script will not produce any output; it will wait silently in the background for MCP instructions from standard input.

### 3. Interact with an MCP Client

This script is a "server"; it needs a "client" to communicate with. This client is typically the execution environment where the AI agent resides. The client will launch `astro_mcp_server.py` as a subprocess, then send JSON-RPC formatted requests through the process's standard input (stdin) and read the results from its standard output (stdout).

For example, when an AI client wants to call the `save_article` tool, it might write JSON data like the following to the script's stdin:
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

Upon receiving the instruction, the script will execute the corresponding `save_article` function and write the result (a success message or an error) back to stdout in the JSON-RPC response format for the client to parse.

## Conclusion

With a Python script of less than 100 lines, we successfully built a powerful, automated MCP server for an Astro blog. This case study perfectly illustrates the "less is more" engineering philosophy:

- **Simple and Direct**: A pure Python script with no complex frameworks or configuration.
- **Single Responsibility**: Focuses solely on providing tools for interacting with the blog, without handling other unrelated logic.
- **Leverages Existing Tools**: Cleverly wraps mature command-line tools like `git` and `npm` via `subprocess` instead of reinventing the wheel in Python.
- **Highly Extensible**: Need a new feature? Just add a new function decorated with `@app.tool()`.

This pattern is not limited to Astro blogs. You can easily adapt it to automate any workflow that can be manipulated via the command line or scripts—whether it's managing cloud services, operating databases, or controlling local IoT devices. MCP and `FastMCP` open a door for us, allowing AI to integrate more deeply and seamlessly into our digital lives and work.