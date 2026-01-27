#!/usr/bin/env node
/**
 * Convert PPTX files to PDF for preview
 * Requires LibreOffice installed:
 *   macOS: brew install --cask libreoffice
 *   Linux: sudo apt install libreoffice
 *
 * Run: node build-pptx-pdf.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const POSTS_DIR = path.join(__dirname, 'posts');

// Find LibreOffice executable
function findLibreOffice() {
    const paths = [
        '/Applications/LibreOffice.app/Contents/MacOS/soffice',  // macOS
        '/usr/bin/soffice',                                       // Linux
        '/usr/bin/libreoffice',                                   // Linux alt
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',  // Windows
    ];

    for (const p of paths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }

    // Try to find in PATH
    try {
        const result = execSync('which soffice 2>/dev/null || which libreoffice 2>/dev/null', { encoding: 'utf-8' });
        return result.trim();
    } catch (e) {
        return null;
    }
}

// Recursively find all PPTX files
function findPptxFiles(dir, files = []) {
    if (!fs.existsSync(dir)) return files;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            findPptxFiles(fullPath, files);
        } else if (entry.name.endsWith('.pptx')) {
            files.push(fullPath);
        }
    }

    return files;
}

// Main
function main() {
    console.log('=== PPTX to PDF Converter ===\n');

    // Find LibreOffice
    const soffice = findLibreOffice();
    if (!soffice) {
        console.log('⚠ LibreOffice not found - skipping PPTX conversion');
        console.log('  Install to enable PPTX to PDF conversion:');
        console.log('    macOS:  brew install --cask libreoffice');
        console.log('    Linux:  sudo apt install libreoffice');
        return; // Gracefully skip instead of exit(1)
    }
    console.log(`Found LibreOffice: ${soffice}\n`);

    // Find PPTX files
    const pptxFiles = findPptxFiles(POSTS_DIR);
    console.log(`Found ${pptxFiles.length} PPTX file(s)\n`);

    if (pptxFiles.length === 0) {
        console.log('No PPTX files to convert.');
        return;
    }

    let converted = 0;
    let skipped = 0;

    for (const pptxPath of pptxFiles) {
        const pdfPath = pptxPath.replace(/\.pptx$/, '.pdf');
        const filename = path.basename(pptxPath);

        // Skip if PDF already exists and is newer than PPTX
        if (fs.existsSync(pdfPath)) {
            const pptxStat = fs.statSync(pptxPath);
            const pdfStat = fs.statSync(pdfPath);

            if (pdfStat.mtime >= pptxStat.mtime) {
                console.log(`⏭ Skip: ${filename} (PDF up to date)`);
                skipped++;
                continue;
            }
        }

        // Convert PPTX to PDF
        const outDir = path.dirname(pptxPath);
        console.log(`Converting: ${filename}...`);

        try {
            execSync(`"${soffice}" --headless --convert-to pdf --outdir "${outDir}" "${pptxPath}"`, {
                stdio: 'pipe',
                timeout: 60000  // 1 minute timeout
            });
            console.log(`✓ Converted: ${filename} → ${path.basename(pdfPath)}`);
            converted++;
        } catch (err) {
            console.log(`✗ Error converting ${filename}: ${err.message}`);
        }
    }

    console.log(`\nDone! Converted: ${converted}, Skipped: ${skipped}`);
}

main();
