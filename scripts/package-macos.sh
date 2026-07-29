#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="VaultMind"
BUNDLE_ID="com.vaultmind.desktop"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
ELECTRON_APP="$ROOT_DIR/node_modules/electron/dist/Electron.app"
OUTPUT_DIR="$ROOT_DIR/out/VaultMind-darwin-arm64"
APP_DIR="$OUTPUT_DIR/$APP_NAME.app"
CONTENTS_DIR="$APP_DIR/Contents"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
FRAMEWORKS_DIR="$CONTENTS_DIR/Frameworks"

if [[ ! -d "$ELECTRON_APP" ]]; then
  echo "Electron runtime is missing. Run npm install first."
  exit 1
fi

if [[ ! -f "$ROOT_DIR/src/renderer/index.html" ]]; then
  echo "The production UI is missing. Run npm run build:ui first."
  exit 1
fi

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"
cp -R "$ELECTRON_APP" "$APP_DIR"

mv "$CONTENTS_DIR/MacOS/Electron" "$CONTENTS_DIR/MacOS/$APP_NAME"

plutil -replace CFBundleDisplayName -string "$APP_NAME" "$CONTENTS_DIR/Info.plist"
plutil -replace CFBundleName -string "$APP_NAME" "$CONTENTS_DIR/Info.plist"
plutil -replace CFBundleExecutable -string "$APP_NAME" "$CONTENTS_DIR/Info.plist"
plutil -replace CFBundleIdentifier -string "$BUNDLE_ID" "$CONTENTS_DIR/Info.plist"
plutil -replace CFBundleShortVersionString -string "$VERSION" "$CONTENTS_DIR/Info.plist"
plutil -replace CFBundleVersion -string "$VERSION" "$CONTENTS_DIR/Info.plist"
plutil -replace CFBundleIconFile -string "VaultMind.icns" "$CONTENTS_DIR/Info.plist"
plutil -replace LSApplicationCategoryType -string "public.app-category.productivity" "$CONTENTS_DIR/Info.plist"
plutil -remove ElectronAsarIntegrity "$CONTENTS_DIR/Info.plist" 2>/dev/null || true

cp "$ROOT_DIR/assets/app-icon.icns" "$RESOURCES_DIR/VaultMind.icns"

rm -f "$RESOURCES_DIR/default_app.asar"
mkdir -p "$RESOURCES_DIR/app"
cp "$ROOT_DIR/package.json" "$RESOURCES_DIR/app/package.json"
cp -R "$ROOT_DIR/src" "$RESOURCES_DIR/app/src"
cp -R "$ROOT_DIR/assets" "$RESOURCES_DIR/app/assets"
rsync -a --exclude electron --exclude '.bin' "$ROOT_DIR/node_modules/" "$RESOURCES_DIR/app/node_modules/"

rename_helper() {
  local suffix="$1"
  local old_name="Electron Helper${suffix}"
  local new_name="$APP_NAME Helper${suffix}"
  local old_app="$FRAMEWORKS_DIR/$old_name.app"
  local new_app="$FRAMEWORKS_DIR/$new_name.app"

  mv "$old_app" "$new_app"
  mv "$new_app/Contents/MacOS/$old_name" "$new_app/Contents/MacOS/$new_name"
  plutil -replace CFBundleDisplayName -string "$new_name" "$new_app/Contents/Info.plist"
  plutil -replace CFBundleName -string "$new_name" "$new_app/Contents/Info.plist"
  plutil -replace CFBundleExecutable -string "$new_name" "$new_app/Contents/Info.plist"
  plutil -replace CFBundleIdentifier -string "$BUNDLE_ID.helper${suffix//[^A-Za-z]/}" "$new_app/Contents/Info.plist"
}

rename_helper ""
rename_helper " (GPU)"
rename_helper " (Plugin)"
rename_helper " (Renderer)"

xattr -cr "$APP_DIR" 2>/dev/null || true
codesign --force --deep --sign - "$APP_DIR"

echo "$APP_DIR"
