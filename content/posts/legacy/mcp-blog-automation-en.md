---
date: 2024-01-01
tags: [devops, mcp, astro, automation, github pages, devops]
legacy: true
---

# MCP-Blog: One-Command Astro Blog Deployment to GitHub Pages

1. After writing a new post in my blog project `geyuxu.com`
2. Run `git add .`, `git commit -m "..."`, and `git push` to push the source code to the main branch
3. Execute `npm run build` to generate static files in the `dist` directory
4. Push the contents of the `dist` directory to the `gh-pages` branch for deployment

This process not only involves multiple commands but is also prone to issues, especially if the `dist` directory isn't managed correctly by Git. More importantly, I wanted a central "management hub" to handle tasks like this, rather than cluttering my project directories with various scripts.

This led me to create the **MCP-Blog** project. Its core goal is to: **Automate the entire commit-and-deploy workflow for one project directory from a completely separate, dedicated management directory, using a single command.**

This approach solves two major pain points:
1. **Operational Isolation**: Separates management scripts from blog content, keeping the blog repository clean and focused
2. **Process Automation**: Simplifies a multi-step process into a single action, reducing human error and increasing efficiency

## 2. Technical Architecture: The MCP Design Philosophy

### What is MCP (Model Context Protocol)?

The "Model-Context Protocol" (MCP) is not a public network protocol, but rather a **command-line interaction specification** I designed for this project. Its core philosophy is:

> Enable an independent execution script (Model) to understand and operate on a target project within a specific context (Context).

In this project:
- **Model**: Our `mcp-blog` project, which acts as the active executor
- **Context**: Our `geyuxu.com` blog project, which is the target being operated on
- **Protocol**: The command-line interface and script execution logic we define. For example, `./mcp.sh "commit message"` is an implementation of this protocol

### Architecture Diagram

The workflow is straightforward:

```
+-----------+       +-------------------------+       +---------------------+       +----------------+
|           |       |                         |       |                     |       |                |
|   User    |------>|  MCP Script (mcp.sh)    |------>|  Astro Blog Project |------>|  GitHub Repo   |
|           |       |                         |       | (geyuxu.com)        |       | (main/gh-pages)|
+-----------+       +-------------------------+       +---------------------+       +----------------+
      |                        |                                |                           |
      | 1. Provide commit msg  | 2. cd to blog directory       | 3. Git ops & build       | 4. Deploy to Pages
      |                        | 4. Execute deploy commands     |                           |
```

The key is how the **MCP script** effectively "traverses" into the **Astro blog project** directory to execute operations.

## 3. Implementation Details: Building the Automation Tool

Let's examine the core implementation. The entire project is driven by a single Shell script.

**Project Structure:**
```
/Users/geyuxu/repo/blog/
├── mcp-blog/         # MCP project
│   └── mcp.sh
└── geyuxu.com/       # Astro blog project
    ├── src/
    ├── public/
    ├── package.json
    └── ...
```

### 1. Core Script `mcp.sh`

This is the heart of our automation. It handles parameter reception, directory switching, command execution, and error handling.

```bash
#!/bin/bash

# Exit immediately on error
set -e

# --- Configuration ---
# Define MCP project path (where the script resides)
MCP_PROJECT_PATH="/Users/geyuxu/repo/blog/mcp-blog"
# Define blog repository path (target to operate on)
BLOG_REPO_PATH="/Users/geyuxu/repo/blog/geyuxu.com"
# --- End Configuration ---

# 1. Check input parameters: commit message is required
if [ -z "$1" ]; then
  echo "❌ Error: Please provide a commit message."
  echo "Usage: ./mcp.sh \"your commit message\""
  exit 1
fi

COMMIT_MESSAGE=$1

echo "🚀 MCP-Blog task starting..."
echo "================================="

# 2. Cross-directory permission management core
echo "📂 Entering blog repository: $BLOG_REPO_PATH"
cd "$BLOG_REPO_PATH"

# 3. Git automation: commit source code
echo "🔄 Syncing source code to main branch..."
git add .
git commit -m "$COMMIT_MESSAGE"
git push origin main

echo "✅ Source sync complete."
echo "================================="

# 4. Astro blog system integration: build project
echo "🛠️  Building Astro project..."
npm run build

echo "✅ Build complete."
echo "================================="

# 5. GitHub Pages deployment
echo "🚀 Deploying to GitHub Pages..."
# We use the gh-pages package to simplify deployment
# It automatically pushes dist directory contents to gh-pages branch
npm run deploy

echo "✅ Deployment successful!"
echo "================================="
echo "🎉 All tasks completed, blog updated!"

# Return to original directory (optional, good practice)
cd "$MCP_PROJECT_PATH"
```

### 2. Key Technical Points

- **Cross-directory Permission Management (`cd "$BLOG_REPO_PATH"`)**:
  This seemingly simple `cd` command is key to cross-directory operations. After the script starts, it first switches the current working directory to the blog project. This way, all subsequent `git` and `npm` commands execute as if they were run directly in the `geyuxu.com` directory, naturally gaining the "context permissions" to operate on that directory's files.

- **Git Automation (`git add/commit/push`)**:
  The script handles source code commits using standard Git commands. Passing the commit message as the script's first parameter (`$1`) adds flexibility.

- **Astro Integration (`npm run build`)**:
  Every Astro project has a `build` script defined in `package.json`. Our automation script calls it directly without concerning itself with the complex internal build process, achieving perfect decoupling.

- **GitHub Pages Deployment (`npm run deploy`)**:
  To simplify deployment, I highly recommend using the `gh-pages` npm package.
  
  First, install it in your **Astro project (`geyuxu.com`)**:
  ```bash
  npm install gh-pages --save-dev
  ```
  Then, add a `deploy` command to your `geyuxu.com/package.json` scripts:
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
  The `gh-pages -d dist` command automatically pushes the `dist` directory contents to the `gh-pages` branch.

## 4. Usage Example: Running MCP-Blog

Assuming you've completed the above configuration, publishing a new blog post is now as simple as breathing.

1. **Grant execution permissions to the script** (only needed once):
   ```bash
   cd /Users/geyuxu/repo/blog/mcp-blog
   chmod +x mcp.sh
   ```

2. **One-command publishing**:
   After finishing your writing in `geyuxu.com`, open the terminal and run:
   ```bash
   ./mcp.sh "feat: add new article about MCP-Blog"
   ```

Then, grab a coffee and watch the terminal automate everything:

```
🚀 MCP-Blog task starting...
=================================
📂 Entering blog repository: /Users/geyuxu/repo/blog/geyuxu.com
🔄 Syncing source code to main branch...
[main 1234567] feat: add new article about MCP-Blog
 1 file changed, 1 insertion(+)
 ...
✅ Source sync complete.
=================================
🛠️  Building Astro project...
> geyuxu.com@0.0.1 build
> astro build
...
✅ Build complete.
=================================
🚀 Deploying to GitHub Pages...
> geyuxu.com@0.0.1 deploy
> gh-pages -d dist
Published
✅ Deployment successful!
=================================
🎉 All tasks completed, blog updated!
```

A few minutes later, your new article will be live online.

## 5. Summary and Future Directions

The **MCP-Blog** project successfully automates the complex blog publishing workflow through a simple Shell script, achieving:
- **Efficiency Boost**: Reduces 5-6 steps to a single command
- **Error Reduction**: Automated operations prevent manual omissions or mistakes
- **Clean Code**: Separates management logic from business logic (blog content)

**Future exploration directions:**
1. **Feature Enhancement**: Add a command to create new articles, e.g., `./mcp.sh new "Article Title"`, which automatically generates a Markdown template with frontmatter
2. **Platform Upgrade**: Upgrade from Shell script to a more robust Node.js or Python CLI tool with richer interaction and error handling
3. **CI/CD Integration**: While local scripts are convenient, the ultimate automation solution is migrating to GitHub Actions. When the `main` branch receives new pushes, it automatically triggers the build and deployment workflow

I hope this small project inspires you. Automation is second nature to us engineers—by delegating repetitive work to machines, we can focus on creating more valuable content.