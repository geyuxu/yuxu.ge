#!/usr/bin/env node
/**
 * Vector Search Index Builder
 *
 * Builds a Voy search index from Markdown blog posts.
 * Uses OpenAI text-embedding-3-small (512 dimensions) for embeddings.
 *
 * Usage: OPENAI_API_KEY=sk-xxx node scripts/index-builder.mjs
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Voy } from 'voy-search/voy_search.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
    postsDir: path.join(__dirname, '..', 'blog', 'posts'),
    outputFile: path.join(__dirname, '..', 'public', 'search.dat'),
    metadataFile: path.join(__dirname, '..', 'public', 'search-metadata.json'),
    invertedIndexFile: path.join(__dirname, '..', 'public', 'search-inverted.json'),
    embeddingCacheFile: path.join(__dirname, '..', '.cache', 'embeddings.json'),
    chunkSize: 500,        // Characters per chunk
    chunkOverlap: 50,      // Overlap between chunks
    dimensions: 512,       // Embedding dimensions (saves ~50% space vs 1536)
    model: 'text-embedding-3-small',
    batchSize: 20,         // Embeddings per API call
};

// ============================================================
// CACHING UTILITIES
// ============================================================

/**
 * Compute MD5 hash for content
 */
function contentHash(text) {
    return crypto.createHash('md5').update(text).digest('hex');
}

/**
 * Load embedding cache
 * Format: { [chunkId]: { hash, embedding } }
 */
function loadEmbeddingCache() {
    try {
        if (fs.existsSync(CONFIG.embeddingCacheFile)) {
            return JSON.parse(fs.readFileSync(CONFIG.embeddingCacheFile, 'utf-8'));
        }
    } catch (err) {
        console.warn('  Warning: Could not load embedding cache:', err.message);
    }
    return {};
}

/**
 * Save embedding cache
 */
function saveEmbeddingCache(cache) {
    const cacheDir = path.dirname(CONFIG.embeddingCacheFile);
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG.embeddingCacheFile, JSON.stringify(cache));
}

// ============================================================
// INVERTED INDEX UTILITIES
// ============================================================

// Stopwords for Chinese and English
const STOPWORDS = new Set([
    // English
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
    'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'same',
    'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there',
    // Chinese
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
    '个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有',
    '看', '好', '自己', '这', '那', '她', '他', '它', '们', '么', '与', '及',
]);

/**
 * Tokenize text into terms (supports Chinese and English)
 * @param {string} text - Text to tokenize
 * @returns {string[]} Array of tokens
 */
function tokenize(text) {
    if (!text) return [];

    // Normalize: lowercase, remove extra spaces
    let normalized = text.toLowerCase().trim();

    // Split by whitespace and punctuation, keeping Chinese characters together
    // This regex matches: Chinese char sequences, alphanumeric sequences
    const tokens = normalized.match(/[\u4e00-\u9fff]+|[a-z0-9]+/g) || [];

    // For Chinese text, split into individual characters and bigrams
    const result = [];
    for (const token of tokens) {
        if (/[\u4e00-\u9fff]/.test(token)) {
            // Chinese: add individual chars and bigrams
            for (let i = 0; i < token.length; i++) {
                result.push(token[i]);
                if (i < token.length - 1) {
                    result.push(token.slice(i, i + 2)); // bigram
                }
            }
        } else if (token.length >= 2) {
            // English: only add tokens with 2+ chars
            result.push(token);
        }
    }

    // Filter stopwords and short tokens
    return result.filter(t => t.length >= 2 && !STOPWORDS.has(t));
}

/**
 * Build inverted index from documents
 * @param {Array} documents - Array of {id, title, url, date, text}
 * @returns {Object} Inverted index structure
 */
function buildInvertedIndex(documents) {
    const index = {};       // term -> [{docId, tf}, ...]
    const docLengths = {};  // docId -> number of tokens
    let totalLength = 0;

    // Group chunks by URL (article level)
    const articleMap = new Map();
    for (const doc of documents) {
        if (!articleMap.has(doc.url)) {
            articleMap.set(doc.url, {
                id: doc.url,
                title: doc.title,
                url: doc.url,
                date: doc.date,
                tags: doc.tags || '',
                chunks: [],
            });
        }
        articleMap.get(doc.url).chunks.push(doc.text);
    }

    // Process each article
    for (const [url, article] of articleMap) {
        // Combine all chunks + title + tags for indexing
        const fullText = article.title + ' ' + article.tags + ' ' + article.chunks.join(' ');
        const tokens = tokenize(fullText);

        // Count term frequencies
        const termFreq = {};
        for (const token of tokens) {
            termFreq[token] = (termFreq[token] || 0) + 1;
        }

        // Update inverted index
        for (const [term, freq] of Object.entries(termFreq)) {
            if (!index[term]) {
                index[term] = [];
            }
            index[term].push({
                id: url,
                tf: freq,
            });
        }

        docLengths[url] = tokens.length;
        totalLength += tokens.length;
    }

    const avgDocLength = totalLength / articleMap.size;

    return {
        index,
        docLengths,
        avgDocLength,
        docCount: articleMap.size,
    };
}

// Extract frontmatter and content from Markdown
function parseMarkdown(content, filePath) {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch) {
        return null;
    }

    const frontmatter = frontmatterMatch[1];
    const body = frontmatterMatch[2];

    // Parse YAML frontmatter (simple parser)
    const meta = {};
    frontmatter.split('\n').forEach(line => {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
            let value = match[2].trim();
            // Handle arrays like [tag1, tag2]
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1).split(',').map(s => s.trim());
            }
            meta[match[1]] = value;
        }
    });

    // Extract title from first H1
    const titleMatch = body.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : path.basename(filePath, '.md');

    // Generate URL from file path: blog/posts/2026/foo.md -> /blog/posts/2026/foo
    const relativePath = path.relative(path.join(__dirname, '..'), filePath);
    const url = '/' + relativePath.replace(/\.md$/, '');

    // Clean content: remove code blocks, images, links
    const cleanContent = body
        .replace(/```[\s\S]*?```/g, '')           // Remove code blocks
        .replace(/!\[.*?\]\(.*?\)/g, '')          // Remove images
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Keep link text
        .replace(/^#+\s+/gm, '')                  // Remove heading markers
        .replace(/\|.*\|/g, '')                   // Remove table rows
        .replace(/[-*_]{3,}/g, '')                // Remove horizontal rules
        .replace(/\n{3,}/g, '\n\n')               // Normalize newlines
        .trim();

    return {
        title,
        url,
        date: meta.date || '',
        tags: meta.tags || [],
        description: meta.description || '',
        content: cleanContent,
    };
}

// Split content into overlapping chunks
function chunkText(text, chunkSize, overlap) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        let chunk = text.slice(start, end);

        // Try to break at sentence boundary
        if (end < text.length) {
            const lastPeriod = chunk.lastIndexOf('.');
            const lastNewline = chunk.lastIndexOf('\n');
            const breakPoint = Math.max(lastPeriod, lastNewline);
            if (breakPoint > chunkSize * 0.5) {
                chunk = chunk.slice(0, breakPoint + 1);
            }
        }

        chunks.push(chunk.trim());
        start += chunk.length - overlap;

        if (start >= text.length - overlap) break;
    }

    return chunks.filter(c => c.length > 50); // Filter tiny chunks
}

// Call OpenAI Embeddings API
async function getEmbeddings(texts) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: CONFIG.model,
            input: texts,
            dimensions: CONFIG.dimensions,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.data.map(item => item.embedding);
}

// Process embeddings in batches
async function batchGetEmbeddings(texts) {
    const results = [];

    for (let i = 0; i < texts.length; i += CONFIG.batchSize) {
        const batch = texts.slice(i, i + CONFIG.batchSize);
        console.log(`  Embedding batch ${Math.floor(i / CONFIG.batchSize) + 1}/${Math.ceil(texts.length / CONFIG.batchSize)}...`);

        const embeddings = await getEmbeddings(batch);
        results.push(...embeddings);

        // Rate limit: 3000 RPM = 50/sec, be conservative
        if (i + CONFIG.batchSize < texts.length) {
            await new Promise(r => setTimeout(r, 100));
        }
    }

    return results;
}

// Recursively find all Markdown files
function findMarkdownFiles(dir) {
    const files = [];

    if (!fs.existsSync(dir)) {
        return files;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findMarkdownFiles(fullPath));
        } else if (entry.name.endsWith('.md')) {
            files.push(fullPath);
        }
    }

    return files;
}

// Main build process
async function buildIndex() {
    console.log('=== Building Vector Search Index ===\n');

    // 1. Find all posts
    const mdFiles = findMarkdownFiles(CONFIG.postsDir);
    console.log(`Found ${mdFiles.length} Markdown files\n`);

    if (mdFiles.length === 0) {
        console.log('No posts found. Skipping index generation.');
        return;
    }

    // 2. Parse and chunk all posts
    const documents = [];

    for (const file of mdFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const parsed = parseMarkdown(content, file);

        if (!parsed) {
            console.log(`  Skip: ${path.basename(file)} (no frontmatter)`);
            continue;
        }

        // Create chunks with metadata
        const chunks = chunkText(parsed.content, CONFIG.chunkSize, CONFIG.chunkOverlap);
        const tagsText = Array.isArray(parsed.tags) ? parsed.tags.join(' ') : '';

        chunks.forEach((chunk, idx) => {
            documents.push({
                id: `${parsed.url}#${idx}`,
                title: parsed.title,
                url: parsed.url,
                date: parsed.date,
                tags: tagsText,  // Include tags for inverted index
                text: chunk,
                // Prepend title for better semantic matching
                embeddingText: `${parsed.title}. ${chunk}`,
            });
        });

        console.log(`  ✓ ${parsed.title} (${chunks.length} chunks)`);
    }

    console.log(`\nTotal: ${documents.length} chunks\n`);

    // 3. Get embeddings with caching
    console.log('Loading embedding cache...');
    const cache = loadEmbeddingCache();
    const embeddings = [];
    const toEmbed = [];       // { index, text, hash }
    let cacheHits = 0;

    // Check cache for each document
    for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const hash = contentHash(doc.embeddingText);

        if (cache[doc.id] && cache[doc.id].hash === hash) {
            // Cache hit
            embeddings[i] = cache[doc.id].embedding;
            cacheHits++;
        } else {
            // Need to embed
            toEmbed.push({ index: i, text: doc.embeddingText, hash, id: doc.id });
            embeddings[i] = null;
        }
    }

    console.log(`  Cache hits: ${cacheHits}/${documents.length}`);

    // Generate embeddings only for new/changed chunks
    if (toEmbed.length > 0) {
        console.log(`  Generating ${toEmbed.length} new embeddings...`);
        const newEmbeddings = await batchGetEmbeddings(toEmbed.map(t => t.text));

        // Update embeddings array and cache
        for (let i = 0; i < toEmbed.length; i++) {
            const { index, hash, id } = toEmbed[i];
            embeddings[index] = newEmbeddings[i];
            cache[id] = { hash, embedding: newEmbeddings[i] };
        }

        // Clean up stale cache entries
        const currentIds = new Set(documents.map(d => d.id));
        let removed = 0;
        for (const id of Object.keys(cache)) {
            if (!currentIds.has(id)) {
                delete cache[id];
                removed++;
            }
        }
        if (removed > 0) {
            console.log(`  Removed ${removed} stale cache entries`);
        }

        // Save updated cache
        saveEmbeddingCache(cache);
        console.log(`  Cache saved: ${Object.keys(cache).length} entries`);
    } else {
        console.log('  All embeddings from cache, no API calls needed');
    }

    // 4. Build Voy index
    console.log('\nBuilding Voy index...');

    const resource = {
        embeddings: documents.map((doc, i) => ({
            id: doc.id,
            title: doc.title,
            url: doc.url,
            date: doc.date,
            text: doc.text.slice(0, 200), // Store preview text
            embeddings: embeddings[i],
        })),
    };

    const index = new Voy(resource);
    const serialized = index.serialize();

    // 5. Write Voy index
    const outputDir = path.dirname(CONFIG.outputFile);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(CONFIG.outputFile, serialized);

    // 6. Write metadata JSON (for frontend rendering)
    const metadata = {};
    documents.forEach(doc => {
        metadata[doc.id] = {
            title: doc.title,
            url: doc.url,
            date: doc.date,
            text: doc.text.slice(0, 150),  // Preview text
        };
    });

    fs.writeFileSync(CONFIG.metadataFile, JSON.stringify(metadata, null, 2));

    // 7. Build and write inverted index for keyword search
    console.log('Building inverted index...');
    const invertedIndex = buildInvertedIndex(documents);

    // Compress the inverted index for smaller file size
    const invertedData = {
        v: 1,  // version
        avgDL: invertedIndex.avgDocLength,
        N: invertedIndex.docCount,
        dl: invertedIndex.docLengths,
        idx: invertedIndex.index,
    };

    fs.writeFileSync(CONFIG.invertedIndexFile, JSON.stringify(invertedData));

    const stats = fs.statSync(CONFIG.outputFile);
    const metaStats = fs.statSync(CONFIG.metadataFile);
    const invertedStats = fs.statSync(CONFIG.invertedIndexFile);
    console.log(`\n✓ Vector index saved: ${CONFIG.outputFile}`);
    console.log(`  Size: ${(stats.size / 1024).toFixed(1)} KB`);
    console.log(`✓ Metadata saved: ${CONFIG.metadataFile}`);
    console.log(`  Size: ${(metaStats.size / 1024).toFixed(1)} KB`);
    console.log(`✓ Inverted index saved: ${CONFIG.invertedIndexFile}`);
    console.log(`  Size: ${(invertedStats.size / 1024).toFixed(1)} KB`);
    console.log(`  Terms: ${Object.keys(invertedIndex.index).length}`);
    console.log(`  Documents: ${documents.length} chunks, ${invertedIndex.docCount} articles`);
    console.log(`  Dimensions: ${CONFIG.dimensions}`);
}

// Run
buildIndex().catch(err => {
    console.error('\nError:', err.message);
    process.exit(1);
});
