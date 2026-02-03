---
date: 2024-01-01
tags: [ai]
legacy: true
---

# Astro-News-Bot: Building an AI-Driven Automated News Aggregation and Publishing System

During the initial architecture design, I followed several core principles:

1. **Modularity**: Each function (crawling, deduplication, AI processing, publishing) should be an independent module, easy to maintain and replace
2. **Automation**: The entire process requires no manual intervention, achieving "set once, run forever"
3. **Idempotency**: Repeated task execution produces no side effects
4. **Scalability**: Easy to add new news sources or processing steps

### Technical Architecture

Based on these principles, I designed a linear data processing pipeline:

```
RSS Sources → Fetcher → Vector Dedup → AI Summary → Markdown Generation → Git Publishing → Blog Deployment
```

Core module structure:

```
astro-news-bot/
├── news_bot/
│   ├── fetcher.py      # News fetching
│   ├── dedup.py        # Vector deduplication
│   ├── summarizer.py   # AI summarization
│   ├── writer.py       # Markdown generation
│   ├── selector.py     # News filtering
│   ├── publisher.py    # Git publishing
│   └── job.py          # Workflow orchestration
├── config.json         # Configuration file
├── requirements.txt    # Dependencies
└── run_daily_news.sh  # Execution script
```

### Data Flow Design

1. **News Fetching** → Multi-source crawling → `raw_{date}.json`
2. **Vector Deduplication** → Semantic similarity filtering → `dedup_{date}.json`  
3. **AI Summarization** → GPT-4o generates Chinese summaries → `summary_{date}.json`
4. **Markdown Generation** → Organized by category → `news_{date}.md`
5. **Git Publishing** → Push to blog repository → Trigger automatic deployment

## Core Technical Implementation

### 1. Vector Deduplication: Beyond Simple Title Matching

In the early stages, I used article titles or URLs for deduplication, but quickly discovered issues:
- Different news sources use different titles for the same event
- URLs may differ due to tracking parameters

The solution is **semantic-based vector deduplication**:

```python
# dedup.py core implementation
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
            
        # Extract title text
        titles = [article['title'] for article in articles]
        
        # Generate vector embeddings
        embeddings = self.model.encode(titles)
        
        # Calculate similarity matrix
        similarity_matrix = cosine_similarity(embeddings)
        
        # Deduplication logic
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

This method effectively identifies articles that "say the same thing in different ways," far more accurate than keyword matching.

### 2. AI Summarization and Classification: The Art of Prompt Engineering

The quality of AI summarization and classification directly determines the final output value. The key isn't which LLM to choose, but how to design **Prompts**:

```python
# summarizer.py core Prompt
SUMMARY_PROMPT = """
You are a professional tech news editor specializing in organizing news summaries for developers.

Please generate for the following news:
1. A Chinese summary of no more than 100 words, summarizing core information
2. Select the most appropriate category from: Artificial Intelligence, Mobile Technology, Autonomous Driving, Cloud Computing, Chip Technology, Venture Capital, Cybersecurity, Blockchain, Scientific Research, Other Tech

News content:
Title: {title}
Description: {description}
Source: {source}

Please return in JSON format:
{{
  "summary": "Summary content",
  "category": "Category name",
  "tags": ["Tag1", "Tag2", "Tag3"]
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

Through clear roles, detailed instructions, and output format requirements, we achieve stable, high-quality AI output.

### 3. GitOps Publishing: Reliable Automated Deployment

Why choose Git instead of API operations on the blog backend?

- **Atomicity and Traceability**: Every content update is a Git commit, providing clear change records
- **Decoupling and Security**: The bot only needs Git repository write permissions, no need to expose blog backend credentials
- **Leverage Existing CI/CD**: Reuse Git-triggered CI/CD from platforms like Vercel/Netlify

```python
# publisher.py core implementation
import subprocess
import os

class NewsPublisher:
    def __init__(self, blog_repo_path):
        self.repo_path = blog_repo_path
        
    def publish(self, commit_message):
        try:
            # Switch to blog directory
            os.chdir(self.repo_path)
            
            # Pull latest code
            subprocess.run(['git', 'pull'], check=True)
            
            # Add new files
            subprocess.run(['git', 'add', '.'], check=True)
            
            # Check for changes
            result = subprocess.run(['git', 'diff', '--cached', '--exit-code'], 
                                  capture_output=True)
            if result.returncode == 0:
                print("No changes to commit")
                return
                
            # Commit and push
            subprocess.run(['git', 'commit', '-m', commit_message], check=True)
            subprocess.run(['git', 'push'], check=True)
            
            print(f"Successfully published: {commit_message}")
            
        except subprocess.CalledProcessError as e:
            print(f"Git operation failed: {e}")
```

## Astro Blog Integration Modifications

To achieve seamless integration between `astro-news-bot` and the Astro blog, minimal but crucial modifications to the blog project are needed:

### 1. Define News Content Collection

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
  // ... other collections
};
```

### 2. Create LatestNews Component

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
    <h3>📰 Latest News</h3>
    <div class="news-item">
      <h4>{latestNews.data.title}</h4>
      <p>{latestNews.data.description}</p>
      <a href={`/news/${latestNews.data.date || latestNews.data.pubDate}`}>
        Read More →
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

### 3. Fix Dynamic Route Rendering

Due to structural changes in entry objects with glob loader in Astro 5.x, adaptation is needed:

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
        entryId: entry.id,  // Use entry.id instead of slug
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
      <!-- Use pre-rendered content -->
      <div set:html={post.rendered.html}></div>
    </main>
  </body>
</html>
```

Key modification points:
- Use `entry.id` instead of `entry.slug` (slug is undefined in glob loader)
- Use `post.rendered.html` to get pre-rendered content
- Get complete entry object via `getEntry` during page rendering

## Diverse Execution Methods

To adapt to different deployment environments, I designed multiple execution methods:

### 1. Direct Execution (Development & Debugging)

```bash
# Complete workflow
python -m news_bot.job --date $(date +%Y-%m-%d)

# Dry run mode (skip publishing)
python -m news_bot.job --date 2025-07-25 --dry-run
```

### 2. Shell Script Execution

```bash
#!/bin/bash
# run_daily_news.sh

cd "$(dirname "$0")"
source .env

# Create log directory
mkdir -p ~/logs

# Execute news processing workflow
DATE=$(date +%Y-%m-%d)
echo "=== Starting news processing for $DATE ===" >> ~/logs/news_bot.log

python -m news_bot.job --date $DATE >> ~/logs/news_bot.log 2>&1

echo "=== Completed at $(date -Iseconds) ===" >> ~/logs/news_bot.log
```

### 3. Daemon Mode (Recommended)

```bash
# Start daemon (complete background execution)
./start_daemon.sh start

# Check running status  
./start_daemon.sh status

# View logs
./start_daemon.sh logs

# Graceful stop
./stop_daemon.sh
```

### 4. Cron Scheduled Tasks

```bash
# Edit crontab
crontab -e

# Execute daily at 8:05
5 8 * * * /Users/geyuxu/repo/astro-news-bot/run_daily_news.sh
```

## Operations Experience and Best Practices

### Configuration Management

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

### Cost Control

- Daily processing: ~6 articles
- Estimated token consumption: ~4000 tokens/day
- OpenAI cost: ~$0.01-0.05/day

### Log Management

```bash
# View real-time logs
tail -f logs/daemon.log

# View scheduler logs
tail -f logs/scheduler.log

# View today's execution records
grep "$(date +%Y-%m-%d)" ~/logs/news_bot.log
```

## Project Value and Results

### Test Validation Results

Latest test (2025-07-26):
- ✅ **Fetcher**: Retrieved 31 tech news articles (RSS sources)
- ✅ **Deduplicator**: Vector deduplication, retained 31 unique articles
- ✅ **Summarizer**: AI summary generation, used 10,681 tokens
- ✅ **Writer**: Generated 188-line Markdown with 7 tech categories
- ✅ **Publisher**: Successfully committed and pushed to blog repository

### News Classification System

The system automatically categorizes news into 9 tech domains:
- 🤖 Artificial Intelligence
- 📱 Mobile Technology  
- 🚗 Autonomous Driving
- ☁️ Cloud Computing
- 💾 Chip Technology
- 💰 Venture Capital
- 🔒 Cybersecurity
- ⛓️ Blockchain
- 🔬 Scientific Research

### Output Format Example

```markdown
---
title: Daily News Digest · 2025-07-26
pubDate: '2025-07-26'
description: In 2025, the US semiconductor market experienced significant changes...
tags: [News, Daily, Chip Technology, Autonomous Driving, Mobile Technology]
layout: news
---

## Chip Technology

- **A timeline of the US semiconductor market in 2025**
  In 2025, the US semiconductor market experienced significant changes, including leadership transitions at traditional semiconductor companies and volatile chip export policies.
  *Tags: Semiconductor · US Market · Policy Changes*
  [Read Original](https://techcrunch.com/2025/07/25/...) | Source: TechCrunch

## Autonomous Driving

- **Tesla is reportedly bringing robotaxi service to San Francisco**
  Tesla plans to launch a limited version of its autonomous taxi service in San Francisco. Unlike the Austin service, this test will have employees in the driver's seat for safety.
  *Tags: Tesla · Autonomous Driving · Taxi Service*
  [Read Original](https://techcrunch.com/2025/07/25/...) | Source: TechCrunch
```

## Future Plans

1. **Smarter Source Discovery**: Enable the bot to automatically discover and recommend new high-quality news sources
2. **Trend Analysis & Topic Aggregation**: Identify hot topics within specific time periods and aggregate related articles
3. **User Feedback Loop**: Collect user feedback data for fine-tuning AI models
4. **Open Source Plan**: Clean up code and open source to help others build their own AI news bots

## Conclusion

`astro-news-bot` is a typical "use technology to solve your own problems" project. It organically combines AI, automation scripts, modern web development frameworks (Astro), and DevOps principles (GitOps) to build an elegant automated system.

This project not only solves my information overload problem but also serves as an excellent testbed for practicing LLM applications, vector databases, GitOps, and other emerging technologies. If you want to build a similar system, I hope this article provides some inspiration and reference.

Key Tech Stack:
- **Backend**: Python + OpenAI API + SentenceTransformers
- **Frontend**: Astro + TypeScript + Content Collections
- **Deployment**: GitOps + Shell Scripts + Cron Jobs
- **Data**: JSON + Markdown + Git

The entire system embodies modern AI application development best practices: modular design, vectorized processing, automated deployment, and continuous operations.