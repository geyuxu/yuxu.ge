#!/usr/bin/env node
/**
 * Convert Office documents to PDF for preview
 *
 * Supported formats:
 *   - PPTX (PowerPoint)
 *   - RTF (Rich Text Format)
 *   - ODT (OpenDocument Text)
 *   - ODS (OpenDocument Spreadsheet)
 *   - ODP (OpenDocument Presentation)
 *
 * Requires LibreOffice installed:
 *   macOS: brew install --cask libreoffice
 *   Linux: sudo apt install libreoffice
 *
 * Run: node build-office-pdf.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const POSTS_DIR = path.join(__dirname, 'posts');

// Supported extensions for LibreOffice conversion
const SUPPORTED_EXTENSIONS = ['.pptx', '.rtf', '.odt', '.ods', '.odp'];

// Human-readable format names
const FORMAT_NAMES = {
    '.pptx': 'PowerPoint',
    '.rtf': 'RTF',
    '.odt': 'OpenDocument Text',
    '.ods': 'OpenDocument Spreadsheet',
    '.odp': 'OpenDocument Presentation'
};

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

// Recursively find all supported files
function findOfficeFiles(dir, files = []) {
    if (!fs.existsSync(dir)) return files;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            findOfficeFiles(fullPath, files);
        } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (SUPPORTED_EXTENSIONS.includes(ext)) {
                files.push(fullPath);
            }
        }
    }

    return files;
}

// Main
function main() {
    console.log('=== Office to PDF Converter ===\n');
    console.log('Supported: PPTX, RTF, ODT, ODS, ODP\n');

    // Find LibreOffice
    const soffice = findLibreOffice();
    if (!soffice) {
        console.log('⚠ LibreOffice not found - skipping Office conversion');
        console.log('  Install to enable Office to PDF conversion:');
        console.log('    macOS:  brew install --cask libreoffice');
        console.log('    Linux:  sudo apt install libreoffice');
        return; // Gracefully skip
    }
    console.log(`Found LibreOffice: ${soffice}\n`);

    // Find office files
    const officeFiles = findOfficeFiles(POSTS_DIR);

    if (officeFiles.length === 0) {
        console.log('No office files to convert.');
        return;
    }

    // Group by extension for logging
    const byExt = {};
    for (const f of officeFiles) {
        const ext = path.extname(f).toLowerCase();
        byExt[ext] = (byExt[ext] || 0) + 1;
    }
    console.log('Found files:');
    for (const [ext, count] of Object.entries(byExt)) {
        console.log(`  ${FORMAT_NAMES[ext]}: ${count}`);
    }
    console.log('');

    let converted = 0;
    let skipped = 0;
    let failed = 0;

    for (const filePath of officeFiles) {
        const ext = path.extname(filePath).toLowerCase();
        const pdfPath = filePath.replace(new RegExp(`\\${ext}$`, 'i'), '.pdf');
        const filename = path.basename(filePath);

        // Skip if PDF already exists and is newer than source
        if (fs.existsSync(pdfPath)) {
            const srcStat = fs.statSync(filePath);
            const pdfStat = fs.statSync(pdfPath);

            if (pdfStat.mtime >= srcStat.mtime) {
                console.log(`⏭ Skip: ${filename} (PDF up to date)`);
                skipped++;
                continue;
            }
        }

        // Convert to PDF
        const outDir = path.dirname(filePath);
        console.log(`📄 Converting: ${filename}...`);

        try {
            execSync(`"${soffice}" --headless --convert-to pdf --outdir "${outDir}" "${filePath}"`, {
                stdio: 'pipe',
                timeout: 120000  // 2 minute timeout
            });
            console.log(`✓ Converted: ${filename} → ${path.basename(pdfPath)}`);
            converted++;
        } catch (err) {
            console.log(`✗ Error converting ${filename}: ${err.message}`);
            failed++;
        }
    }

    console.log(`\nDone! Converted: ${converted}, Skipped: ${skipped}, Failed: ${failed}`);
}

main();
