#!/usr/bin/env node
/**
 * Convert HTML tables to PNG images
 * Uses Puppeteer to render tables as images
 * Run: node table-to-image.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUTPUT_DIR = path.join(__dirname, 'images', 'tables');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Convert HTML table to PNG image
 * @param {string} tableHtml - The HTML table string
 * @param {string} filename - Output filename (without extension)
 * @returns {Promise<string>} - Path to the generated image
 */
async function tableToImage(tableHtml, filename) {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    // Set viewport for crisp rendering
    await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 2 });

    // Create styled HTML page with the table
    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: white;
            padding: 16px;
        }
        table {
            border-collapse: collapse;
            font-size: 14px;
            width: 100%;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 10px 14px;
            text-align: left;
        }
        th {
            background: #f5f5f5;
            font-weight: 600;
            color: #333;
        }
        td {
            color: #444;
        }
        tr:nth-child(even) td {
            background: #fafafa;
        }
        strong { font-weight: 600; }
        code {
            font-family: "SF Mono", Monaco, monospace;
            font-size: 0.9em;
            background: #f0f0f0;
            padding: 2px 6px;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    ${tableHtml}
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Get the table element and take screenshot
    const table = await page.$('table');
    if (!table) {
        await browser.close();
        throw new Error('No table found in HTML');
    }

    const outputPath = path.join(OUTPUT_DIR, `${filename}.png`);
    await table.screenshot({ path: outputPath, omitBackground: false });

    await browser.close();

    return outputPath;
}

/**
 * Generate hash for table content (for caching)
 */
function hashTable(html) {
    return crypto.createHash('md5').update(html).digest('hex').slice(0, 8);
}

module.exports = { tableToImage, hashTable, OUTPUT_DIR };

// CLI usage
if (require.main === module) {
    const testTable = `
    <table>
        <tr><th>Layer</th><th>Problem</th><th>Solution</th></tr>
        <tr><td><strong>Data</strong></td><td>Coordinate system mismatch</td><td>CRS transformation + iterative inversion</td></tr>
        <tr><td><strong>Network</strong></td><td>Connection overhead, transient failures</td><td>Persistent pool + exponential backoff</td></tr>
        <tr><td><strong>System</strong></td><td>Quota exhaustion</td><td>Token bucket rate limiting</td></tr>
    </table>`;

    console.log('Testing table-to-image conversion...');
    tableToImage(testTable, 'test-table')
        .then(p => console.log(`✓ Image saved: ${p}`))
        .catch(e => console.error(`✗ Error: ${e.message}`));
}
