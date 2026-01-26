#!/usr/bin/env node
/**
 * Build Medium-friendly HTML
 * - Creates GitHub Gists for long code blocks (>15 lines)
 * - Converts tables to bullet lists
 * Output: /blog/medium/{slug}.html
 * Run: GITHUB_TOKEN_CRTATE_GIST=xxx node build-medium.js
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const POSTS_JSON = path.join(__dirname, 'posts.json');
const OUTPUT_DIR = path.join(__dirname, 'medium');
const GIST_CACHE_FILE = path.join(__dirname, '.gist-cache.json');
const MAX_CODE_LINES = 15;

// GitHub API for Gist creation
const GITHUB_TOKEN_CRTATE_GIST = process.env.GITHUB_TOKEN_CRTATE_GIST;

// Load or initialize gist cache
let gistCache = {};
if (fs.existsSync(GIST_CACHE_FILE)) {
    gistCache = JSON.parse(fs.readFileSync(GIST_CACHE_FILE, 'utf-8'));
}

// Create a hash for code content to use as cache key
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

// Create GitHub Gist
async function createGist(code, language, description) {
    const ext = { python: 'py', javascript: 'js', typescript: 'ts', bash: 'sh', text: 'txt' }[language] || language || 'txt';
    const filename = `code.${ext}`;

    const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN_CRTATE_GIST}`,
            'Content-Type': 'application/json',
            'User-Agent': 'build-medium.js'
        },
        body: JSON.stringify({
            description: description || 'Code snippet',
            public: true,
            files: {
                [filename]: { content: code }
            }
        })
    });

    const data = await response.json();

    if (!response.ok) {
        const msg = data.message || `Status ${response.status}`;
        throw new Error(`GitHub API: ${msg}`);
    }

    return data.html_url;
}

// Store pending gists to create
const pendingGists = [];

// Custom renderer for Medium compatibility
const renderer = new marked.Renderer();

// Replace long code blocks with placeholder or gist link
renderer.code = function({ text, lang }) {
    const code = text || '';
    const language = lang || 'text';
    const lines = code.split('\n');

    if (lines.length > MAX_CODE_LINES) {
        const codeHash = hashCode(code);
        const preview = lines.slice(0, 8).join('\n');

        // Check cache for existing gist
        if (gistCache[codeHash]) {
            return `<pre><code class="language-${language}">${escapeHtml(preview)}\n# ... (${lines.length - 8} more lines)</code></pre>
<p><em>View full code: <a href="${gistCache[codeHash]}">${gistCache[codeHash]}</a></em></p>`;
        }

        // Queue for gist creation (always track, create only if token available)
        pendingGists.push({ code, language, hash: codeHash, lines: lines.length });

        if (GITHUB_TOKEN_CRTATE_GIST) {
            // Will replace placeholder with actual gist URL later
            return `<pre><code class="language-${language}">${escapeHtml(preview)}\n# ... (${lines.length - 8} more lines)</code></pre>
<p><em>View full code: <a href="__GIST_${codeHash}__">GitHub Gist</a></em></p>`;
        }

        // No token - fallback to repo link
        return `<pre><code class="language-${language}">${escapeHtml(preview)}\n# ... (${lines.length - 8} more lines)</code></pre>
<p><em>Full code available in the <a href="https://github.com/geyuxu">GitHub repository</a>.</em></p>`;
    }

    // Short code block - keep as-is
    return `<pre><code class="language-${language}">${escapeHtml(code)}</code></pre>`;
};

// Convert tables to bullet lists
renderer.table = function({ header, rows }) {
    // Extract header text from tokens
    const headers = header.map(h => {
        if (h.tokens && h.tokens.length > 0) {
            return h.tokens.map(t => t.text || t.raw || '').join('');
        }
        return h.text || '';
    });

    let result = '<p><strong>Summary:</strong></p>\n<ul>\n';

    rows.forEach(row => {
        const cells = row.map(cell => {
            if (cell.tokens && cell.tokens.length > 0) {
                return cell.tokens.map(t => t.text || t.raw || '').join('');
            }
            return cell.text || '';
        });

        if (cells.length >= 2) {
            // Format: "Header1: Cell1 — Header2: Cell2 — ..."
            let item = cells.map((cell, i) => {
                if (headers[i] && headers[i] !== cells[0]) {
                    return `${headers[i]}: ${cell}`;
                }
                return cell;
            }).join(' — ');
            result += `  <li>${item}</li>\n`;
        }
    });

    result += '</ul>';
    return result;
};

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Configure marked
marked.setOptions({
    renderer: renderer,
    gfm: true,
    breaks: false
});

// Build HTML wrapper
function buildHtml(title, content) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: Georgia, serif; max-width: 700px; margin: 2rem auto; padding: 0 1rem; line-height: 1.7; color: #333; }
        h1 { font-size: 2rem; margin-bottom: 0.5rem; }
        h2 { font-size: 1.4rem; margin-top: 2rem; }
        pre { background: #f4f4f4; padding: 1rem; overflow-x: auto; border-radius: 4px; }
        code { font-family: Menlo, Monaco, monospace; font-size: 0.9em; }
        p code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; }
        img { max-width: 100%; }
        blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 1rem; color: #666; }
        ul { padding-left: 1.5rem; }
        hr { border: none; border-top: 1px solid #ddd; margin: 2rem 0; }
        a { color: #1a8917; }
    </style>
</head>
<body>
${content}
</body>
</html>`;
}

// Main async build function
async function build() {
    const posts = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf-8'));

    // Clean and recreate output dir
    if (fs.existsSync(OUTPUT_DIR)) {
        fs.rmSync(OUTPUT_DIR, { recursive: true });
        console.log('✓ Cleaned medium/');
    }
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Track generated HTML for each post (to replace gist placeholders later)
    const postOutputs = [];

    for (const post of posts) {
        const mdPath = path.join(__dirname, `${post.slug}.md`);

        if (!fs.existsSync(mdPath)) {
            console.log(`⚠ Skip: ${post.slug}.md not found`);
            continue;
        }

        const markdown = fs.readFileSync(mdPath, 'utf-8');
        const htmlContent = marked.parse(markdown);
        const htmlPath = path.join(OUTPUT_DIR, `${post.slug}.html`);

        postOutputs.push({ post, htmlContent, htmlPath });
    }

    // Create gists if we have pending ones and a token
    if (pendingGists.length > 0 && GITHUB_TOKEN_CRTATE_GIST) {
        const masked = GITHUB_TOKEN_CRTATE_GIST.slice(0, 4) + '...' + GITHUB_TOKEN_CRTATE_GIST.slice(-4);
        console.log(`\n📤 Creating ${pendingGists.length} GitHub Gists (token: ${masked})...`);

        for (const gist of pendingGists) {
            try {
                const url = await createGist(gist.code, gist.language, `Code snippet (${gist.lines} lines)`);
                gistCache[gist.hash] = url;
                console.log(`  ✓ Gist created: ${url}`);
            } catch (err) {
                console.log(`  ✗ Failed to create gist: ${err.message}`);
            }
        }

        // Save cache
        fs.writeFileSync(GIST_CACHE_FILE, JSON.stringify(gistCache, null, 2));
        console.log(`✓ Gist cache saved to .gist-cache.json`);
    } else if (pendingGists.length > 0) {
        console.log(`\n⚠ ${pendingGists.length} long code blocks found but no GITHUB_TOKEN_CRTATE_GIST set.`);
        console.log('  Run with: GITHUB_TOKEN_CRTATE_GIST=xxx node build-medium.js');
    }

    // Write HTML files (replace gist placeholders with actual URLs)
    for (const { post, htmlContent, htmlPath } of postOutputs) {
        let finalHtml = htmlContent;

        // Replace placeholders with cached gist URLs
        for (const [hash, url] of Object.entries(gistCache)) {
            finalHtml = finalHtml.replace(new RegExp(`__GIST_${hash}__`, 'g'), url);
        }

        const fullHtml = buildHtml(post.title, finalHtml);
        fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
        fs.writeFileSync(htmlPath, fullHtml);

        console.log(`✓ ${post.slug}.html`);
    }

    console.log(`\nDone! Medium-friendly files in: ${OUTPUT_DIR}/`);
    if (GITHUB_TOKEN_CRTATE_GIST) {
        console.log('Note: Long code blocks converted to GitHub Gists.');
    } else {
        console.log('Note: Long code blocks truncated (set GITHUB_TOKEN_CRTATE_GIST for Gist creation).');
    }
    console.log('Note: Tables converted to bullet lists.');
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
