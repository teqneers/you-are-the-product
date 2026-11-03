#!/bin/sh
# (Re)creates the Safari app project in safari/ from the Safari build, e.g.
#   scripts/create-safari-project.sh de.example.YouAreTheProduct
# The project references .output/safari-mv3, so later builds only need `npm run build:safari`.
set -eu
BUNDLE_ID="${1:-de.teqneers.YouAreTheProduct}"
NAME="You Are The Product"
npm run build:safari
rm -rf safari
xcrun safari-web-extension-packager .output/safari-mv3 --project-location safari --app-name "$NAME" \
  --bundle-identifier "$BUNDLE_ID" --swift --macos-only --no-open --no-prompt --force
PROJECT="safari/$NAME/$NAME.xcodeproj/project.pbxproj"
# The packager derives the app id from the app name ("com.example.You-Are-The-Product") but the
# extension id from --bundle-identifier; Xcode requires the extension id to start with the app id.
APP_ID=$(sed -n 's/.*PRODUCT_BUNDLE_IDENTIFIER = "\{0,1\}\([^";]*\)"\{0,1\};/\1/p' "$PROJECT" | grep -v '\.Extension$' | head -1)
sed -i '' "s/\"$APP_ID\"/$BUNDLE_ID/g; s/= $APP_ID;/= $BUNDLE_ID;/g" "$PROJECT"
# The packager sets the project to the newest macOS; the targets use 12.0, Safari 18.4 runs there too.
sed -i '' 's/MACOSX_DEPLOYMENT_TARGET = [0-9.]*;/MACOSX_DEPLOYMENT_TARGET = 12.0;/g' "$PROJECT"
grep 'PRODUCT_BUNDLE_IDENTIFIER' "$PROJECT" | sort -u
