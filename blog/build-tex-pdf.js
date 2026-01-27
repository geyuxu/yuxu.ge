#!/usr/bin/env node
/**
 * Convert LaTeX (.tex) files to PDF for browser preview
 *
 * Requires pdflatex (part of TeX distribution):
 *   macOS:  brew install --cask mactex-no-gui
 *   Linux:  sudo apt install texlive-latex-base texlive-latex-extra
 *
 * Run: node build-tex-pdf.js
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const POSTS_DIR = path.join(__dirname, 'posts');

// Find pdflatex executable
function findPdflatex() {
    const commands = ['pdflatex', '/Library/TeX/texbin/pdflatex'];

    for (const cmd of commands) {
        try {
            execSync(`which ${cmd}`, { stdio: 'ignore' });
            return cmd;
        } catch {
            // Try direct path check for macOS
            if (cmd.startsWith('/') && fs.existsSync(cmd)) {
                return cmd;
            }
        }
    }
    return null;
}

// Recursively find all .tex files
function findTexFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            findTexFiles(fullPath, files);
        } else if (entry.name.endsWith('.tex')) {
            files.push(fullPath);
        }
    }

    return files;
}

// Convert a single .tex file to PDF
function convertToPdf(texPath, pdflatex) {
    const dir = path.dirname(texPath);
    const basename = path.basename(texPath, '.tex');
    const pdfPath = path.join(dir, `${basename}.pdf`);

    // Skip if PDF already exists and is newer than TEX
    if (fs.existsSync(pdfPath)) {
        const texStat = fs.statSync(texPath);
        const pdfStat = fs.statSync(pdfPath);
        if (pdfStat.mtime > texStat.mtime) {
            console.log(`  ⏭ Skip (up to date): ${basename}.tex`);
            return true;
        }
    }

    console.log(`  📄 Converting: ${basename}.tex`);

    // Run pdflatex twice for references (common practice)
    // Use -interaction=nonstopmode to avoid prompts
    // Use -output-directory to keep aux files in same dir
    const args = [
        '-interaction=nonstopmode',
        '-halt-on-error',
        `-output-directory=${dir}`,
        texPath
    ];

    try {
        // First pass
        const result1 = spawnSync(pdflatex, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 60000 // 60 second timeout
        });

        if (result1.status !== 0) {
            const stderr = result1.stderr?.toString() || '';
            const stdout = result1.stdout?.toString() || '';
            console.log(`  ⚠ Warning: ${basename}.tex may have errors`);
            // Check if PDF was still generated
            if (!fs.existsSync(pdfPath)) {
                console.log(`    ${stderr || stdout.slice(-500)}`);
                return false;
            }
        }

        // Second pass for references
        spawnSync(pdflatex, args, {
            stdio: 'ignore',
            timeout: 60000
        });

        // Clean up auxiliary files
        const auxExtensions = ['.aux', '.log', '.out', '.toc', '.lof', '.lot'];
        for (const ext of auxExtensions) {
            const auxFile = path.join(dir, `${basename}${ext}`);
            if (fs.existsSync(auxFile)) {
                fs.unlinkSync(auxFile);
            }
        }

        if (fs.existsSync(pdfPath)) {
            console.log(`  ✓ Created: ${basename}.pdf`);
            return true;
        } else {
            console.log(`  ✗ Failed: ${basename}.pdf not created`);
            return false;
        }
    } catch (err) {
        console.log(`  ✗ Error: ${err.message}`);
        return false;
    }
}

// Main
function main() {
    console.log('LaTeX to PDF Conversion\n');

    const pdflatex = findPdflatex();

    if (!pdflatex) {
        console.log('⚠ pdflatex not found - skipping LaTeX conversion');
        console.log('  Install to enable LaTeX to PDF conversion:');
        console.log('    macOS:  brew install --cask mactex-no-gui');
        console.log('    Linux:  sudo apt install texlive-latex-base texlive-latex-extra');
        return;
    }

    console.log(`Using: ${pdflatex}\n`);

    if (!fs.existsSync(POSTS_DIR)) {
        console.log('No posts directory found');
        return;
    }

    const texFiles = findTexFiles(POSTS_DIR);

    if (texFiles.length === 0) {
        console.log('No .tex files found');
        return;
    }

    console.log(`Found ${texFiles.length} LaTeX file(s):\n`);

    let converted = 0;
    let skipped = 0;
    let failed = 0;

    for (const texFile of texFiles) {
        const result = convertToPdf(texFile, pdflatex);
        if (result) {
            converted++;
        } else {
            failed++;
        }
    }

    console.log(`\nDone: ${converted} converted, ${failed} failed`);
}

main();
