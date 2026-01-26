#!/usr/bin/env node
/**
 * Generate posts.json from markdown files
 *
 * Scans blog/posts/ for markdown files with YAML frontmatter:
 *
 * ---
 * date: 2026-01-26
 * tags: [python, backend]
 * description: Optional description
 * ---
 * # Title from first heading
 *
 * Run: node build-posts-json.js
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, 'posts');
const OUTPUT_FILE = path.join(__dirname, 'posts.json');

// Parse YAML frontmatter (simple parser, handles basic cases)
function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { frontmatter: {}, body: content };

    const frontmatter = {};
    const yamlLines = match[1].split('\n');

    for (const line of yamlLines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();

        // Parse arrays: [item1, item2]
        if (value.startsWith('[') && value.endsWith(']')) {
            value = value.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''));
        }
        // Remove quotes from strings
        else if ((value.startsWith('"') && value.endsWith('"')) ||
                 (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        frontmatter[key] = value;
    }

    return { frontmatter, body: match[2] };
}

// Extract title from first # heading
function extractTitle(body) {
    const match = body.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : 'Untitled';
}

// Recursively find all .md files
function findMarkdownFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            findMarkdownFiles(fullPath, files);
        } else if (entry.name.endsWith('.md')) {
            files.push(fullPath);
        }
    }

    return files;
}

// Main
function main() {
    if (!fs.existsSync(POSTS_DIR)) {
        console.log('No posts directory found');
        return;
    }

    const mdFiles = findMarkdownFiles(POSTS_DIR);
    const posts = [];

    for (const mdPath of mdFiles) {
        const content = fs.readFileSync(mdPath, 'utf-8');
        const { frontmatter, body } = parseFrontmatter(content);

        // Generate slug from path: posts/2026/geocoding-client.md -> posts/2026/geocoding-client
        const relativePath = path.relative(__dirname, mdPath);
        const slug = relativePath.replace(/\.md$/, '');

        // Extract title from body
        const title = extractTitle(body);

        // Date is required
        if (!frontmatter.date) {
            console.log(`⚠ Skip: ${slug} (no date in frontmatter)`);
            continue;
        }

        const post = {
            slug,
            title,
            date: frontmatter.date
        };

        // Optional fields
        if (frontmatter.tags) {
            post.tags = frontmatter.tags;
        }
        if (frontmatter.description) {
            post.description = frontmatter.description;
        }

        posts.push(post);
        console.log(`✓ ${slug}`);
    }

    // Sort by date descending
    posts.sort((a, b) => b.date.localeCompare(a.date));

    // Write posts.json
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(posts, null, 2) + '\n');
    console.log(`\nGenerated: posts.json (${posts.length} posts)`);
}

main();
