#!/usr/bin/env bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SLOTIFY_DIR="$(dirname "$SCRIPT_DIR")/slotify"

for dir in "$SLOTIFY_DIR"/*/; do
  dir_name=$(basename "$dir")
  pushd "$SLOTIFY_DIR/$dir_name" > /dev/null
  ([[ ! -d "./node_modules" || $* == *--force-install* ]] && npm ci)
  popd > /dev/null
done
