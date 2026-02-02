# StaticFlow Deno 单文件方案

> 零外部依赖的静态站点生成器技术方案

## 1. 架构总览

### 1.1 设计目标

```
用户体验目标：
┌─────────────────────────────────────────────────────────────┐
│  curl -fsSL https://staticflow.dev/install.sh | sh         │
│  staticflow build                                           │
│  # 完成。无需安装 Node、ImageMagick、LibreOffice 等         │
└─────────────────────────────────────────────────────────────┘

插件按需加载：
┌─────────────────────────────────────────────────────────────┐
│  staticflow plugin install latex-full                       │
│  staticflow build --input paper.tex  # 完整 LaTeX 编译     │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技术架构：Core + Plugin

```
┌─────────────────────────────────────────────────────────────┐
│                 staticflow Core (单文件可执行)               │
│                         ~15MB                               │
├─────────────────────────────────────────────────────────────┤
│  Deno Runtime (嵌入)                                        │
│  ├── V8 JavaScript Engine                                  │
│  ├── WASM Runtime                                          │
│  └── 文件系统/网络 API                                      │
├─────────────────────────────────────────────────────────────┤
│  核心转换引擎 (内嵌 WASM + TypeScript)                       │
│  ├── image-core.wasm      (~800KB)  JPG/PNG 处理           │
│  ├── heic-decoder.wasm    (~1.5MB)  HEIC 解码 (libheif-js) │
│  └── katex-core           (~300KB)  LaTeX 公式渲染          │
├─────────────────────────────────────────────────────────────┤
│  文档处理层 (TypeScript，内嵌)                               │
│  ├── docx/      DOCX → HTML (mammoth 精简)                 │
│  ├── xlsx/      XLSX → HTML/JSON (SheetJS 精简)            │
│  ├── pptx/      PPTX → 文本+图片提取 (基础支持)             │
│  ├── jupyter/   Jupyter → HTML (静态渲染)                  │
│  └── markdown/  Markdown → HTML                            │
├─────────────────────────────────────────────────────────────┤
│  构建管道 (TypeScript)                                      │
│  ├── content-discovery    内容发现与元数据                  │
│  ├── search-indexer       混合搜索索引构建                  │
│  ├── static-generator     静态 HTML 生成                   │
│  └── asset-pipeline       资源处理管道                     │
├─────────────────────────────────────────────────────────────┤
│  插件加载器                                                 │
│  └── plugin-loader.ts     按需加载可选 WASM 模块            │
└─────────────────────────────────────────────────────────────┘

        ↓ 可选插件 (按需下载) ↓

┌─────────────────────────────────────────────────────────────┐
│  pptx-full.wasm   (~100MB)  LibreOffice WASM - 完整渲染    │
├─────────────────────────────────────────────────────────────┤
│  latex-full.wasm  (~30MB)   Tectonic WASM + TeX 宏包       │
├─────────────────────────────────────────────────────────────┤
│  raw-full.wasm    (~5MB)    LibRaw WASM - 完整 RAW 支持    │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 模块体积预算

#### Core 核心 (~15MB)

| 模块 | 预算 | 说明 |
|------|------|------|
| Deno 运行时 | ~12MB | V8 + 标准库 |
| image-core.wasm | ~800KB | stb_image + resize |
| heic-decoder.wasm | ~1.5MB | libheif-js (验证优先) |
| katex-core | ~300KB | LaTeX 公式渲染 |
| JS 文档处理 | ~400KB | DOCX/XLSX/PPTX/Jupyter 解析 |
| **Core 总计** | **~15MB** | 覆盖 90% 场景 |

#### Plugins 可选插件 (~135MB)

| 插件 | 体积 | 功能 | 成熟度 |
|------|------|------|--------|
| pptx-full.wasm | ~100MB | LibreOffice WASM 完整 PPTX 渲染 | 实验性 |
| latex-full.wasm | ~30MB | Tectonic WASM + 核心宏包 | 成熟 |
| raw-full.wasm | ~5MB | LibRaw WASM 完整 RAW 格式 | 成熟 |
| **Plugins 总计** | **~135MB** | 专业级功能 |

#### 组合选项

| 版本 | 体积 | 适用场景 |
|------|------|---------|
| Core Only | ~15MB | 博客、文档站点 |
| Core + LaTeX | ~45MB | 学术写作 |
| Core + RAW | ~20MB | 摄影博客 |
| Full Bundle | ~150MB | 全功能（仍远小于 LibreOffice 500MB）|

---

## 2. 插件架构

### 2.1 Core vs Plugin 边界

```
功能分层原则：
┌─────────────────────────────────────────────────────────────┐
│  Core 核心标准：                                             │
│  ├── 体积 < 2MB (WASM 模块)                                 │
│  ├── 纯 JS/TS 可实现，或有成熟轻量 WASM                      │
│  ├── 覆盖 90% 常见使用场景                                   │
│  └── 功能完整度可接受（基础解析/提取）                        │
├─────────────────────────────────────────────────────────────┤
│  Plugin 插件标准：                                           │
│  ├── 体积 > 5MB (需要大型库)                                 │
│  ├── 依赖复杂 C/C++ 项目编译                                 │
│  ├── 满足 10% 专业场景需求                                   │
│  └── 完整功能支持（完整渲染/编译）                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 格式支持矩阵

| 格式 | Core 支持 | Plugin 扩展 | 说明 |
|------|-----------|-------------|------|
| **Markdown** | ✅ 完整 | - | marked.js/unified |
| **Jupyter** | ✅ 完整 | - | JSON 解析 + 静态渲染 |
| **JPG/PNG** | ✅ 完整 | - | stb_image WASM |
| **HEIC** | ✅ 完整 | - | libheif-js (~1.5MB) |
| **DOCX** | ✅ 完整 | - | mammoth.js 精简版 |
| **XLSX** | ✅ 完整 | - | SheetJS 精简版 |
| **LaTeX 公式** | ✅ 完整 | - | KaTeX (~300KB) |
| **PPTX** | ⚠️ 基础 | ✅ 完整 | Core: 文本+图片提取; Plugin: 完整布局渲染 |
| **LaTeX 文档** | ⚠️ 基础 | ✅ 完整 | Core: 简单结构; Plugin: Tectonic 完整编译 |
| **RAW** | ⚠️ 基础 | ✅ 完整 | Core: 嵌入 JPEG 预览; Plugin: 完整解码 |

### 2.3 插件可行性分析

#### 2.3.1 PPTX 完整渲染 (pptx-full.wasm)

```
技术路线：LibreOffice WASM
├── 项目：LibreOffice Online (Collabora)
├── 状态：实验性，但可用
├── 体积：~100MB (压缩后 ~40MB gzip)
├── 能力：
│   ├── 完整 PPTX 解析（母版、动画、SmartArt）
│   ├── 精确布局渲染
│   ├── 输出 PNG/PDF
│   └── 支持 PPTX/ODP/PPT 格式
├── 限制：
│   ├── 加载时间较长 (~5s)
│   ├── 内存占用 ~500MB
│   └── 某些高级效果可能不完美
└── 替代方案：无轻量替代，这是唯一可行路线

Core 基础功能 (无 Plugin)：
├── 提取所有文本内容
├── 提取内嵌图片
├── 基础幻灯片结构
└── 输出：文本列表 + 图片目录（非视觉渲染）
```

#### 2.3.2 LaTeX 完整编译 (latex-full.wasm)

```
技术路线：Tectonic WASM
├── 项目：https://tectonic-typesetting.github.io
├── 状态：成熟，生产可用
├── 体积：
│   ├── 引擎：~8MB
│   └── 核心宏包：~20MB (article, report, beamer 等)
│   └── 总计：~30MB
├── 能力：
│   ├── 完整 LaTeX 编译
│   ├── 支持大多数常用宏包
│   ├── 输出 PDF
│   └── 支持 BibTeX 引用
├── 限制：
│   ├── 不支持某些冷门宏包
│   └── 首次编译需下载宏包
└── 成熟度：高（已在多个项目中使用）

Core 基础功能 (无 Plugin)：
├── KaTeX 渲染所有数学公式
├── 解析基础文档结构 (\section, \subsection 等)
├── 处理简单环境 (itemize, enumerate, figure)
└── 输出：HTML 文章（非 PDF）
```

#### 2.3.3 RAW 完整解码 (raw-full.wasm)

```
技术路线：LibRaw WASM
├── 项目：https://www.libraw.org/
├── 状态：成熟，有现成 WASM 构建
├── 体积：~5MB
├── 能力：
│   ├── 支持 600+ 相机 RAW 格式
│   ├── Sony ARW, Canon CR2/CR3, Nikon NEF, Fuji RAF...
│   ├── 完整色彩处理
│   └── 输出高质量 JPEG/PNG
├── 限制：
│   ├── 超大文件内存占用高
│   └── 处理速度较慢 (~5s/张)
└── 成熟度：高

Core 基础功能 (无 Plugin)：
├── 提取 RAW 文件内嵌的 JPEG 预览
├── 无需解码 RAW 数据
└── 质量：预览级（通常 1-2MP，足够缩略图）
```

### 2.4 插件生命周期

```typescript
// src/plugin/loader.ts

interface Plugin {
  name: string;
  version: string;
  wasmUrl: string;
  size: number;
  checksum: string;
}

const PLUGIN_REGISTRY: Record<string, Plugin> = {
  "pptx-full": {
    name: "pptx-full",
    version: "1.0.0",
    wasmUrl: "https://plugins.staticflow.dev/pptx-full-1.0.0.wasm",
    size: 100_000_000,
    checksum: "sha256:..."
  },
  "latex-full": {
    name: "latex-full",
    version: "1.0.0",
    wasmUrl: "https://plugins.staticflow.dev/latex-full-1.0.0.wasm",
    size: 30_000_000,
    checksum: "sha256:..."
  },
  "raw-full": {
    name: "raw-full",
    version: "1.0.0",
    wasmUrl: "https://plugins.staticflow.dev/raw-full-1.0.0.wasm",
    size: 5_000_000,
    checksum: "sha256:..."
  }
};

class PluginManager {
  private pluginDir: string;
  private loadedPlugins: Map<string, WebAssembly.Module> = new Map();

  constructor() {
    this.pluginDir = Deno.env.get("STATICFLOW_PLUGIN_DIR")
      || `${Deno.env.get("HOME")}/.staticflow/plugins`;
  }

  // 检查插件是否已安装
  async isInstalled(name: string): Promise<boolean> {
    try {
      await Deno.stat(`${this.pluginDir}/${name}.wasm`);
      return true;
    } catch {
      return false;
    }
  }

  // 安装插件
  async install(name: string, options: { progress?: boolean } = {}): Promise<void> {
    const plugin = PLUGIN_REGISTRY[name];
    if (!plugin) throw new Error(`Unknown plugin: ${name}`);

    console.log(`📦 Installing ${name} (${this.formatSize(plugin.size)})...`);

    // 下载
    const response = await fetch(plugin.wasmUrl);
    const data = new Uint8Array(await response.arrayBuffer());

    // 校验
    const hash = await this.sha256(data);
    if (hash !== plugin.checksum) {
      throw new Error(`Checksum mismatch for ${name}`);
    }

    // 保存
    await Deno.mkdir(this.pluginDir, { recursive: true });
    await Deno.writeFile(`${this.pluginDir}/${name}.wasm`, data);

    console.log(`✅ ${name} installed successfully`);
  }

  // 加载插件
  async load(name: string): Promise<WebAssembly.Module> {
    if (this.loadedPlugins.has(name)) {
      return this.loadedPlugins.get(name)!;
    }

    if (!await this.isInstalled(name)) {
      throw new Error(
        `Plugin ${name} not installed. Run: staticflow plugin install ${name}`
      );
    }

    const wasmBytes = await Deno.readFile(`${this.pluginDir}/${name}.wasm`);
    const module = await WebAssembly.compile(wasmBytes);
    this.loadedPlugins.set(name, module);

    return module;
  }

  // 按需加载（自动安装）
  async loadOrInstall(name: string): Promise<WebAssembly.Module> {
    if (!await this.isInstalled(name)) {
      const consent = confirm(
        `Plugin ${name} is required. Install now? (${this.formatSize(PLUGIN_REGISTRY[name].size)})`
      );
      if (!consent) throw new Error(`Plugin ${name} is required`);
      await this.install(name);
    }
    return this.load(name);
  }

  private formatSize(bytes: number): string {
    if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(0)}MB`;
    if (bytes > 1_000) return `${(bytes / 1_000).toFixed(0)}KB`;
    return `${bytes}B`;
  }

  private async sha256(data: Uint8Array): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", data);
    return `sha256:${Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, "0")).join("")}`;
  }
}

export const pluginManager = new PluginManager();
```

### 2.5 CLI 插件命令

```bash
# 列出可用插件
staticflow plugin list
# 输出:
# NAME         SIZE    STATUS      DESCRIPTION
# pptx-full    100MB   not installed   Complete PPTX rendering (LibreOffice)
# latex-full   30MB    installed       Full LaTeX compilation (Tectonic)
# raw-full     5MB     not installed   RAW camera format support (LibRaw)

# 安装插件
staticflow plugin install latex-full
# 📦 Installing latex-full (30MB)...
# ████████████████████ 100%
# ✅ latex-full installed successfully

# 卸载插件
staticflow plugin remove pptx-full

# 更新所有插件
staticflow plugin update
```

### 2.6 分发策略

#### 策略 A: 按需下载（推荐）

```
Core 安装 (~15MB) → 首次使用插件功能时提示下载

优点：
├── 初始下载最小
├── 用户只下载需要的功能
└── 磁盘占用最优

缺点：
├── 首次使用某功能时有延迟
└── 需要网络连接
```

#### 策略 B: 完整安装

```
install.sh --full → 下载 Core + 全部插件 (~150MB)

优点：
├── 离线可用所有功能
└── 无首次使用延迟

缺点：
├── 初始下载较大
└── 可能下载不需要的功能
```

#### 策略 C: 选择性安装

```
install.sh --with latex-full,raw-full → 自选插件组合

优点：
├── 用户完全控制
└── 适合离线部署场景

缺点：
├── 安装步骤略复杂
```

### 2.7 插件开发者接口

```typescript
// 第三方插件开发接口（未来扩展）

interface StaticFlowPlugin {
  name: string;
  version: string;

  // 声明处理的文件类型
  fileTypes: string[];  // [".xyz", ".abc"]

  // 初始化
  init(context: PluginContext): Promise<void>;

  // 处理文件
  process(file: FileInput): Promise<ProcessResult>;

  // 清理资源
  destroy(): Promise<void>;
}

// 示例：假设的 CAD 文件插件
const cadPlugin: StaticFlowPlugin = {
  name: "cad-viewer",
  version: "1.0.0",
  fileTypes: [".dwg", ".dxf"],

  async init(ctx) {
    this.wasm = await ctx.loadWasm("./cad-core.wasm");
  },

  async process(file) {
    const svg = await this.wasm.convertToSvg(file.data);
    return { html: svg, assets: [] };
  },

  async destroy() {
    this.wasm.cleanup();
  }
};
```

---

## 3. Tier 1 实现：核心功能

### 3.1 Jupyter Notebook 渲染

**纯 TypeScript 实现（零 WASM 依赖）：**

```typescript
// src/jupyter/mod.ts

interface JupyterCell {
  cell_type: "code" | "markdown" | "raw";
  source: string[];
  outputs?: JupyterOutput[];
  execution_count?: number;
}

interface JupyterOutput {
  output_type: "execute_result" | "stream" | "display_data" | "error";
  data?: Record<string, string | string[]>;  // mime-type → content
  text?: string[];
  name?: string;  // stdout/stderr
}

interface JupyterNotebook {
  cells: JupyterCell[];
  metadata: {
    kernelspec?: { language: string; display_name: string };
  };
}

export class JupyterRenderer {
  private highlighter: CodeHighlighter;

  constructor() {
    this.highlighter = new CodeHighlighter();
  }

  async render(data: Uint8Array): Promise<string> {
    const notebook: JupyterNotebook = JSON.parse(
      new TextDecoder().decode(data)
    );

    const language = notebook.metadata.kernelspec?.language || "python";
    let html = '<article class="jupyter-notebook">';

    for (const cell of notebook.cells) {
      html += this.renderCell(cell, language);
    }

    html += '</article>';
    return html;
  }

  private renderCell(cell: JupyterCell, language: string): string {
    switch (cell.cell_type) {
      case "markdown":
        return this.renderMarkdown(cell);
      case "code":
        return this.renderCode(cell, language);
      case "raw":
        return `<pre class="raw-cell">${this.escape(cell.source.join(""))}</pre>`;
    }
  }

  private renderMarkdown(cell: JupyterCell): string {
    const source = cell.source.join("");
    // 使用内置 Markdown 渲染器
    return `<div class="markdown-cell">${marked(source)}</div>`;
  }

  private renderCode(cell: JupyterCell, language: string): string {
    const source = cell.source.join("");
    const execCount = cell.execution_count ?? " ";

    let html = `
      <div class="code-cell">
        <div class="input">
          <span class="prompt">In [${execCount}]:</span>
          <pre><code class="language-${language}">${
            this.highlighter.highlight(source, language)
          }</code></pre>
        </div>`;

    if (cell.outputs?.length) {
      html += '<div class="output">';
      for (const output of cell.outputs) {
        html += this.renderOutput(output);
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  private renderOutput(output: JupyterOutput): string {
    switch (output.output_type) {
      case "execute_result":
      case "display_data":
        return this.renderDisplayData(output);
      case "stream":
        const cls = output.name === "stderr" ? "stderr" : "stdout";
        return `<pre class="${cls}">${this.escape(output.text?.join("") || "")}</pre>`;
      case "error":
        return `<pre class="error">${this.escape(output.text?.join("\n") || "")}</pre>`;
    }
    return "";
  }

  private renderDisplayData(output: JupyterOutput): string {
    if (!output.data) return "";

    // 优先级：HTML > Image > SVG > LaTeX > Text
    if (output.data["text/html"]) {
      const html = Array.isArray(output.data["text/html"])
        ? output.data["text/html"].join("")
        : output.data["text/html"];
      return `<div class="html-output">${html}</div>`;
    }

    if (output.data["image/png"]) {
      const data = output.data["image/png"];
      const base64 = Array.isArray(data) ? data.join("") : data;
      return `<img src="data:image/png;base64,${base64}" class="output-image">`;
    }

    if (output.data["image/svg+xml"]) {
      const svg = Array.isArray(output.data["image/svg+xml"])
        ? output.data["image/svg+xml"].join("")
        : output.data["image/svg+xml"];
      return `<div class="svg-output">${svg}</div>`;
    }

    if (output.data["text/latex"]) {
      const latex = Array.isArray(output.data["text/latex"])
        ? output.data["text/latex"].join("")
        : output.data["text/latex"];
      return `<div class="latex-output">${renderMath(latex, true)}</div>`;
    }

    if (output.data["text/plain"]) {
      const text = Array.isArray(output.data["text/plain"])
        ? output.data["text/plain"].join("")
        : output.data["text/plain"];
      return `<pre class="text-output">${this.escape(text)}</pre>`;
    }

    return "";
  }

  private escape(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
```

**Jupyter 支持完整度：**

| 功能 | 状态 | 说明 |
|------|------|------|
| Markdown 单元格 | ✅ | 完整支持 |
| 代码单元格 | ✅ | 语法高亮 |
| 文本输出 | ✅ | stdout/stderr |
| 图片输出 | ✅ | PNG/JPEG inline |
| SVG 输出 | ✅ | 矢量图 |
| HTML 输出 | ✅ | 表格、富文本 |
| LaTeX 输出 | ✅ | KaTeX 渲染 |
| 交互式 Widget | ❌ | 静态渲染不支持 |

### 3.2 图片处理 (JPEG/PNG)

**源码：C → WASM**

```c
// image-core.c - 精简版，约 500 行胶水代码
#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#define STB_IMAGE_RESIZE_IMPLEMENTATION

// 只启用需要的格式
#define STBI_ONLY_JPEG
#define STBI_ONLY_PNG
#define STBI_NO_HDR
#define STBI_NO_LINEAR

#include "stb_image.h"
#include "stb_image_write.h"
#include "stb_image_resize2.h"

// 导出函数：解码
EMSCRIPTEN_KEEPALIVE
uint8_t* decode_image(uint8_t* data, int len, int* w, int* h, int* channels) {
    return stbi_load_from_memory(data, len, w, h, channels, 0);
}

// 导出函数：缩放
EMSCRIPTEN_KEEPALIVE
uint8_t* resize_image(uint8_t* data, int w, int h, int channels,
                      int new_w, int new_h) {
    uint8_t* output = malloc(new_w * new_h * channels);
    stbir_resize_uint8_linear(data, w, h, 0, output, new_w, new_h, 0,
                              (stbir_pixel_layout)channels);
    return output;
}

// 导出函数：编码 JPEG
EMSCRIPTEN_KEEPALIVE
int encode_jpeg(uint8_t* data, int w, int h, int channels, int quality,
                uint8_t** output, int* output_len) {
    // 使用回调收集输出
    return stbi_write_jpg_to_func(write_callback, &ctx, w, h, channels,
                                   data, quality);
}

// 导出函数：编码 PNG
EMSCRIPTEN_KEEPALIVE
int encode_png(uint8_t* data, int w, int h, int channels,
               uint8_t** output, int* output_len) {
    return stbi_write_png_to_func(write_callback, &ctx, w, h, channels,
                                   data, w * channels);
}
```

**编译命令：**
```bash
emcc image-core.c -O3 -flto \
  -s WASM=1 \
  -s EXPORTED_FUNCTIONS='["_decode_image","_resize_image","_encode_jpeg","_encode_png","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s TOTAL_MEMORY=67108864 \
  -o image-core.wasm

# 进一步优化
wasm-opt -O3 -c image-core.wasm -o image-core.opt.wasm
```

**Deno 封装：**
```typescript
// src/image/mod.ts
const wasmBytes = await Deno.readFile(new URL("./image-core.wasm", import.meta.url));
const wasmModule = await WebAssembly.instantiate(wasmBytes, {
  env: { memory: new WebAssembly.Memory({ initial: 256, maximum: 4096 }) }
});

export class ImageProcessor {
  private wasm = wasmModule.instance.exports;

  async resize(input: Uint8Array, maxWidth: number, maxHeight: number,
               quality = 85): Promise<Uint8Array> {
    // 1. 解码
    const [ptr, w, h, channels] = this.decode(input);

    // 2. 计算新尺寸（保持比例）
    const ratio = Math.min(maxWidth / w, maxHeight / h, 1);
    const newW = Math.round(w * ratio);
    const newH = Math.round(h * ratio);

    // 3. 缩放
    const resizedPtr = this.wasm.resize_image(ptr, w, h, channels, newW, newH);

    // 4. 编码
    const output = this.encodeJpeg(resizedPtr, newW, newH, channels, quality);

    // 5. 清理内存
    this.wasm.free(ptr);
    this.wasm.free(resizedPtr);

    return output;
  }

  private decode(data: Uint8Array): [number, number, number, number] {
    const inputPtr = this.allocate(data);
    const wPtr = this.wasm.malloc(4);
    const hPtr = this.wasm.malloc(4);
    const cPtr = this.wasm.malloc(4);

    const outputPtr = this.wasm.decode_image(inputPtr, data.length, wPtr, hPtr, cPtr);

    const w = new Int32Array(this.wasm.memory.buffer, wPtr, 1)[0];
    const h = new Int32Array(this.wasm.memory.buffer, hPtr, 1)[0];
    const c = new Int32Array(this.wasm.memory.buffer, cPtr, 1)[0];

    this.wasm.free(inputPtr);
    this.wasm.free(wPtr);
    this.wasm.free(hPtr);
    this.wasm.free(cPtr);

    return [outputPtr, w, h, c];
  }

  private allocate(data: Uint8Array): number {
    const ptr = this.wasm.malloc(data.length);
    new Uint8Array(this.wasm.memory.buffer, ptr, data.length).set(data);
    return ptr;
  }
}
```

### 3.3 DOCX 解析

**精简版 mammoth 移植：**
```typescript
// src/docx/mod.ts
import { JSZip } from "../vendor/jszip.ts";  // 内嵌精简版

interface DocxOptions {
  extractImages?: boolean;
  styleMap?: Record<string, string>;
}

export class DocxParser {
  async parse(data: Uint8Array, options: DocxOptions = {}): Promise<string> {
    const zip = await JSZip.loadAsync(data);

    // 1. 解析主文档
    const documentXml = await zip.file("word/document.xml")?.async("string");
    if (!documentXml) throw new Error("Invalid DOCX: missing document.xml");

    // 2. 解析样式
    const stylesXml = await zip.file("word/styles.xml")?.async("string");
    const styles = this.parseStyles(stylesXml);

    // 3. 解析关系（图片等）
    const relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");
    const rels = this.parseRelationships(relsXml);

    // 4. 转换为 HTML
    const doc = new DOMParser().parseFromString(documentXml, "text/xml");
    return this.convertToHtml(doc, styles, rels, zip, options);
  }

  private convertToHtml(doc: Document, styles: Map<string, Style>,
                        rels: Map<string, string>, zip: JSZip,
                        options: DocxOptions): string {
    const body = doc.getElementsByTagName("w:body")[0];
    let html = "";

    for (const child of body.children) {
      if (child.tagName === "w:p") {
        html += this.convertParagraph(child, styles);
      } else if (child.tagName === "w:tbl") {
        html += this.convertTable(child, styles);
      }
    }

    return html;
  }

  private convertParagraph(p: Element, styles: Map<string, Style>): string {
    // 获取段落样式
    const pStyle = p.querySelector("w\\:pStyle, pStyle")?.getAttribute("w:val");
    const tag = this.styleToTag(pStyle, styles);

    let content = "";
    for (const run of p.querySelectorAll("w\\:r, r")) {
      content += this.convertRun(run);
    }

    return `<${tag}>${content}</${tag}>`;
  }

  private convertRun(run: Element): string {
    let text = "";

    // 文本内容
    for (const t of run.querySelectorAll("w\\:t, t")) {
      text += t.textContent || "";
    }

    // 格式化
    const rPr = run.querySelector("w\\:rPr, rPr");
    if (rPr) {
      if (rPr.querySelector("w\\:b, b")) text = `<strong>${text}</strong>`;
      if (rPr.querySelector("w\\:i, i")) text = `<em>${text}</em>`;
      if (rPr.querySelector("w\\:u, u")) text = `<u>${text}</u>`;
    }

    return text;
  }

  private styleToTag(styleId: string | undefined, styles: Map<string, Style>): string {
    if (!styleId) return "p";
    const style = styles.get(styleId);
    if (style?.name?.startsWith("Heading")) {
      const level = parseInt(style.name.replace("Heading ", "")) || 1;
      return `h${Math.min(level, 6)}`;
    }
    return "p";
  }
}
```

### 3.4 XLSX 解析

**精简版 SheetJS 核心：**
```typescript
// src/xlsx/mod.ts
import { JSZip } from "../vendor/jszip.ts";

export interface Cell {
  v: string | number | boolean;  // value
  t: "s" | "n" | "b";            // type: string, number, boolean
  f?: string;                     // formula
}

export interface Sheet {
  name: string;
  data: Cell[][];
}

export class XlsxParser {
  async parse(data: Uint8Array): Promise<Sheet[]> {
    const zip = await JSZip.loadAsync(data);

    // 1. 解析共享字符串
    const sharedStrings = await this.parseSharedStrings(zip);

    // 2. 解析工作簿结构
    const workbook = await this.parseWorkbook(zip);

    // 3. 解析每个工作表
    const sheets: Sheet[] = [];
    for (const sheet of workbook.sheets) {
      const sheetData = await this.parseSheet(zip, sheet.path, sharedStrings);
      sheets.push({ name: sheet.name, data: sheetData });
    }

    return sheets;
  }

  private async parseSharedStrings(zip: JSZip): Promise<string[]> {
    const xml = await zip.file("xl/sharedStrings.xml")?.async("string");
    if (!xml) return [];

    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const strings: string[] = [];

    for (const si of doc.querySelectorAll("si")) {
      const t = si.querySelector("t");
      strings.push(t?.textContent || "");
    }

    return strings;
  }

  private async parseSheet(zip: JSZip, path: string,
                           sharedStrings: string[]): Promise<Cell[][]> {
    const xml = await zip.file(path)?.async("string");
    if (!xml) return [];

    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const rows: Cell[][] = [];

    for (const row of doc.querySelectorAll("row")) {
      const rowIndex = parseInt(row.getAttribute("r") || "1") - 1;
      rows[rowIndex] = rows[rowIndex] || [];

      for (const cell of row.querySelectorAll("c")) {
        const ref = cell.getAttribute("r") || "A1";
        const colIndex = this.colToIndex(ref.replace(/[0-9]/g, ""));
        const type = cell.getAttribute("t");
        const value = cell.querySelector("v")?.textContent || "";

        rows[rowIndex][colIndex] = {
          v: type === "s" ? sharedStrings[parseInt(value)] :
             type === "b" ? value === "1" : parseFloat(value),
          t: type === "s" ? "s" : type === "b" ? "b" : "n",
          f: cell.querySelector("f")?.textContent || undefined
        };
      }
    }

    return rows;
  }

  private colToIndex(col: string): number {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + col.charCodeAt(i) - 64;
    }
    return index - 1;
  }

  toHtml(sheets: Sheet[]): string {
    return sheets.map(sheet => `
      <h2>${sheet.name}</h2>
      <table>
        ${sheet.data.map(row => `
          <tr>${row.map(cell => `<td>${cell?.v ?? ""}</td>`).join("")}</tr>
        `).join("")}
      </table>
    `).join("");
  }
}
```

### 3.5 KaTeX 公式渲染

```typescript
// src/katex/mod.ts
// 内嵌 KaTeX 核心（压缩后约 200KB）

import { katexCore } from "../vendor/katex-core.ts";

export function renderMath(latex: string, displayMode = false): string {
  try {
    return katexCore.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false
    });
  } catch (e) {
    return `<span class="katex-error">${escapeHtml(latex)}</span>`;
  }
}

// Markdown 中提取并渲染公式
export function processLatexInMarkdown(markdown: string): string {
  // 块级公式 $$...$$
  markdown = markdown.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    return `<div class="math-display">${renderMath(tex.trim(), true)}</div>`;
  });

  // 行内公式 $...$
  markdown = markdown.replace(/\$([^\$\n]+?)\$/g, (_, tex) => {
    return `<span class="math-inline">${renderMath(tex.trim(), false)}</span>`;
  });

  return markdown;
}
```

---

## 4. Tier 2 实现：进阶功能

### 4.1 HEIC 解码

**libde265 裁剪策略：**
```
原始 libde265 (~50K 行)
├── 解码器核心
│   ├── cabac.cc           CABAC 熵解码 ✅ 保留
│   ├── transform.cc       变换 ✅ 保留
│   ├── motion.cc          运动补偿 ⚠️ I帧不需要
│   ├── deblock.cc         去块滤波 ✅ 保留
│   └── sao.cc             SAO 滤波 ⚠️ 可选
├── 多线程支持              ✗ 移除
├── 流式解码                ✗ 移除
├── 错误恢复                ✗ 简化
└── 测试/示例               ✗ 移除

裁剪后预计：~15K 行，~300KB WASM
```

**HEIF 容器解析（纯 TypeScript）：**
```typescript
// src/heic/container.ts
// HEIF 是 ISOBMFF 格式（类似 MP4）

interface Box {
  type: string;
  size: number;
  data: Uint8Array;
  children?: Box[];
}

export class HeifParser {
  parse(data: Uint8Array): HeifImage[] {
    const boxes = this.parseBoxes(data, 0, data.length);

    // 找到 meta box
    const meta = this.findBox(boxes, "meta");
    if (!meta) throw new Error("Invalid HEIF: no meta box");

    // 解析图片信息
    const iinf = this.findBox(meta.children!, "iinf");
    const iloc = this.findBox(meta.children!, "iloc");

    // 提取图片数据
    const images: HeifImage[] = [];
    for (const item of this.parseItemInfo(iinf!)) {
      if (item.type === "hvc1" || item.type === "av01") {
        const extent = this.getItemExtent(iloc!, item.id);
        images.push({
          id: item.id,
          type: item.type,
          data: data.slice(extent.offset, extent.offset + extent.length)
        });
      }
    }

    return images;
  }

  private parseBoxes(data: Uint8Array, offset: number, end: number): Box[] {
    const boxes: Box[] = [];
    const view = new DataView(data.buffer, data.byteOffset);

    while (offset < end) {
      const size = view.getUint32(offset);
      const type = String.fromCharCode(
        data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]
      );

      const boxData = data.slice(offset + 8, offset + size);
      const box: Box = { type, size, data: boxData };

      // 容器类型 box 需要递归解析
      if (["meta", "iinf", "iloc", "iref"].includes(type)) {
        const headerSize = type === "meta" ? 4 : 0;  // meta 有 fullbox header
        box.children = this.parseBoxes(boxData, headerSize, boxData.length);
      }

      boxes.push(box);
      offset += size;
    }

    return boxes;
  }
}
```

**HEVC 解码器 WASM 封装：**
```typescript
// src/heic/decoder.ts
const hevcWasm = await loadEmbeddedWasm("hevc-decoder.wasm");

export class HevcDecoder {
  private ctx: number;

  constructor() {
    this.ctx = hevcWasm.de265_new_decoder();
  }

  decode(hevcData: Uint8Array): ImageData {
    // 1. 推入数据
    const ptr = hevcWasm.malloc(hevcData.length);
    hevcWasm.HEAPU8.set(hevcData, ptr);
    hevcWasm.de265_push_data(this.ctx, ptr, hevcData.length, 0, null);
    hevcWasm.free(ptr);

    // 2. 解码
    hevcWasm.de265_flush_data(this.ctx);
    const err = hevcWasm.de265_decode(this.ctx);
    if (err !== 0) throw new Error(`HEVC decode error: ${err}`);

    // 3. 获取图像
    const img = hevcWasm.de265_get_next_picture(this.ctx);
    const width = hevcWasm.de265_get_image_width(img, 0);
    const height = hevcWasm.de265_get_image_height(img, 0);

    // 4. YUV → RGB
    const rgb = this.yuvToRgb(img, width, height);

    return new ImageData(rgb, width, height);
  }

  private yuvToRgb(img: number, width: number, height: number): Uint8ClampedArray {
    const yPtr = hevcWasm.de265_get_image_plane(img, 0);
    const uPtr = hevcWasm.de265_get_image_plane(img, 1);
    const vPtr = hevcWasm.de265_get_image_plane(img, 2);

    const yStride = hevcWasm.de265_get_image_stride(img, 0);
    const uvStride = hevcWasm.de265_get_image_stride(img, 1);

    const rgba = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const yVal = hevcWasm.HEAPU8[yPtr + y * yStride + x];
        const uVal = hevcWasm.HEAPU8[uPtr + (y >> 1) * uvStride + (x >> 1)];
        const vVal = hevcWasm.HEAPU8[vPtr + (y >> 1) * uvStride + (x >> 1)];

        // YUV BT.601 → RGB
        const r = yVal + 1.402 * (vVal - 128);
        const g = yVal - 0.344 * (uVal - 128) - 0.714 * (vVal - 128);
        const b = yVal + 1.772 * (uVal - 128);

        const i = (y * width + x) * 4;
        rgba[i] = clamp(r);
        rgba[i + 1] = clamp(g);
        rgba[i + 2] = clamp(b);
        rgba[i + 3] = 255;
      }
    }

    return rgba;
  }

  destroy() {
    hevcWasm.de265_free_decoder(this.ctx);
  }
}
```

### 4.2 PPTX 渲染

**最小渲染器架构：**
```typescript
// src/pptx/mod.ts
import { JSZip } from "../vendor/jszip.ts";

interface Slide {
  shapes: Shape[];
  background?: string;
}

interface Shape {
  type: "text" | "image" | "rect" | "ellipse";
  x: number;      // EMU 转像素
  y: number;
  width: number;
  height: number;
  content?: string;
  style?: ShapeStyle;
}

export class PptxRenderer {
  private slideWidth = 960;   // 默认 10 英寸 × 96 DPI
  private slideHeight = 540;  // 默认 7.5 英寸 × 96 DPI

  async render(data: Uint8Array): Promise<Uint8Array[]> {
    const zip = await JSZip.loadAsync(data);

    // 1. 解析演示文稿尺寸
    await this.parsePresentation(zip);

    // 2. 解析所有幻灯片
    const slides = await this.parseSlides(zip);

    // 3. 渲染为 PNG
    const pngs: Uint8Array[] = [];
    for (const slide of slides) {
      const png = await this.renderSlide(slide);
      pngs.push(png);
    }

    return pngs;
  }

  private async parseSlides(zip: JSZip): Promise<Slide[]> {
    const slides: Slide[] = [];
    let i = 1;

    while (true) {
      const slideXml = await zip.file(`ppt/slides/slide${i}.xml`)?.async("string");
      if (!slideXml) break;

      const doc = new DOMParser().parseFromString(slideXml, "text/xml");
      slides.push(this.parseSlide(doc));
      i++;
    }

    return slides;
  }

  private parseSlide(doc: Document): Slide {
    const shapes: Shape[] = [];

    // 解析形状树
    const spTree = doc.querySelector("p\\:spTree, spTree");
    if (!spTree) return { shapes };

    for (const sp of spTree.querySelectorAll("p\\:sp, sp")) {
      const shape = this.parseShape(sp);
      if (shape) shapes.push(shape);
    }

    // 解析图片
    for (const pic of spTree.querySelectorAll("p\\:pic, pic")) {
      const image = this.parsePicture(pic);
      if (image) shapes.push(image);
    }

    return { shapes };
  }

  private parseShape(sp: Element): Shape | null {
    // 获取位置和尺寸
    const xfrm = sp.querySelector("a\\:xfrm, xfrm");
    if (!xfrm) return null;

    const off = xfrm.querySelector("a\\:off, off");
    const ext = xfrm.querySelector("a\\:ext, ext");

    const x = this.emuToPixel(parseInt(off?.getAttribute("x") || "0"));
    const y = this.emuToPixel(parseInt(off?.getAttribute("y") || "0"));
    const width = this.emuToPixel(parseInt(ext?.getAttribute("cx") || "0"));
    const height = this.emuToPixel(parseInt(ext?.getAttribute("cy") || "0"));

    // 获取文本内容
    const txBody = sp.querySelector("p\\:txBody, txBody");
    let content = "";
    if (txBody) {
      for (const t of txBody.querySelectorAll("a\\:t, t")) {
        content += t.textContent || "";
      }
    }

    return {
      type: content ? "text" : "rect",
      x, y, width, height,
      content: content || undefined
    };
  }

  // EMU (English Metric Units) 转像素
  // 1 英寸 = 914400 EMU, 96 DPI
  private emuToPixel(emu: number): number {
    return Math.round(emu / 914400 * 96);
  }

  private async renderSlide(slide: Slide): Promise<Uint8Array> {
    // 使用 OffscreenCanvas（Deno 支持）或 node-canvas 绑定
    const canvas = new OffscreenCanvas(this.slideWidth, this.slideHeight);
    const ctx = canvas.getContext("2d")!;

    // 白色背景
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, this.slideWidth, this.slideHeight);

    // 渲染形状
    for (const shape of slide.shapes) {
      this.renderShape(ctx, shape);
    }

    // 导出 PNG
    const blob = await canvas.convertToBlob({ type: "image/png" });
    return new Uint8Array(await blob.arrayBuffer());
  }

  private renderShape(ctx: OffscreenCanvasRenderingContext2D, shape: Shape) {
    switch (shape.type) {
      case "text":
        ctx.fillStyle = "#000000";
        ctx.font = "24px sans-serif";
        ctx.fillText(shape.content || "", shape.x, shape.y + 24);
        break;
      case "rect":
        ctx.strokeStyle = "#000000";
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        break;
      case "image":
        // 需要解析图片引用并绘制
        break;
    }
  }
}
```

### 4.3 LaTeX 基础文档

**方案：移植 TeX 核心或使用 Tectonic**

```
选项 A：最小 TeX 引擎（裁剪 tex.web）
├── 宏展开器
├── 基础排版
├── DVI 输出 → 转 SVG/PNG
└── 预计 ~1.5MB WASM

选项 B：Tectonic WASM（Rust TeX 实现）
├── 更现代的实现
├── 直接 PDF 输出
└── 预计 ~3MB WASM

选项 C：仅支持公式 + 简单文档
├── KaTeX 处理公式
├── Markdown 风格文档结构
├── 不支持完整 LaTeX 语法
└── 预计 ~500KB
```

**推荐选项 C 的实现：**
```typescript
// src/latex/mod.ts
import { renderMath } from "../katex/mod.ts";

export interface LatexDocument {
  title?: string;
  author?: string;
  date?: string;
  sections: LatexSection[];
}

interface LatexSection {
  type: "section" | "subsection" | "paragraph" | "math" | "list";
  content: string;
  children?: LatexSection[];
}

export class LatexParser {
  parse(source: string): LatexDocument {
    const doc: LatexDocument = { sections: [] };

    // 提取文档信息
    doc.title = this.extractCommand(source, "title");
    doc.author = this.extractCommand(source, "author");
    doc.date = this.extractCommand(source, "date");

    // 找到 \begin{document} ... \end{document}
    const bodyMatch = source.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
    if (!bodyMatch) return doc;

    const body = bodyMatch[1];
    doc.sections = this.parseSections(body);

    return doc;
  }

  private parseSections(source: string): LatexSection[] {
    const sections: LatexSection[] = [];

    // 简单的分段解析
    const lines = source.split("\n");
    let currentParagraph = "";

    for (const line of lines) {
      // 章节标题
      const sectionMatch = line.match(/\\(section|subsection)\{([^}]+)\}/);
      if (sectionMatch) {
        if (currentParagraph.trim()) {
          sections.push({ type: "paragraph", content: currentParagraph.trim() });
          currentParagraph = "";
        }
        sections.push({ type: sectionMatch[1] as "section", content: sectionMatch[2] });
        continue;
      }

      // 数学环境
      if (line.includes("\\begin{equation}") || line.includes("\\begin{align}")) {
        // 收集到 \end
        // ...
      }

      currentParagraph += line + "\n";
    }

    if (currentParagraph.trim()) {
      sections.push({ type: "paragraph", content: currentParagraph.trim() });
    }

    return sections;
  }

  toHtml(doc: LatexDocument): string {
    let html = "";

    if (doc.title) {
      html += `<h1>${doc.title}</h1>`;
      if (doc.author) html += `<p class="author">${doc.author}</p>`;
      if (doc.date) html += `<p class="date">${doc.date}</p>`;
    }

    for (const section of doc.sections) {
      html += this.sectionToHtml(section);
    }

    return html;
  }

  private sectionToHtml(section: LatexSection): string {
    switch (section.type) {
      case "section":
        return `<h2>${section.content}</h2>`;
      case "subsection":
        return `<h3>${section.content}</h3>`;
      case "paragraph":
        // 处理段落中的公式
        let content = section.content;
        content = content.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) =>
          `<div class="math">${renderMath(tex, true)}</div>`);
        content = content.replace(/\$([^\$]+)\$/g, (_, tex) =>
          renderMath(tex, false));
        return `<p>${content}</p>`;
      case "math":
        return `<div class="math">${renderMath(section.content, true)}</div>`;
      default:
        return "";
    }
  }
}
```

---

## 5. Tier 3 实现：完整功能

### 5.1 RAW (ARW/CR2/NEF) 解码

**LibRaw 裁剪方案：**
```
LibRaw 核心 (~80K 行)
├── 通用解包器        ✅ 保留核心
├── 相机特定代码      ⚠️ 只保留常见品牌
│   ├── Sony ARW     ✅
│   ├── Canon CR2    ✅
│   ├── Nikon NEF    ✅
│   └── 其他 30+ 种   ✗ 移除
├── 色彩矩阵         ✅ 常见相机
├── 降噪/锐化        ✗ 移除
└── GPU 加速         ✗ 移除

裁剪目标：~20K 行，~500KB WASM
```

```typescript
// src/raw/mod.ts
const rawWasm = await loadEmbeddedWasm("raw-decoder.wasm");

export class RawDecoder {
  async decode(data: Uint8Array): Promise<ImageData> {
    const ptr = rawWasm.malloc(data.length);
    rawWasm.HEAPU8.set(data, ptr);

    const ctx = rawWasm.libraw_init(0);
    rawWasm.libraw_open_buffer(ctx, ptr, data.length);
    rawWasm.libraw_unpack(ctx);
    rawWasm.libraw_dcraw_process(ctx);

    const img = rawWasm.libraw_dcraw_make_mem_image(ctx);
    const width = rawWasm.getValue(img, "i32");
    const height = rawWasm.getValue(img + 4, "i32");
    const dataPtr = rawWasm.getValue(img + 16, "i32");

    const rgb = new Uint8ClampedArray(
      rawWasm.HEAPU8.buffer, dataPtr, width * height * 3
    );

    // RGB → RGBA
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = rgb[i * 3];
      rgba[i * 4 + 1] = rgb[i * 3 + 1];
      rgba[i * 4 + 2] = rgb[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }

    rawWasm.libraw_dcraw_clear_mem(img);
    rawWasm.libraw_close(ctx);
    rawWasm.free(ptr);

    return new ImageData(rgba, width, height);
  }
}
```

### 5.2 完整 LaTeX（Tectonic WASM）

```typescript
// src/latex-full/mod.ts
// 使用 Tectonic WASM 构建完整 LaTeX 支持

const tectonicWasm = await loadEmbeddedWasm("tectonic.wasm");

export class TectonicEngine {
  private fs: Map<string, Uint8Array> = new Map();

  async compile(source: string): Promise<Uint8Array> {
    // 1. 设置虚拟文件系统
    this.fs.set("input.tex", new TextEncoder().encode(source));

    // 2. 加载基础宏包（内嵌或按需下载）
    await this.loadBundle("latex-base");

    // 3. 编译
    const result = tectonicWasm.compile(
      "input.tex",
      this.readFile.bind(this),
      this.writeFile.bind(this)
    );

    if (result !== 0) {
      throw new Error("LaTeX compilation failed");
    }

    // 4. 返回 PDF
    return this.fs.get("input.pdf")!;
  }

  private readFile(path: string): Uint8Array | null {
    return this.fs.get(path) || null;
  }

  private writeFile(path: string, data: Uint8Array) {
    this.fs.set(path, data);
  }

  private async loadBundle(name: string) {
    // 内嵌最小 bundle 或从 CDN 下载
    const bundleUrl = `https://staticflow.dev/tex-bundles/${name}.tar.xz`;
    // ...
  }
}
```

---

## 6. 构建与分发

### 6.1 项目结构

```
staticflow/
├── src/
│   ├── mod.ts                 # 主入口
│   ├── cli.ts                 # CLI 命令
│   ├── config.ts              # 配置解析
│   │
│   ├── image/                 # Tier 1
│   │   ├── mod.ts
│   │   └── wasm/
│   │       ├── image-core.c
│   │       └── build.sh
│   │
│   ├── docx/                  # Tier 1
│   │   └── mod.ts
│   │
│   ├── xlsx/                  # Tier 1
│   │   └── mod.ts
│   │
│   ├── katex/                 # Tier 1
│   │   └── mod.ts
│   │
│   ├── heic/                  # Tier 2
│   │   ├── mod.ts
│   │   ├── container.ts
│   │   └── wasm/
│   │       ├── hevc-decoder/  # libde265 裁剪
│   │       └── build.sh
│   │
│   ├── pptx/                  # Tier 2
│   │   └── mod.ts
│   │
│   ├── latex/                 # Tier 2
│   │   └── mod.ts
│   │
│   ├── raw/                   # Tier 3
│   │   ├── mod.ts
│   │   └── wasm/
│   │       └── libraw/
│   │
│   ├── latex-full/            # Tier 3
│   │   └── mod.ts
│   │
│   └── vendor/                # 内嵌依赖
│       ├── jszip.ts           # 精简版
│       └── katex-core.ts      # KaTeX 核心
│
├── wasm/                      # 预编译 WASM
│   ├── image-core.wasm
│   ├── hevc-decoder.wasm
│   ├── raw-decoder.wasm
│   └── tectonic.wasm
│
├── deno.json
├── build.ts                   # 构建脚本
└── README.md
```

### 6.2 构建流程

```typescript
// build.ts
import { bundle } from "https://deno.land/x/emit/mod.ts";

const TARGETS = [
  "x86_64-unknown-linux-gnu",
  "x86_64-apple-darwin",
  "aarch64-apple-darwin",
  "x86_64-pc-windows-msvc",
];

async function build() {
  // 1. 编译 WASM 模块
  await Deno.run({ cmd: ["./src/image/wasm/build.sh"] }).status();
  await Deno.run({ cmd: ["./src/heic/wasm/build.sh"] }).status();

  // 2. 内嵌 WASM 为 base64
  const imageWasm = await Deno.readFile("./wasm/image-core.wasm");
  const heicWasm = await Deno.readFile("./wasm/hevc-decoder.wasm");

  // 3. 生成嵌入代码
  await Deno.writeTextFile("./src/wasm-embed.ts", `
    export const IMAGE_WASM = Uint8Array.from(atob("${btoa(String.fromCharCode(...imageWasm))}"), c => c.charCodeAt(0));
    export const HEIC_WASM = Uint8Array.from(atob("${btoa(String.fromCharCode(...heicWasm))}"), c => c.charCodeAt(0));
  `);

  // 4. Bundle TypeScript
  const result = await bundle("./src/mod.ts", {
    type: "module",
    minify: true,
  });

  // 5. 编译为各平台可执行文件
  for (const target of TARGETS) {
    await Deno.run({
      cmd: [
        "deno", "compile",
        "--target", target,
        "--output", `dist/staticflow-${target}`,
        "--allow-read", "--allow-write", "--allow-net",
        "./src/cli.ts"
      ]
    }).status();
  }
}
```

### 6.3 分发

```bash
# 安装脚本
curl -fsSL https://staticflow.dev/install.sh | sh

# install.sh 内容
#!/bin/bash
PLATFORM=$(uname -s)-$(uname -m)
case $PLATFORM in
  Linux-x86_64)  BIN="staticflow-x86_64-unknown-linux-gnu" ;;
  Darwin-x86_64) BIN="staticflow-x86_64-apple-darwin" ;;
  Darwin-arm64)  BIN="staticflow-aarch64-apple-darwin" ;;
  *)             echo "Unsupported platform"; exit 1 ;;
esac

curl -fsSL "https://github.com/staticflow/staticflow/releases/latest/download/$BIN" \
  -o /usr/local/bin/staticflow
chmod +x /usr/local/bin/staticflow
```

---

## 7. 迁移策略：完整迁移 + 逐步替换

### 7.1 阶段演进

```
Week 1-2: 脚手架 + 外壳迁移
┌─────────────────────────────────────────────────┐
│  staticflow (Deno)                              │
│  ├── CLI 框架                                   │
│  ├── 配置系统                                   │
│  └── 调用外部命令 (node, imagemagick)  ← 保持现状 │
└─────────────────────────────────────────────────┘
验收：功能等价，可构建现有博客

Week 3-4: 替换 Node.js 依赖
┌─────────────────────────────────────────────────┐
│  staticflow (Deno)                              │
│  ├── 内置 Markdown 渲染                         │
│  ├── 内置搜索索引构建                            │
│  ├── 内置 DOCX/XLSX 解析                        │
│  └── 仍调用 imagemagick                         │
└─────────────────────────────────────────────────┘
验收：不再依赖 Node.js

Week 5-6: 替换 ImageMagick (HEIC 攻坚)
┌─────────────────────────────────────────────────┐
│  staticflow (Deno)                              │
│  ├── 内置 image-core.wasm (JPG/PNG)             │
│  ├── 内置 heic-decoder.wasm (HEIC)              │
│  └── 零外部依赖 ✓                               │
└─────────────────────────────────────────────────┘
验收：单文件可执行，处理 HEIC
```

### 7.2 关键里程碑

| 里程碑 | 验收标准 | 外部依赖 |
|--------|---------|---------|
| M1: 脚手架 | CLI 可运行，配置可解析 | Node + ImageMagick |
| M2: Node 替换 | 构建博客完整功能 | ImageMagick only |
| M3: HEIC 攻克 | 处理 iPhone 照片 | **零依赖** |
| M4: 单文件发布 | `deno compile` 成功 | **零依赖** |

---

## 8. HEIC 攻坚：libde265 裁剪方案

### 8.1 源码结构分析

```
libde265 目录结构 (~50K 行)
├── libde265/
│   ├── de265.h              公共 API ✅ 保留
│   ├── de265.cc             API 实现 ✅ 保留
│   │
│   ├── decctx.cc            解码上下文 ✅ 保留
│   ├── slice.cc             切片解码 ✅ 保留
│   ├── image.cc             图像缓冲 ✅ 保留
│   │
│   ├── cabac.cc             CABAC 熵解码 ✅ 核心
│   ├── transform.cc         变换 (DCT/DST) ✅ 核心
│   ├── intrapred.cc         帧内预测 ✅ 核心
│   ├── motion.cc            运动补偿 ⚠️ I帧可裁剪
│   ├── deblock.cc           去块滤波 ⚠️ 可选
│   ├── sao.cc               SAO 滤波 ⚠️ 可选
│   │
│   ├── threads.cc           多线程 ✗ 移除
│   ├── visualize.cc         可视化调试 ✗ 移除
│   ├── fallback-*.cc        SIMD 回退 ⚠️ 保留一份
│   ├── x86/                  x86 SIMD ✗ WASM 不需要
│   ├── arm/                  ARM SIMD ✗ WASM 不需要
│   └── encoder/              编码器 ✗ 完全移除
```

### 8.2 裁剪决策矩阵

| 模块 | 原始行数 | 决策 | 理由 |
|------|---------|------|------|
| 熵解码 (CABAC) | ~3K | ✅ 保留 | 核心，必须 |
| 变换 (DCT) | ~2K | ✅ 保留 | 核心，必须 |
| 帧内预测 | ~3K | ✅ 保留 | I帧解码必须 |
| 运动补偿 | ~4K | ⚠️ **可裁剪** | 照片是纯 I帧 |
| 去块滤波 | ~2K | ✅ 保留 | 影响画质 |
| SAO 滤波 | ~1K | ⚠️ 可选 | 裁剪后画质略降 |
| 多线程 | ~2K | ✗ 移除 | WASM 单线程 |
| SIMD (x86/arm) | ~10K | ✗ 移除 | WASM 有自己的 SIMD |
| 编码器 | ~15K | ✗ 移除 | 不需要 |

### 8.3 裁剪后预估

```
原始：~50K 行 → 编译后 ~1.5MB WASM
裁剪：~15K 行 → 编译后 ~300KB WASM (目标)
```

### 8.4 编译流程

```bash
# 1. 克隆源码
git clone https://github.com/strukturag/libde265
cd libde265

# 2. 创建裁剪配置
cat > wasm-config.h << 'EOF'
#define DE265_DISABLE_SSE 1
#define DE265_DISABLE_ARM 1
#define DE265_SINGLE_THREADED 1
#define DE265_DISABLE_ENCODER 1
// #define DE265_DISABLE_SAO 1      // 可选：进一步减小体积
// #define DE265_DISABLE_DEBLOCK 1  // 可选：进一步减小体积
EOF

# 3. 收集需要的源文件
SOURCES="
  libde265/de265.cc
  libde265/decctx.cc
  libde265/image.cc
  libde265/slice.cc
  libde265/cabac.cc
  libde265/transform.cc
  libde265/intrapred.cc
  libde265/deblock.cc
  libde265/sao.cc
  libde265/fallback.cc
  libde265/fallback-dct.cc
"

# 4. Emscripten 编译
emcc $SOURCES \
  -I. \
  -include wasm-config.h \
  -O3 -flto \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="createHevcDecoder" \
  -s EXPORTED_FUNCTIONS='[
    "_de265_new_decoder",
    "_de265_free_decoder",
    "_de265_push_data",
    "_de265_flush_data",
    "_de265_decode",
    "_de265_get_next_picture",
    "_de265_get_image_width",
    "_de265_get_image_height",
    "_de265_get_image_plane",
    "_de265_get_image_stride",
    "_malloc",
    "_free"
  ]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","HEAPU8"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=33554432 \
  -o hevc-decoder.js

# 5. 优化 WASM 体积
wasm-opt -O3 --strip-debug hevc-decoder.wasm -o hevc-decoder.opt.wasm

# 6. 验证体积
ls -lh hevc-decoder.opt.wasm  # 目标: < 500KB
```

### 8.5 HEIF 容器结构

```
HEIC 文件结构 (ISOBMFF 格式)：
┌─────────────────────────────────────────────────┐
│ ftyp (12 bytes)                                 │
│ └── brand: "heic" / "mif1"                      │
├─────────────────────────────────────────────────┤
│ meta (容器)                                      │
│ ├── hdlr - 处理器声明 ("pict")                   │
│ ├── pitm - 主图像 ID                            │
│ ├── iloc - 图像数据位置表 ← 关键                 │
│ │   └── item_id → offset, length               │
│ ├── iinf - 图像信息 ← 关键                       │
│ │   └── item_id → type ("hvc1" / "av01")       │
│ ├── iprp - 图像属性                             │
│ │   ├── hvcC - HEVC 配置（SPS/PPS）             │
│ │   ├── ispe - 图像尺寸                         │
│ │   └── colr - 色彩信息                         │
│ └── iref - 图像引用关系（缩略图等）              │
├─────────────────────────────────────────────────┤
│ mdat (媒体数据)                                  │
│ └── [HEVC NAL units...]  ← 实际图像数据         │
└─────────────────────────────────────────────────┘
```

### 8.6 HEIC 处理流程

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  HEIC 文件   │ ──→ │ HEIF 容器解析 │ ──→ │  HEVC 数据   │
│  (二进制)    │     │  (TypeScript) │     │  (NAL units) │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ 提取 hvcC    │
                     │ (SPS/PPS)    │
                     └──────────────┘
                            │
                            ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   JPG 文件   │ ←── │  RGB → JPG   │ ←── │ HEVC 解码    │
│   (输出)     │     │ (stb_image)  │     │ (WASM)       │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ YUV → RGB    │
                     │ (BT.601/709) │
                     └──────────────┘
```

### 8.7 HEIC 验收标准

```
HEIC 模块完成定义：

功能验收：
✓ 解码 iPhone 拍摄的 HEIC (12MP, 4032×3024)
✓ 解码 iPhone 拍摄的 HEIC (48MP ProRAW, 8064×6048)
✓ 正确处理 EXIF 方向信息
✓ 输出质量与 ImageMagick 无明显差异 (SSIM > 0.98)

性能验收：
✓ 单张 12MP 解码时间 < 3秒
✓ 单张 48MP 解码时间 < 10秒
✓ 内存峰值 < 200MB (12MP) / < 500MB (48MP)

体积验收：
✓ hevc-decoder.wasm < 500KB
✓ HEIF 解析 TS 代码 < 50KB (压缩前)
```

### 8.8 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| libde265 裁剪后无法编译 | 中 | 高 | 先编译完整版验证，再逐步裁剪 |
| HEIF 解析遗漏边界情况 | 高 | 中 | 收集多种 HEIC 样本测试 (iPhone/Android/相机) |
| 某些 HEIC 用 AV1 而非 HEVC | 低 | 中 | 检测 codec 类型并报错，暂不支持 AVIF |
| 内存不足（超大图） | 中 | 中 | 限制最大尺寸或分块处理 |
| 色彩空间转换不准确 | 中 | 低 | 正确读取 colr box，支持 BT.601/709/2020 |

---

## 9. 实施计划（HEIC 优先）

### Phase 0: Deno 脚手架 (3-4天)

| 任务 | 时间 | 产出 | 验收 |
|------|------|------|------|
| 项目初始化 | 0.5天 | deno.json, 目录结构 | `deno check` 通过 |
| CLI 框架 | 1天 | cli.ts (command parser) | `staticflow --help` |
| 配置系统 | 1天 | config.ts + YAML 解析 | 读取 staticflow.yaml |
| 外部命令调用 | 1天 | 调用 node/imagemagick | 构建现有博客成功 |

### Phase 1: Node.js 替换 (5-6天)

| 任务 | 时间 | 产出 | 验收 |
|------|------|------|------|
| Markdown 渲染 | 1天 | markdown/mod.ts | 渲染博客文章 |
| 搜索索引构建 | 2天 | search/mod.ts | 生成 posts.json + 向量索引 |
| 静态 HTML 生成 | 1天 | static/mod.ts | SEO 页面生成 |
| DOCX/XLSX 解析 | 1天 | docx/ + xlsx/ | 解析 Office 文档 |

**里程碑 M2**: 不再依赖 Node.js，仍依赖 ImageMagick

### Phase 2: HEIC 攻坚 (7-10天)

| 任务 | 时间 | 产出 | 验收 |
|------|------|------|------|
| HEIF 容器解析 | 2天 | heic/container.ts | 解析 iloc/iinf |
| libde265 完整编译 | 1天 | hevc-decoder-full.wasm | 解码成功 |
| libde265 裁剪 | 3天 | hevc-decoder.wasm < 500KB | 体积达标 |
| YUV→RGB + JPEG 编码 | 1天 | heic/mod.ts | 输出 JPG |
| 集成测试 | 2天 | 多样本验证 | 验收标准全部通过 |

**里程碑 M3**: HEIC 处理零依赖

### Phase 3: 图片处理完善 (3-4天)

| 任务 | 时间 | 产出 | 验收 |
|------|------|------|------|
| stb_image WASM | 1天 | image-core.wasm | JPG/PNG 处理 |
| 图片缩放/压缩 | 1天 | image/resize.ts | 批量压缩 |
| 相册构建管道 | 1天 | gallery/mod.ts | 生成相册页面 |

**里程碑 M4**: 完整构建管道，零外部依赖

### Phase 4: 单文件发布 (2-3天)

| 任务 | 时间 | 产出 | 验收 |
|------|------|------|------|
| WASM 内嵌 | 1天 | wasm-embed.ts | Base64 嵌入 |
| Deno compile | 1天 | staticflow 可执行文件 | 跨平台编译 |
| 安装脚本 | 0.5天 | install.sh | curl 安装 |

**最终交付**: 单文件可执行，~15MB

---

## 10. 后续扩展（按需）

### Tier 2 其他功能

| 功能 | 时间 | 优先级 |
|------|------|--------|
| PPTX 渲染 | 4天 | 中 |
| LaTeX 基础 | 2天 | 低 |

### Tier 3 完整功能

| 功能 | 时间 | 优先级 |
|------|------|--------|
| RAW (LibRaw) | 5天 | 低 |
| 完整 LaTeX (Tectonic) | 5天 | 低 |

---

## 11. 风险总览

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| libde265 裁剪困难 | 中 | 高 | 先用完整版验证，再逐步裁剪 |
| HEIF 解析边界情况 | 高 | 中 | 收集多种设备样本测试 |
| WASM 体积超预算 | 中 | 中 | wasm-opt 优化 + 按需加载 |
| Deno compile 问题 | 低 | 高 | 备选：esbuild + pkg |
| 大图内存不足 | 中 | 中 | 限制尺寸或分块处理 |

---

## 12. 成功标准

### 12.1 功能验证

```bash
# Tier 1 验证
staticflow build --input test.md     # Markdown
staticflow build --input test.docx   # Word
staticflow build --input test.xlsx   # Excel
staticflow build --input test.tex    # LaTeX 公式

# Tier 2 验证
staticflow build --input test.heic   # HEIC 图片
staticflow build --input test.pptx   # PowerPoint
staticflow build --input doc.tex     # LaTeX 基础文档

# Tier 3 验证
staticflow build --input test.arw    # Sony RAW
staticflow build --input paper.tex   # 完整 LaTeX
```

### 12.2 体积验证

| 组件 | 目标体积 | 说明 |
|------|---------|---------|
| **Core** | ~15MB | 单文件可执行，零依赖 |
| pptx-full 插件 | ~100MB | LibreOffice WASM |
| latex-full 插件 | ~30MB | Tectonic + 宏包 |
| raw-full 插件 | ~5MB | LibRaw WASM |
| **全部安装** | ~150MB | Core + 全部插件 |

### 12.3 性能验证

| 操作 | Core | 使用插件 |
|------|------|---------|
| JPEG 压缩 (5MB) | < 2s | - |
| HEIC 解码 (10MB) | < 5s | - |
| PPTX 提取文本/图片 | < 2s | - |
| PPTX 完整渲染 (20页) | - | < 30s (pptx-full) |
| LaTeX 公式渲染 | < 1s | - |
| LaTeX 完整编译 (10页) | - | < 30s (latex-full) |
| RAW 预览提取 | < 1s | - |
| RAW 完整解码 | - | < 5s (raw-full) |

### 12.4 插件验证

```bash
# 核心功能验证（无插件）
staticflow build --input test.md      # Markdown ✓
staticflow build --input test.ipynb   # Jupyter ✓
staticflow build --input test.heic    # HEIC ✓
staticflow build --input test.docx    # Word ✓
staticflow build --input test.xlsx    # Excel ✓
staticflow build --input formula.tex  # LaTeX 公式 ✓
staticflow build --input slides.pptx  # PPTX 基础 ✓ (文本+图片)

# 插件功能验证
staticflow plugin install latex-full
staticflow build --input paper.tex    # 完整 LaTeX → PDF ✓

staticflow plugin install pptx-full
staticflow build --input slides.pptx --full-render  # 完整渲染 ✓

staticflow plugin install raw-full
staticflow build --input photo.arw    # RAW 完整解码 ✓
```

---

*文档版本: v1.2*
*创建日期: 2026-02-02*
*更新日期: 2026-02-02*

---

## 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v1.0 | 2026-02-02 | 初版，完整技术方案 |
| v1.1 | 2026-02-02 | 新增迁移策略、libde265 裁剪详细方案、HEIC 优先实施计划 |
| v1.2 | 2026-02-02 | **插件架构**: Core (~15MB) + 可选插件 (PPTX/LaTeX/RAW ~135MB); 新增 Jupyter 支持; 重新定义格式支持矩阵; 插件生命周期管理; 分发策略选项 |
