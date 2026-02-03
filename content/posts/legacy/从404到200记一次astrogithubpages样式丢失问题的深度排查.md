---
date: 2024-01-01
tags: [devops]
legacy: true
---

# 从 404 到 200：记一次 Astro + GitHub Pages 样式丢失问题的深度排查

这些 CSS 文件的路径看起来像这样：
```
https://geyuxu.com/_astro/_slug_.BvCO7WHQ.css
```

问题很明确：服务器无法找到 Astro 构建出来的 CSS 文件。但为什么呢？

## 二、漫漫排查路：错误的假设

我的排查过程遵循了典型的从易到难、从普遍到特殊的思路，但也因此走了一些弯路。

### 假设 1：Jekyll 捣乱？

GitHub Pages 默认使用 Jekyll 来构建网站。Jekyll 有一个众所周知的约定：它会忽略所有以下划线 (`_`) 开头的目录和文件，因为它们被认为是特殊的，比如 `_posts`、`_includes` 等。

Astro 构建产物中的 CSS 目录恰好是 `_astro`。这看起来就是罪魁祸首！

**解决方案尝试**：在仓库的根目录添加一个空的 `.nojekyll` 文件。这个文件的作用是告诉 GitHub Pages："请不要用 Jekyll 处理我的网站，我这是一个纯静态站点。"

**结果**：清理缓存，重新部署，问题依旧。`_astro` 目录下的 CSS 文件仍然是 404。

这个结果让我很困惑。`.nojekyll` 应该已经禁用了 Jekyll，为什么以下划线开头的资源还是无法访问？

### 假设 2：目录访问问题？

我开始怀疑是不是 `_astro` 目录本身因为某些服务器配置而无法被直接访问。或许它缺少一个 `index.html` 文件？

**解决方案尝试**：在 `dist/_astro/` 目录下手动创建一个空的 `index.html` 文件，然后重新部署。

**结果**：毫无悬念，失败了。这本就是一个不切实际的猜测，因为我们是请求具体的文件，而不是访问目录。

## 三、柳暗花明：定位真正原因

在排除了最常见的 Jekyll 问题后，我开始重新审视那个神秘的 404。`.nojekyll` 文件确实禁用了 Jekyll 的构建过程，但它并不能覆盖 GitHub Pages 服务器的所有规则。

经过一番搜索和验证，我终于发现了问题的关键：

> **GitHub Pages (或其底层的 Web 服务器) 有一条更深层的规则：它会阻止所有对以下划线 (`_`) 开头的文件的直接访问，这似乎是一个安全或约定策略，独立于 Jekyll 的行为。**

Astro 生成的 CSS 文件名，例如 `_slug_.BvCO7WHQ.css`，恰好也以下划线开头！这才是 `.nojekyll` 文件无效的根本原因。我们不仅要处理 `_astro` 目录，还要处理文件名本身。

## 四、终极解决方案：自定义 Astro 构建产物命名

既然无法改变 GitHub Pages 的规则，那我们就只能改变我们自己的产物。我们需要让 Astro 在构建时，不要生成以下划线开头的文件名。

幸运的是，Astro 底层使用 Vite 作为其构建工具，并向我们开放了 Vite 的配置接口。我们可以通过修改 `astro.config.mjs` 文件来定制构建行为。

### 配置方案

具体的配置项是 `vite.build.rollupOptions.output.assetFileNames`。它可以让我们完全控制资源文件（如 CSS、图片等）的输出路径和名称。

打开项目根目录下的 `astro.config.mjs` 文件，添加 `vite` 配置项：

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://geyuxu.com',
  // ... 其他配置
  vite: {
    build: {
      rollupOptions: {
        output: {
          // 修改资产文件命名规则，避免下划线开头
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            const name = info.slice(0, -1).join('.');
            // 如果文件名以下划线开头，替换为 'assets-'
            const finalName = name.startsWith('_') ? name.replace(/^_/, 'assets-') : name;
            return `_astro/${finalName}.[hash].${ext}`;
          }
        }
      }
    }
  },
  // ... 其他配置如 markdown 等
});
```

### 代码解释

- `assetFileNames` 接受一个函数，该函数为每个资源文件调用
- `assetInfo.name` 包含了 Vite 建议的原始文件名，例如 `_slug_.BvCO7WHQ.css`
- 我们检查 `assetInfo.name` 是否以 `_` 开头
- 如果是，我们使用 `replace(/^_/, 'assets-')` 将开头的下划线替换为 `assets-`
- 最终生成的文件名变成了 `assets-slug_.BvCO7WHQ.css`

### 验证结果

在应用了以上配置后，重新运行 `npm run build`，然后将 `dist` 目录部署到 GitHub Pages：

```bash
npm run build
npm run deploy
```

**结果**：成功！CSS 文件现在以 `assets-slug_.BvCO7WHQ.css` 这样的路径加载，HTTP 状态码从 404 变成了 200。网站样式完美呈现。

我们可以通过以下命令验证：

```bash
curl -I https://geyuxu.com/_astro/assets-slug_.BvCO7WHQ.css
```

返回：
```
HTTP/2 200 
content-type: text/css; charset=utf-8
```

## 五、总结与反思

这次调试经历虽然曲折，但收获颇丰：

### 关键经验

1. **深入理解平台限制**：不能想当然地认为 `.nojekyll` 能解决所有问题。需要了解托管平台（GitHub Pages）自身的底层规则，而不仅仅是其表面工具（Jekyll）的规则。

2. **从根源解决问题**：与其尝试用各种"补丁"去适应部署环境，不如直接控制构建过程，生成符合环境要求的产物。这是一种更干净、更可维护的解决方案。

3. **善用工具的配置能力**：现代前端框架（如 Astro）和构建工具（如 Vite）通常都提供了强大的配置选项。深入阅读文档、了解这些配置项，是解决复杂问题的金钥匙。

4. **下划线是特殊字符**：在 Web 开发中，以下划线开头的文件/目录通常有特殊含义（如 Jekyll, Node.js 的私有模块等）。在命名和部署时要特别留意，避免与平台规则冲突。

### Debug 技巧

- **系统性排查**：从最常见的原因开始，逐步深入
- **验证假设**：每个解决方案都要实际测试，不能想当然
- **关注细节**：文件名、路径、HTTP 状态码等细节往往包含关键信息
- **查阅文档**：当常见解决方案失效时，深入研究工具的配置选项

### 适用场景

这个解决方案适用于所有遇到类似问题的 Astro + GitHub Pages 部署场景，也可以扩展到其他使用 Vite 构建工具的框架（如 Vue、React 等）在 GitHub Pages 上的部署问题。

希望我的经验能为你节省一些调试时间。Happy coding!