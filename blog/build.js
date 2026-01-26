#!/usr/bin/env node
/**
 * Unified build script
 * Usage:
 *   node build.js           # Build both static and medium
 *   node build.js --static  # Build static only
 *   node build.js --medium  # Build medium only
 */

const { execSync } = require('child_process');

const args = process.argv.slice(2);
const buildStatic = args.length === 0 || args.includes('--static');
const buildMedium = args.length === 0 || args.includes('--medium');

const blogDir = __dirname;

if (buildStatic) {
    console.log('═══════════════════════════════════════');
    console.log('📄 Building static version (for crawlers)');
    console.log('═══════════════════════════════════════\n');
    try {
        execSync('node build-static.js', { cwd: blogDir, stdio: 'inherit' });
    } catch (err) {
        console.error('Static build failed');
        process.exit(1);
    }
}

if (buildMedium) {
    if (buildStatic) console.log('\n');
    console.log('═══════════════════════════════════════');
    console.log('📰 Building medium version (for Medium)');
    console.log('═══════════════════════════════════════\n');
    try {
        execSync('node build-medium.js', { cwd: blogDir, stdio: 'inherit', env: process.env });
    } catch (err) {
        console.error('Medium build failed');
        process.exit(1);
    }
}

console.log('\n═══════════════════════════════════════');
console.log('✅ Build complete!');
if (buildStatic) console.log('   Static: blog/static/');
if (buildMedium) console.log('   Medium: blog/medium/');
console.log('═══════════════════════════════════════');
