#!/bin/sh
# Sets the bundle identifier of the Safari app and its extension, e.g.
#   scripts/set-bundle-id.sh de.example.YouAreTheProduct
# The extension gets "<id>.Extension"; Xcode requires it to start with the app's id.
set -eu
NEW="$1"
DIR="safari/You Are The Product"
OLD=$(sed -n 's/^let extensionBundleIdentifier = "\(.*\)\.Extension"$/\1/p' "$DIR/You Are The Product/ViewController.swift")
[ -n "$OLD" ] || { echo "current bundle id not found" >&2; exit 1; }
sed -i '' "s/$OLD/$NEW/g" "$DIR/You Are The Product.xcodeproj/project.pbxproj" "$DIR/You Are The Product/ViewController.swift"
echo "bundle id: $OLD -> $NEW"
