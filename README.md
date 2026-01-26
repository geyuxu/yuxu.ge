python3 -m http.server 8080



常用的 SVG 转 PNG 命令：

ImageMagick (convert/magick)


magick input.svg output.png
# 或指定尺寸
magick -density 300 input.svg -resize 512x512 output.png
Inkscape


inkscape input.svg -o output.png
# 指定宽度
inkscape input.svg -o output.png -w 512
rsvg-convert (librsvg)


rsvg-convert input.svg -o output.png
# 指定尺寸
rsvg-convert -w 512 -h 512 input.svg -o output.png
安装方式 (macOS)


brew install imagemagick
brew install inkscape
brew install librsvg