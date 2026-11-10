#!/usr/bin/env bash
set -e

echo "=============================================="
echo "  Media Downloader - macOS / Linux Launcher"
echo "=============================================="

if [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
  echo "📦 Installing dependencies for first-time setup..."
  npm run setup
fi

npm run dev

