#!/usr/bin/env node
/**
 * Generate photos.json from folder structure
 *
 * Expected structure:
 *   photos/YYYY/YYYYMMDD-Location/image.jpg
 *
 * Example:
 *   photos/2026/20260120-Leeds/A7C00281.JPG
 *   -> { year: 2026, date: "2026-01-20", location: "Leeds", images: [...] }
 *
 * Run: node build-photos-json.js
 */

const fs = require('fs');
const path = require('path');

const PHOTOS_DIR = path.join(__dirname, '..', 'photos');
const OUTPUT_FILE = path.join(__dirname, 'photos.json');

// Read description from folder (description.md or description.txt)
function readDescription(folderPath) {
    const mdPath = path.join(folderPath, 'description.md');
    const txtPath = path.join(folderPath, 'description.txt');

    if (fs.existsSync(mdPath)) {
        return fs.readFileSync(mdPath, 'utf-8').trim();
    }
    if (fs.existsSync(txtPath)) {
        return fs.readFileSync(txtPath, 'utf-8').trim();
    }
    return "";
}

// Supported image extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// Parse folder name: "20260120-Leeds" -> { date: "2026-01-20", location: "Leeds" }
function parseFolderName(folderName) {
    const match = folderName.match(/^(\d{4})(\d{2})(\d{2})-(.+)$/);
    if (!match) return null;

    const [, year, month, day, location] = match;
    return {
        date: `${year}-${month}-${day}`,
        location: location
            .replace(/_/g, ' ')           // Convert underscores to spaces
            .replace(/ Part \d+$/i, '')   // Remove "Part N" suffix
    };
}

// Check if file is an image
function isImage(filename) {
    const ext = path.extname(filename).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
}

// Main
function main() {
    if (!fs.existsSync(PHOTOS_DIR)) {
        console.log('No photos directory found');
        fs.writeFileSync(OUTPUT_FILE, '[]\n');
        return;
    }

    const photos = [];

    // Scan year directories
    const years = fs.readdirSync(PHOTOS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory() && /^\d{4}$/.test(d.name))
        .map(d => d.name)
        .sort()
        .reverse();  // Newest first

    for (const year of years) {
        const yearPath = path.join(PHOTOS_DIR, year);

        // Scan event directories
        const events = fs.readdirSync(yearPath, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name)
            .sort()
            .reverse();  // Newest first

        for (const event of events) {
            const eventPath = path.join(yearPath, event);
            const parsed = parseFolderName(event);

            if (!parsed) {
                console.log(`⚠ Skip: ${year}/${event} (invalid folder name format)`);
                continue;
            }

            // Find images
            const images = fs.readdirSync(eventPath)
                .filter(isImage)
                .sort()
                .map(img => `/photos/${year}/${event}/${img}`);

            if (images.length === 0) {
                console.log(`⚠ Skip: ${year}/${event} (no images found)`);
                continue;
            }

            photos.push({
                year: parseInt(year),
                date: parsed.date,
                location: parsed.location,
                images: images,
                description: readDescription(eventPath)
            });

            console.log(`✓ ${year}/${event} (${images.length} images)`);
        }
    }

    // Write photos.json
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(photos, null, 2) + '\n');
    console.log(`\nGenerated: photos.json (${photos.length} albums, ${photos.reduce((sum, p) => sum + p.images.length, 0)} images)`);
}

main();
