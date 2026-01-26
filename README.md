# yuxu.ge

Personal website for Yuxu Ge.

## Development

```bash
python3 -m http.server 8080
```

## Build Static Blog

Generate static HTML for crawlers/Medium:

```bash
cd blog && node build.js
```

Output: `blog/static/{slug}.html`

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
