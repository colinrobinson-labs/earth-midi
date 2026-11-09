#!/bin/sh
# Xcode build phase: bundle the site's engine (index.html + js/ + icons) into the app as Web/.
# The app always ships the same sound engine as earthmidi.com at the commit it was built from.
set -e
REPO="${SRCROOT}/../.."
DEST="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/Web"
rm -rf "$DEST"
mkdir -p "$DEST/js"
cp "$REPO"/js/*.js "$DEST/js/"
# self-hosted fonts, styles and libraries, so the app needs no CDN or Google Fonts
for d in css fonts vendor; do if [ -d "$REPO/$d" ]; then cp -R "$REPO/$d" "$DEST/"; fi; done
for f in icon.svg apple-touch-icon.png og.png; do [ -f "$REPO/$f" ] && cp "$REPO/$f" "$DEST/"; done
# no visit counter inside the app
grep -v 'goatcounter' "$REPO/index.html" > "$DEST/index.html"
echo "Bundled site engine: $(ls "$DEST/js" | wc -l | tr -d ' ') scripts"
