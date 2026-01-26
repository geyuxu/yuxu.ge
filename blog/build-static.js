#!/usr/bin/env node
/**
 * Build static HTML for crawlers/Medium
 * Output: /blog/static/{slug}.html
 * Run: node build.js
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const TEMPLATE_PATH = path.join(__dirname, 'post.html');
const POSTS_JSON = path.join(__dirname, 'posts.json');
const OUTPUT_DIR = path.join(__dirname, 'static');

// Read template
const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

// Extract before article (fix relative paths)
const beforeArticle = template.match(/[\s\S]*?<article id="article">/)[0]
    .replace('<article id="article">', '<article>')
    .replace(/<div class="loading">Loading\.\.\.<\/div>/, '')
    .replace(/\.\.\/photo\.jpg/g, '/photo.jpg');

// After article - with Prism and copy button (no line number JS - we do it in build)
const afterArticle = `    </article>
    </main>
</div>

<script src="https://cdn.jsdelivr.net/npm/prismjs@1/prism.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-python.min.js"></script>
<script>
Prism.highlightAll();
document.querySelectorAll('article pre').forEach(pre => {
    const code = pre.querySelector('code');
    if (!code) return;
    const toolbar = document.createElement('div');
    toolbar.className = 'code-toolbar';
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.onclick = () => {
        navigator.clipboard.writeText(code.textContent).then(() => {
            btn.textContent = 'Copied!';
            btn.classList.add('copied');
            setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
        });
    };
    toolbar.appendChild(btn);
    pre.parentNode.insertBefore(toolbar, pre);
});
</script>
</body>
</html>`;

// Process code blocks to add line number spans at build time
function addLineNumbers(html) {
    return html.replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g, (match, attrs, code) => {
        const lines = code.split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        const wrappedLines = lines.map(line => `<span class="line">${line}</span>`).join('\n');
        return `<pre><code${attrs}>${wrappedLines}</code></pre>`;
    });
}

// Read posts
const posts = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf-8'));

// Clean and recreate output dir
if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
    console.log('✓ Cleaned static/');
}
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

posts.forEach(post => {
    const mdPath = path.join(__dirname, `${post.slug}.md`);

    if (!fs.existsSync(mdPath)) {
        console.log(`⚠ Skip: ${post.slug}.md not found`);
        return;
    }

    const markdown = fs.readFileSync(mdPath, 'utf-8');
    let htmlContent = marked.parse(markdown);

    // Add line numbers to code blocks at build time
    htmlContent = addLineNumbers(htmlContent);

    // Build static HTML
    const staticHtml = beforeArticle
        .replace(/<title>.*?<\/title>/, `<title>${post.title} | Yuxu Ge</title>`)
        + '\n' + htmlContent + '\n'
        + afterArticle;

    // Output path
    const htmlPath = path.join(OUTPUT_DIR, `${post.slug}.html`);
    fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
    fs.writeFileSync(htmlPath, staticHtml);

    console.log(`✓ ${post.slug}.html`);
});

console.log(`\nDone! Files in: ${OUTPUT_DIR}/`);
