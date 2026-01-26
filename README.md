# yuxu.ge

Personal website for Yuxu Ge.

## Development

```bash
python3 -m http.server 8080
```

## Build Blog

```bash
./build.sh           # Build both static + medium
./build.sh --static  # Static only
./build.sh --medium  # Medium only

./clear.sh           # Clean all generated files
```

With GitHub Gists:

```bash
GITHUB_TOKEN_CRTATE_GIST=xxx ./build.sh
```

Output:
- `blog/static/` - Static HTML for crawlers
- `blog/medium/` - Medium-friendly HTML (Gist links, table images)

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
