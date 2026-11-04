#!/bin/sh
# (Re)creates the Safari app project in safari/ from the Safari build, e.g.
#   scripts/create-safari-project.sh de.example.YouAreTheProduct TEAMID1234
# The project references .output/safari-mv3, so later builds only need `npm run build:safari`.
# Run it again when files or folders are added at the top level of the build (Xcode lists them one by one).
set -eu
BUNDLE_ID="${1:-de.teqneers.YouAreTheProduct}"
# Apple Developer team of TEQneers GmbH & Co. KG; pass another as second argument.
TEAM="${2:-34W9U2CC4C}"
NAME="You Are The Product"
APP="safari/$NAME/$NAME"
VERSION=$(node -p "require('./package.json').version")
npm run build:safari
# Keep the wrapper app's own page and window, the packager would replace them with its template.
KEEP=$(mktemp -d)
[ -d "$APP/Resources" ] && cp -R "$APP/Resources" "$APP/Base.lproj" "$KEEP/"
rm -rf safari
xcrun safari-web-extension-packager .output/safari-mv3 --project-location safari --app-name "$NAME" \
  --bundle-identifier "$BUNDLE_ID" --swift --macos-only --no-open --no-prompt --force
if [ -d "$KEEP/Resources" ]; then
  rm -rf "$APP/Resources" "$APP/Base.lproj"
  cp -R "$KEEP/Resources" "$KEEP/Base.lproj" "$APP/"
fi
rm -rf "$KEEP"
PROJECT="safari/$NAME/$NAME.xcodeproj/project.pbxproj"
# The packager derives the app id from the app name ("com.example.You-Are-The-Product") but the
# extension id from --bundle-identifier; Xcode requires the extension id to start with the app id.
APP_ID=$(sed -n 's/.*PRODUCT_BUNDLE_IDENTIFIER = "\{0,1\}\([^";]*\)"\{0,1\};/\1/p' "$PROJECT" | grep -v '\.Extension$' | head -1)
sed -i '' "s/\"$APP_ID\"/$BUNDLE_ID/g; s/= $APP_ID;/= $BUNDLE_ID;/g" "$PROJECT"
# The packager sets the project to the newest macOS; the targets use 12.0, Safari 18.4 runs there too.
sed -i '' 's/MACOSX_DEPLOYMENT_TARGET = [0-9.]*;/MACOSX_DEPLOYMENT_TARGET = 12.0;/g' "$PROJECT"
# App Store Connect needs a category; the version follows package.json. The app uses no encryption of its own,
# so App Store Connect does not ask about export compliance.
sed -i '' "s/MARKETING_VERSION = [0-9.]*;/MARKETING_VERSION = $VERSION;/g" "$PROJECT"
sed -i '' 's/INFOPLIST_KEY_NSHumanReadableCopyright = "";/INFOPLIST_KEY_NSHumanReadableCopyright = "© TEQneers GmbH \& Co. KG";/g' "$PROJECT"
sed -i '' 's/^\([[:space:]]*\)INFOPLIST_KEY_NSMainStoryboardFile = Main;/\1INFOPLIST_KEY_LSApplicationCategoryType = "public.app-category.utilities";\
\1INFOPLIST_KEY_NSMainStoryboardFile = Main;/' "$PROJECT"
sed -i '' 's/^\([[:space:]]*\)INFOPLIST_KEY_CFBundleDisplayName = \(.*\);/\1INFOPLIST_KEY_CFBundleDisplayName = \2;\
\1INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;/' "$PROJECT"
sed -i '' 's/^\([[:space:]]*\)CODE_SIGN_STYLE = Automatic;/\1CODE_SIGN_STYLE = Automatic;\
\1DEVELOPMENT_TEAM = '"$TEAM"';/' "$PROJECT"
npm run icons
grep -E 'PRODUCT_BUNDLE_IDENTIFIER|MARKETING_VERSION|LSApplicationCategoryType|ITSAppUses|DEVELOPMENT_TEAM' "$PROJECT" | sort -u
