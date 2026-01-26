# yuxu.ge

Personal website for Yuxu Ge.

## Development

```bash
python3 -m http.server 8080
```

## Build Static Blog

Generate static HTML for crawlers:

```bash
cd blog && node build.js
```

Output: `blog/static/{slug}.html`

## Build for Medium

Generate Medium-friendly HTML (auto Gist for long code, tables as PNG):

```bash
cd blog && node build-medium.js                              # Basic build
cd blog && GITHUB_TOKEN_CRTATE_GIST=xxx node build-medium.js # With Gists
```

Output: `blog/medium/{slug}.html`

Features:
- Long code blocks (>15 lines) → GitHub Gist links
- Tables → PNG images (saved to `blog/images/tables/`)
- Caches: `.gist-cache.json`, `.table-cache.json`

## SVG to PNG

```bash
# ImageMagick
magick input.svg output.png
magick -density 300 input.svg -resize 512x512 output.png

# Inkscape
inkscape input.svg -o output.png
inkscape input.svg -o output.png -w 512

# librsvg
rsvg-convert input.svg -o output.png
rsvg-convert -w 512 -h 512 input.svg -o output.png
```

Install (macOS):

```bash
brew install imagemagick inkscape librsvg
```
