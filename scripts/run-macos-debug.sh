#!/bin/sh
set -eu

if [ "$(uname -s)" != "Darwin" ]; then
  echo "debug:macos is only available on macOS." >&2
  exit 1
fi

npm run tauri -- build --debug --bundles app

presenta_app="src-tauri/target/debug/bundle/macos/Presenta.app"
codesign --force --deep --sign - \
  --identifier com.presenta.desktop \
  --requirements '=designated => identifier "com.presenta.desktop"' \
  "$presenta_app"

echo "Launching the stably signed Presenta debug app…"
open "$presenta_app"
