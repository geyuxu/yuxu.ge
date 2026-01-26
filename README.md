# yuxu.ge

Personal website for Yuxu Ge.

## Structure

```
├── index.html              # Home page
├── blog/                   # Blog system
│   ├── index.html          # Blog list
│   ├── post.html           # Dynamic post viewer
│   ├── posts.json          # Post metadata (generated)
│   ├── posts/              # Markdown posts
│   ├── static/             # Static HTML (generated)
│   └── medium/             # Medium-friendly HTML (generated)
├── gallery/                # Photo gallery
│   ├── index.html          # Gallery with timeline
│   └── photos.json         # Album metadata (generated)
├── photos/                 # Photo albums
│   └── YYYY/YYYYMMDD-Location/
│       ├── *.JPG
│       └── description.md  # Album description (optional)
├── components/             # Shared components
│   └── sidebar.js          # Sidebar (injected via JS)
└── scripts/                # Build scripts
    ├── convert-heic.sh     # HEIC to JPG conversion
    └── compress-photos.sh  # Image compression
```

## Development

```bash
python3 -m http.server 8080
```

## Build

```bash
./build.sh           # Build all (convert + compress + posts.json + photos.json + static/medium)
./build.sh --static  # Static HTML only
./build.sh --medium  # Medium HTML only
./build.sh --photos  # Process photos only (convert HEIC + compress)

./clear.sh           # Clean generated files
```

With GitHub Gists for code blocks:

```bash
GITHUB_TOKEN_CRTATE_GIST=xxx ./build.sh
```

## Gallery

Photo albums are organized by date:

```
photos/2026/20260120-Leeds/
├── A7C00267.JPG
├── A7C00274.JPG
└── description.md    # Optional album description
```

Run `./build.sh` to regenerate `gallery/photos.json`.

### Convert HEIC/HIF/ARW to JPG

```bash
./scripts/convert-heic.sh           # Convert all HEIC/HIF/ARW to JPG
./scripts/convert-heic.sh --dry-run # Preview only
```

Uses macOS `sips` (built-in) or ImageMagick. ARW (Sony RAW) requires ImageMagick.

### Compress Photos

```bash
./scripts/compress-photos.sh           # Compress new photos (uses cache)
./scripts/compress-photos.sh --dry-run # Preview only
./scripts/compress-photos.sh --force   # Ignore cache, reprocess all
```


Uses cache file (`.compress-cache`) to skip already processed images. Requires ImageMagick: `brew install imagemagick`

## Blog Posts

Create posts in `blog/posts/YYYY/` with YAML frontmatter:

```markdown
---
date: 2026-01-26
tags: [python, backend]
description: Optional description
---
# Post Title

Content...
```

Run `./build.sh` to regenerate `blog/posts.json`.

## SVG to PNG

```bash
# ImageMagick
magick input.svg output.png
magick -density 300 input.svg -resize 512x512 output.png

# Inkscape
inkscape input.svg -o output.png -w 512

# librsvg
rsvg-convert -w 512 -h 512 input.svg -o output.png
```

Install: `brew install imagemagick inkscape librsvg`
