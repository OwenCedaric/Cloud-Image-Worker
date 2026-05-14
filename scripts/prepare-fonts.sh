#!/bin/bash
mkdir -p public/fonts
cp src/assets/style.css public/style.css

# Copy font files
cp node_modules/@fontsource/noto-sans-sc/files/* public/fonts/
cp node_modules/@fontsource/noto-serif-sc/files/* public/fonts/

# Generate combined CSS with local paths
# We use a temporary file to collect the CSS
TEMP_CSS=$(mktemp)

cat node_modules/@fontsource/noto-sans-sc/index.css >> "$TEMP_CSS"
cat node_modules/@fontsource/noto-serif-sc/index.css >> "$TEMP_CSS"

# Replace relative paths with absolute ones for the worker
# In Fontsource, paths are ./files/name.woff2
# We want them to be /fonts/name.woff2
sed 's|\./files/|/fonts/|g' "$TEMP_CSS" > public/fonts.css

rm "$TEMP_CSS"

echo "Fonts prepared in public/fonts and public/fonts.css"
