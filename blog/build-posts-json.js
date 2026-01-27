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

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['.md', '.ipynb', '.pdf', '.docx', '.txt', '.xlsx', '.pptx', '.csv'];

// Recursively find all supported files
function findPostFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            findPostFiles(fullPath, files);
        } else if (SUPPORTED_EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
        }
    }

    return files;
}

// Extract date from filename if format is yyyyMMdd-name.ext
// Returns { date: 'YYYY-MM-DD', name: 'name' } or null
function parseDateFromFilename(filename) {
    const match = filename.match(/^(\d{4})(\d{2})(\d{2})-(.+)$/);
    if (match) {
        const [, year, month, day, name] = match;
        // Validate date
        const dateStr = `${year}-${month}-${day}`;
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return { date: dateStr, name };
        }
    }
    return null;
}

// Get file type from extension
function getFileType(filePath) {
    if (filePath.endsWith('.md')) return 'markdown';
    if (filePath.endsWith('.ipynb')) return 'notebook';
    if (filePath.endsWith('.pdf')) return 'pdf';
    if (filePath.endsWith('.docx')) return 'word';
    if (filePath.endsWith('.txt')) return 'text';
    if (filePath.endsWith('.xlsx')) return 'excel';
    if (filePath.endsWith('.pptx')) return 'powerpoint';
    if (filePath.endsWith('.csv')) return 'csv';
    return 'unknown';
}

// Parse Jupyter notebook metadata
function parseNotebook(content, filePath) {
    try {
        const notebook = JSON.parse(content);
        const cells = notebook.cells || [];

        // Find metadata in first markdown cell (looking for YAML frontmatter)
        let frontmatter = {};
        let titleCell = null;

        for (const cell of cells) {
            if (cell.cell_type === 'markdown') {
                const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;

                // Check for YAML frontmatter (---\n...\n---)
                const fmMatch = source.match(/^---\n([\s\S]*?)\n---/);
                if (fmMatch && Object.keys(frontmatter).length === 0) {
                    const yamlLines = fmMatch[1].split('\n');
                    for (const line of yamlLines) {
                        const colonIndex = line.indexOf(':');
                        if (colonIndex === -1) continue;
                        const key = line.slice(0, colonIndex).trim();
                        let value = line.slice(colonIndex + 1).trim();
                        // Parse arrays
                        if (value.startsWith('[') && value.endsWith(']')) {
                            value = value.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''));
                        } else if ((value.startsWith('"') && value.endsWith('"')) ||
                                   (value.startsWith("'") && value.endsWith("'"))) {
                            value = value.slice(1, -1);
                        }
                        frontmatter[key] = value;
                    }
                }

                // Find first # heading for title
                if (!titleCell) {
                    const titleMatch = source.match(/^#\s+(.+)$/m);
                    if (titleMatch) {
                        titleCell = titleMatch[1].trim();
                    }
                }
            }
        }

        return {
            frontmatter,
            title: titleCell || path.basename(filePath, '.ipynb')
        };
    } catch (err) {
        console.log(`⚠ Error parsing notebook ${filePath}: ${err.message}`);
        return null;
    }
}

// Get file creation date (birthtime) formatted as YYYY-MM-DD
function getFileCreationDate(filePath) {
    const stats = fs.statSync(filePath);
    const birthtime = stats.birthtime;
    const year = birthtime.getFullYear();
    const month = String(birthtime.getMonth() + 1).padStart(2, '0');
    const day = String(birthtime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Main
function main() {
    if (!fs.existsSync(POSTS_DIR)) {
        console.log('No posts directory found');
        return;
    }

    const postFiles = findPostFiles(POSTS_DIR);
    const posts = [];

    for (const filePath of postFiles) {
        const fileType = getFileType(filePath);
        const ext = path.extname(filePath);
        const basename = path.basename(filePath, ext);

        let frontmatter = {};
        let title;
        let postDate;

        // Try to extract date from filename (yyyyMMdd-name format)
        const filenameParsed = parseDateFromFilename(basename);

        if (fileType === 'markdown') {
            // Parse Markdown with frontmatter
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = parseFrontmatter(content);
            frontmatter = parsed.frontmatter;
            title = extractTitle(parsed.body);

            postDate = frontmatter.date;
            if (!postDate) {
                console.log(`⚠ Skip: ${basename} (no date in frontmatter)`);
                continue;
            }
        } else if (fileType === 'notebook') {
            // Parse Jupyter notebook
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = parseNotebook(content, filePath);
            if (!parsed) continue;
            frontmatter = parsed.frontmatter;
            title = parsed.title;

            // Date: frontmatter > filename > creation time
            postDate = frontmatter.date;
            if (!postDate && filenameParsed) {
                postDate = filenameParsed.date;
                console.log(`  (using filename date: ${postDate})`);
            }
            if (!postDate) {
                postDate = getFileCreationDate(filePath);
                console.log(`  (using creation date: ${postDate})`);
            }
        } else {
            // PDF, Word, TXT - use filename for metadata
            // Date: filename > creation time
            if (filenameParsed) {
                postDate = filenameParsed.date;
                // Use the name part after date as title
                title = filenameParsed.name.replace(/-/g, ' ');
                console.log(`  (using filename date: ${postDate})`);
            } else {
                postDate = getFileCreationDate(filePath);
                title = basename.replace(/-/g, ' ');
                console.log(`  (using creation date: ${postDate})`);
            }
        }

        // Generate slug from path
        const relativePath = path.relative(__dirname, filePath);
        const slug = relativePath.replace(/\.(md|ipynb|pdf|docx|txt|xlsx|pptx|csv)$/, '');

        const post = {
            slug,
            title,
            date: postDate,
            type: fileType
        };

        // Optional fields from frontmatter
        if (frontmatter.tags) {
            post.tags = frontmatter.tags;
        }
        if (frontmatter.description) {
            post.description = frontmatter.description;
        }

        posts.push(post);
        const typeLabel = fileType !== 'markdown' ? ` (${fileType})` : '';
        console.log(`✓ ${slug}${typeLabel}`);
    }

    // Sort by date descending
    posts.sort((a, b) => b.date.localeCompare(a.date));

    // Write posts.json
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(posts, null, 2) + '\n');
    console.log(`\nGenerated: posts.json (${posts.length} posts)`);
}

main();
