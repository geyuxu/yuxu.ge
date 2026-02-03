---
title: "One Night of Vibe Coding: Migrating Static Site Generator to Deno"
date: 2026-02-03
tags: [staticflow, deno, typescript, vibe-coding, open-source]
description: "Documenting the overnight journey of migrating a shell script-based static site generator to Deno"
---

# One Night of Vibe Coding: Migrating Static Site Generator to Deno

Started last night, finished today. One night of vibe coding, and I've successfully migrated my static site generator from shell scripts to the Deno platform.

## Migration Results

- ✅ Completely removed all shell script dependencies
- ✅ Eliminated Node.js code entirely
- ✅ Clean, modern TypeScript codebase
- ⏳ Still working on removing some external program dependencies

## Why Migrate?

I've been using my own shell script-based static blog generator (powering [yuxu.ge](https://yuxu.ge)) for a while, and it works pretty well. But after comparing with mainstream solutions, I found a critical problem:

|              | Hugo | Jekyll | Astro | Gatsby | StaticFlow |
|--------------|------|--------|-------|--------|------------|
| Build Speed  | Fast | Slow   | Fast  | Slow   | Fast       |
| Formats      | MD   | MD     | MD    | MD     | 40+        |
| Notebook     | ✗    | ✗      | Plugin| Plugin | Native     |
| Search       | ✗    | ✗      | ✗     | ✗      | Hybrid     |
| AI Features  | ✗    | ✗      | ✗     | ✗      | RAG + i18n |

Feature-wise, it already surpasses mainstream solutions. But there's a fatal flaw: **too many dependencies**.

Currently requires Node.js + ImageMagick + LibreOffice. Asking users to install all these? Unacceptable.

## Deno Migration Plan

The goal is clear:

```bash
curl -fsSL https://xxx/install.sh | sh
staticflow build
# Done. Zero dependencies.
```

Feature parity with Astro/Gatsby. UX parity with Hugo.

### Why Deno

```bash
# One command to compile to single binary
deno compile -A -o staticflow scripts/cli.ts
```

Generates a single binary file, no runtime installation needed. Exactly what I need.

## Code Refactoring

### Before: Chaotic State

```
Old architecture:
├── build.sh          # Main build script
├── compress.sh       # Image compression
├── convert-heic.sh   # HEIC conversion
├── blog/build.ts     # Node.js script
└── Various scattered scripts...
```

Shell and Node.js mixed together, messy dependency management, poor cross-platform compatibility.

### After: Clean Structure

```
New architecture:
├── scripts/
│   ├── cli.ts              # Unified CLI entry
│   ├── config.ts           # Config loading
│   ├── build.ts            # Build logic
│   ├── build-static.ts     # Static HTML generation
│   ├── build-posts-json.ts # Blog index
│   ├── build-photos-json.ts# Gallery index
│   ├── compress-photos.ts  # Image compression
│   ├── convert-heic.ts     # HEIC conversion
│   └── index-builder.ts    # Search index builder
├── staticflow.config.yaml  # Unified config
└── deno.json               # Deno task config
```

All code unified in TypeScript, one config file controls everything.

### Unified Configuration Design

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

Frontend reads config via `features.json` to dynamically enable/disable feature modules:

```typescript
// Generate features.json at build time
const featuresJson = JSON.stringify(config.features, null, 2);
await Deno.writeTextFile(join(distDir, "features.json"), featuresJson);
```

## Deployment Optimization: Git Worktree Approach

This is the biggest optimization in this migration.

### Problem: File Copying Too Slow

The original deployment flow:

```
1. Create temp directory
2. Clone gh-pages branch to temp (slow!)
3. Clear temp directory
4. Copy dist/* to temp (slow!)
5. Commit & push
6. Cleanup temp directory
```

Each deployment took **12 seconds**, most time spent on cloning and copying files.

### Solution: Worktree

Git Worktree allows checking out multiple branches to different directories in the same repo:

```bash
# Checkout gh-pages branch to dist directory
git worktree add dist gh-pages
```

Now `dist` directory IS the gh-pages branch working directory. Build outputs directly here, no copying needed for deploy!

### Implementation Details

**1. Detect if dist is a worktree**

```typescript
const distGitFile = join(distDir, ".git");
if (existsSync(distGitFile)) {
  const content = await Deno.readTextFile(distGitFile);
  if (content.includes("gitdir:")) {
    // It's a worktree, check the branch
    const branch = await getBranch(distDir);
    if (branch === "gh-pages") {
      distIsWorktree = true;
    }
  }
}
```

A worktree's `.git` is a file (not a directory), containing something like:
```
gitdir: /path/to/repo/.git/worktrees/dist
```

**2. Auto-setup worktree**

Automatically detect and setup on first deploy:

```typescript
if (!existsSync(distDir) || !isWorktree(distDir)) {
  console.log("Setting up dist/ as gh-pages worktree...");
  await setupDeploy();
}
```

**3. setupDeploy implementation**

```typescript
async function setupDeploy() {
  // Check if local gh-pages branch exists
  const localExists = await branchExists("gh-pages");

  if (!localExists) {
    // Check remote
    const remoteExists = await remoteBranchExists("gh-pages");
    if (remoteExists) {
      // Fetch remote branch
      await run("git", ["fetch", "origin", "gh-pages:gh-pages"]);
    } else {
      // Create orphan branch and push
      await createOrphanBranch("gh-pages");
    }
  }

  // Create worktree
  await run("git", ["worktree", "add", distDir, "gh-pages"]);
}
```

**4. Skip .git during build**

Critical: Must skip `.git` when copying theme files, otherwise worktree breaks:

```typescript
async function copyDir(src: string, dest: string) {
  for await (const entry of Deno.readDir(src)) {
    if (entry.name === ".git") continue;  // Skip!
    // ... copy files
  }
}
```

**5. Optimized deploy flow**

```typescript
if (distIsWorktree) {
  // Operate directly in dist, no copying needed
  console.log("dist/ is gh-pages worktree, deploying directly...");

  // Sync with remote
  await run("git", ["pull", "--rebase", "origin", "gh-pages"], distDir);

  // Commit
  await run("git", ["add", "-A"], distDir);
  await run("git", ["commit", "-m", message], distDir);

  // Push
  const pushResult = await run("git", ["push", "origin", "gh-pages"], distDir);

  if (!pushResult.success) {
    // Ask for force push on conflict
    const answer = await prompt("Force push? [y/N]");
    if (answer === "y") {
      await run("git", ["push", "--force", "origin", "gh-pages"], distDir);
    }
  }
}
```

### Performance Comparison

| Operation | Before | After |
|-----------|--------|-------|
| Check branch | clone (slow) | git ls-remote (fast) |
| Prepare directory | copy files | use worktree directly |
| Total time | **12 seconds** | **3 seconds** |

## CLI Design

Following Unix philosophy, commands are concise:

```bash
# Build
staticflow build              # Full build
staticflow build --static     # Static HTML only
staticflow build --photos     # Process images only

# Development
staticflow serve              # Dev server :8080
staticflow serve --port=3000  # Custom port

# Deploy
staticflow deploy             # Deploy to gh-pages
staticflow deploy --build     # Build and deploy (recommended)
staticflow deploy -m "msg"    # Custom commit message

# Setup
staticflow setup              # Check dependencies
staticflow setup-deploy       # Manually setup worktree
staticflow init               # Initialize project
staticflow clean              # Clean generated files
```

One command does it all:

```bash
staticflow deploy --build
# Auto: setup worktree → build → commit → push
```

## Current Features

The project is already quite functional:

- **Multi-format content** - Markdown, Jupyter Notebook, LaTeX, Office documents
- **Hybrid search** - BM25 keyword + Voy vector semantic search (WASM)
- **AI chat assistant** - RAG-based Q&A
- **Photo gallery** - Auto-compression, HEIC conversion, AI-generated descriptions
- **Multi-language translation** - AI-powered content translation

## Remaining External Dependencies

Some features still depend on external programs:

| Feature | Current Dependency | Planned Solution |
|---------|-------------------|------------------|
| Image compression | ImageMagick | WASM |
| HEIC conversion | ImageMagick | libde265 WASM |
| Office to PDF | LibreOffice | TBD |
| LaTeX compilation | pdflatex | TeX WASM |

Next step: Trim core format conversion code and compile to WASM, embedding into a single ~15MB binary.

For example, HEIC decoding: plan to trim libde265 (HEVC decoder) from 50K lines of C code to 15K lines, removing multi-threading, SIMD, encoder modules, compiling to ~300KB WASM.

## AI-Assisted Development

This migration heavily used Claude Code as an AI pair programming partner. Key takeaways:

1. **Describe intent, not implementation** - Say "deployment is slow because of file copying", AI suggests worktree approach
2. **Incremental iteration** - Implement basic functionality first, optimize after tests pass
3. **Immediate testing** - Run `staticflow deploy --build` after every change
4. **Maintain context** - AI remembers previous discussions, can say "continue with the previous approach"

Completing this migration overnight wouldn't be possible without AI.

## Lessons Learned

### 1. Compiled binary needs regeneration

After code changes, `staticflow` command still runs old version:

```bash
# Must recompile
deno task compile
```

I configured auto-deletion of old files in `deno.json`:

```json
{
  "tasks": {
    "compile": "rm -f /opt/staticflow/bin/staticflow && deno compile -A -o /opt/staticflow/bin/staticflow scripts/cli.ts"
  }
}
```

### 2. Stale worktree causes creation failure

If previous worktree wasn't cleaned up, creating new one fails:

```typescript
// Prune stale worktrees first
await run("git", ["worktree", "prune"]);
await run("git", ["worktree", "add", distDir, "gh-pages"]);
```

### 3. WASM MIME type

Dev server must correctly configure MIME types, otherwise browser refuses to load:

```typescript
const mimeTypes = {
  ".wasm": "application/wasm",  // Not octet-stream!
};
```

## Open Source Plan

Open source release coming soon! Stay tuned 🔜

---

*#Deno #TypeScript #StaticSiteGenerator #VibeCoding #OpenSource*
