---
date: 2024-01-01
tags: [ai]
legacy: true
---

# Astro-News-Bot：构建 AI 驱动的自动化新闻聚合与发布系统

在架构设计之初，我遵循了几个核心原则：

1. **模块化**：每个功能（抓取、去重、AI 处理、发布）都是独立模块，易于维护和替换
2. **自动化**：整个流程无需人工干预，实现"一次设置，永远运行"
3. **幂等性**：重复运行任务不产生副作用
4. **可扩展性**：方便增加新的新闻源或处理步骤

### 技术架构

基于这些原则，我设计了一个线性的数据处理管道：

```
RSS源 → 抓取器 → 向量去重 → AI摘要 → Markdown生成 → Git发布 → 博客部署
```

核心模块结构：

```
astro-news-bot/
├── news_bot/
│   ├── fetcher.py      # 新闻获取
│   ├── dedup.py        # 向量去重
│   ├── summarizer.py   # AI 摘要
│   ├── writer.py       # Markdown 生成
│   ├── selector.py     # 新闻筛选
│   ├── publisher.py    # Git 发布
│   └── job.py          # 工作流调度
├── config.json         # 配置文件
├── requirements.txt    # 依赖包
└── run_daily_news.sh  # 执行脚本
```

### 数据流程设计

1. **新闻获取** → 多源抓取 → `raw_{date}.json`
2. **向量去重** → 语义相似度过滤 → `dedup_{date}.json`  
3. **AI 摘要** → GPT-4o 生成中文摘要 → `summary_{date}.json`
4. **Markdown 生成** → 按类别组织 → `news_{date}.md`
5. **Git 发布** → 推送到博客仓库 → 触发自动部署

## 核心技术实现

### 1. 向量去重：告别简单的标题匹配

项目初期，我使用文章标题或 URL 进行去重，但很快发现问题：
- 不同新闻源对同一事件的报道标题不同
- URL 可能因包含追踪参数而不同

解决方案是**基于语义的向量去重**：

```python
# dedup.py 核心实现
from sentence_transformers import SentenceTransformer
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

class NewsDeduplicator:
    def __init__(self, similarity_threshold=0.85):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.threshold = similarity_threshold
        
    def deduplicate(self, articles):
        if not articles:
            return []
            
        # 提取标题文本
        titles = [article['title'] for article in articles]
        
        # 生成向量嵌入
        embeddings = self.model.encode(titles)
        
        # 计算相似度矩阵
        similarity_matrix = cosine_similarity(embeddings)
        
        # 去重逻辑
        to_keep = []
        for i, article in enumerate(articles):
            is_duplicate = False
            for j in to_keep:
                if similarity_matrix[i][j] > self.threshold:
                    is_duplicate = True
                    break
            if not is_duplicate:
                to_keep.append(i)
                
        return [articles[i] for i in to_keep]
```

这种方法能有效识别"换了个说法但内容一样"的文章，远比关键词匹配精准。

### 2. AI 摘要与分类：Prompt Engineering 的艺术

AI 摘要和分类的质量直接决定最终产出价值。关键不是选择哪个 LLM，而是如何设计 **Prompt**：

```python
# summarizer.py 核心 Prompt
SUMMARY_PROMPT = """
你是一个专业的科技新闻编辑，专门为开发者整理新闻摘要。

请为以下新闻生成：
1. 一段不超过100字的中文摘要，概括核心信息
2. 从以下分类中选择最合适的一个：人工智能、移动技术、自动驾驶、云计算、芯片技术、创业投资、网络安全、区块链、科学研究、其他科技

新闻内容：
标题：{title}
描述：{description}
来源：{source}

请以JSON格式返回：
{{
  "summary": "摘要内容",
  "category": "分类名称",
  "tags": ["标签1", "标签2", "标签3"]
}}
"""

class NewsSummarizer:
    def __init__(self):
        self.client = OpenAI()
        
    def process_article(self, article):
        prompt = SUMMARY_PROMPT.format(**article)
        
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.3
        )
        
        return json.loads(response.choices[0].message.content)
```

通过明确的角色、详细指令和输出格式要求，获得稳定高质量的 AI 输出。

### 3. GitOps 发布：稳定可靠的自动化部署

为什么选择 Git 而不是 API 操作博客后台？

- **原子性和可追溯性**：每次内容更新都是一次 Git Commit，可以清晰看到变更记录
- **解耦和安全**：机器人只需要 Git 仓库写权限，无需暴露博客后台凭证
- **利用现有 CI/CD**：复用 Vercel/Netlify 等平台的 Git-Triggered CI/CD

```python
# publisher.py 核心实现
import subprocess
import os

class NewsPublisher:
    def __init__(self, blog_repo_path):
        self.repo_path = blog_repo_path
        
    def publish(self, commit_message):
        try:
            # 切换到博客目录
            os.chdir(self.repo_path)
            
            # 拉取最新代码
            subprocess.run(['git', 'pull'], check=True)
            
            # 添加新文件
            subprocess.run(['git', 'add', '.'], check=True)
            
            # 检查是否有变更
            result = subprocess.run(['git', 'diff', '--cached', '--exit-code'], 
                                  capture_output=True)
            if result.returncode == 0:
                print("No changes to commit")
                return
                
            # 提交并推送
            subprocess.run(['git', 'commit', '-m', commit_message], check=True)
            subprocess.run(['git', 'push'], check=True)
            
            print(f"Successfully published: {commit_message}")
            
        except subprocess.CalledProcessError as e:
            print(f"Git operation failed: {e}")
```

## Astro 博客配套修改

要让 `astro-news-bot` 与 Astro 博客无缝集成，需要对博客工程做少量但关键的修改：

### 1. 定义 news 内容集合

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const news = defineCollection({
  loader: glob({ base: './src/content/news', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.string().optional(),
    pubDate: z.string().optional(),
    tags: z.array(z.string()).optional(),
    layout: z.string().optional(),
  }),
});

export const collections = {
  'news': news,
  // ... 其他集合
};
```

### 2. 创建 LatestNews 组件

```astro
---
// src/components/LatestNews.astro
import { getCollection } from 'astro:content';

const newsEntries = await getCollection('news');

let latestNews = null;
if (newsEntries && newsEntries.length > 0) {
  latestNews = newsEntries
    .filter(entry => entry.data && (entry.data.date || entry.data.pubDate))
    .sort((a, b) => {
      const dateA = new Date(a.data.date || a.data.pubDate);
      const dateB = new Date(b.data.date || b.data.pubDate);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 1)[0];
}
---

{latestNews && (
  <div class="latest-news">
    <h3>📰 最新资讯</h3>
    <div class="news-item">
      <h4>{latestNews.data.title}</h4>
      <p>{latestNews.data.description}</p>
      <a href={`/news/${latestNews.data.date || latestNews.data.pubDate}`}>
        阅读详情 →
      </a>
    </div>
  </div>
)}

<style>
  .latest-news {
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    padding: 1.5rem;
    margin: 1rem 0;
    background: #f8fafc;
  }
  
  .news-item h4 {
    margin: 0 0 0.5rem 0;
    color: #1a1a1a;
  }
  
  .news-item p {
    color: #666;
    margin: 0 0 1rem 0;
  }
  
  .news-item a {
    color: #2563eb;
    text-decoration: none;
    font-weight: 500;
  }
</style>
```

### 3. 修复动态路由渲染

由于 Astro 5.x 版本使用 glob loader，entry 对象结构发生变化，需要适配：

```astro
---
// src/pages/news/[date].astro
import { getCollection, getEntry } from 'astro:content';

export async function getStaticPaths() {
  const newsEntries = await getCollection('news');
  
  return newsEntries
    .filter(entry => entry.data && (entry.data.date || entry.data.pubDate))
    .map(entry => ({
      params: { 
        date: entry.data.date || entry.data.pubDate 
      },
      props: { 
        entryId: entry.id,  // 使用 entry.id 而不是 slug
        dateParam: entry.data.date || entry.data.pubDate
      }
    }));
}

const { entryId } = Astro.props;
const post = await getEntry('news', entryId);

if (!post) {
  throw new Error(`No news entry found for entryId: ${entryId}`);
}
---

<html>
  <body>
    <main>
      <h1>{post.data.title}</h1>
      <!-- 使用预渲染的内容 -->
      <div set:html={post.rendered.html}></div>
    </main>
  </body>
</html>
```

关键修改点：
- 使用 `entry.id` 而不是 `entry.slug`（glob loader 中 slug 为 undefined）
- 使用 `post.rendered.html` 获取预渲染内容
- 通过 `getEntry` 在页面渲染时获取完整 entry 对象

## 多样化的执行方式

为了适应不同的部署环境，我设计了多种执行方式：

### 1. 直接运行（开发调试）

```bash
# 完整工作流
python -m news_bot.job --date $(date +%Y-%m-%d)

# 干跑模式（跳过发布）
python -m news_bot.job --date 2025-07-25 --dry-run
```

### 2. Shell 脚本执行

```bash
#!/bin/bash
# run_daily_news.sh

cd "$(dirname "$0")"
source .env

# 创建日志目录
mkdir -p ~/logs

# 执行新闻处理流程
DATE=$(date +%Y-%m-%d)
echo "=== Starting news processing for $DATE ===" >> ~/logs/news_bot.log

python -m news_bot.job --date $DATE >> ~/logs/news_bot.log 2>&1

echo "=== Completed at $(date -Iseconds) ===" >> ~/logs/news_bot.log
```

### 3. 守护进程模式（推荐）

```bash
# 启动守护进程（完全后台运行）
./start_daemon.sh start

# 查看运行状态  
./start_daemon.sh status

# 查看日志
./start_daemon.sh logs

# 优雅停止
./stop_daemon.sh
```

### 4. Cron 定时任务

```bash
# 编辑 crontab
crontab -e

# 每天 8:05 执行
5 8 * * * /Users/geyuxu/repo/astro-news-bot/run_daily_news.sh
```

## 运维经验与最佳实践

### 配置文件管理

```json
{
  "output_config": {
    "blog_content_dir": "/Users/geyuxu/repo/blog/geyuxu.com/src/content/news",
    "filename_format": "news_{date}.md",
    "use_blog_dir": true
  },
  "git_config": {
    "target_branch": "gh-pages",
    "auto_switch_branch": true,
    "push_to_remote": true
  },
  "news_config": {
    "max_articles_per_day": 6,
    "token_budget_per_day": 4000,
    "similarity_threshold": 0.85
  },
  "llm_config": {
    "model": "gpt-4o",
    "max_tokens": 500,
    "temperature": 0.3
  },
  "scheduler_config": {
    "enabled": true,
    "timezone": "Asia/Shanghai",
    "cron_expression": "0 8 * * *"
  }
}
```

### 成本控制

- 每日处理约 6 篇文章
- 预计 Token 消耗：~4000 tokens/天
- OpenAI 成本：约 $0.01-0.05/天

### 日志管理

```bash
# 查看实时日志
tail -f logs/daemon.log

# 查看调度器日志
tail -f logs/scheduler.log

# 查看今天的执行记录
grep "$(date +%Y-%m-%d)" ~/logs/news_bot.log
```

## 项目价值与成果

### 测试验证结果

最新测试（2025-07-26）：
- ✅ **Fetcher**：获取 31 篇科技新闻（RSS 源）
- ✅ **Deduplicator**：向量去重，保留 31 篇唯一文章
- ✅ **Summarizer**：AI 摘要生成，使用 10,681 tokens
- ✅ **Writer**：生成 188 行 Markdown，包含 7 个科技分类
- ✅ **Publisher**：成功提交并推送到博客仓库

### 新闻分类体系

系统自动将新闻归类到 9 个科技领域：
- 🤖 人工智能
- 📱 移动技术  
- 🚗 自动驾驶
- ☁️ 云计算
- 💾 芯片技术
- 💰 创业投资
- 🔒 网络安全
- ⛓️ 区块链
- 🔬 科学研究

### 输出格式示例

```markdown
---
title: 每日新闻速览 · 2025-07-26
pubDate: '2025-07-26'
description: 2025年，美国半导体市场经历了重要变革...
tags: [News, Daily, 芯片技术, 自动驾驶, 移动技术]
layout: news
---

## 芯片技术

- **A timeline of the US semiconductor market in 2025**
  2025年，美国半导体市场经历了重要变革，包括传统半导体公司领导层的更替以及芯片出口政策的反复无常。
  *标签：半导体 · 美国市场 · 政策变化*
  [阅读原文](https://techcrunch.com/2025/07/25/...) | 来源：TechCrunch

## 自动驾驶

- **Tesla is reportedly bringing robotaxi service to San Francisco**
  特斯拉计划在旧金山推出限量版自动驾驶出租车服务，与奥斯汀的服务不同，此次将有员工坐在驾驶座上以确保安全。
  *标签：特斯拉 · 自动驾驶 · 出租车服务*
  [阅读原文](https://techcrunch.com/2025/07/25/...) | 来源：TechCrunch
```

## 未来规划

1. **更智能的信源发现**：让机器人自动发现和推荐新的高质量新闻源
2. **趋势分析与主题聚合**：识别特定时间段内的热点话题，聚合相关文章
3. **用户反馈闭环**：收集用户反馈数据，用于微调 AI 模型
4. **开源计划**：整理代码后开源，让更多人搭建自己的 AI 新闻机器人

## 总结

`astro-news-bot` 是一个"用技术解决自己问题"的典型项目。它将 AI、自动化脚本、现代 Web 开发框架（Astro）和 DevOps 理念（GitOps）有机结合，构建了一个小而美的自动化系统。

这个项目不仅解决了我的信息过载问题，也是实践 LLM 应用、向量数据库、GitOps 等新技术的绝佳试验田。如果你也想构建类似的系统，希望这篇文章能给你一些启发和参考。

关键技术栈：
- **后端**：Python + OpenAI API + SentenceTransformers
- **前端**：Astro + TypeScript + Content Collections
- **部署**：GitOps + Shell Scripts + Cron Jobs
- **数据**：JSON + Markdown + Git

整个系统体现了现代 AI 应用开发的最佳实践：模块化设计、向量化处理、自动化部署和持续运维。