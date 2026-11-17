#!/usr/bin/env bash
# ==============================================================================
# VibeDiet 1-Command GitHub Repository Initializer, Secret Configurer & Publisher
# Usage:
#   chmod +x scripts/push-to-github.sh
#   ./scripts/push-to-github.sh [github-username/repo-name]
# ==============================================================================
set -euo pipefail

REPO_NAME="${1:-vibediet-production-saas}"
echo "🚀 Initializing VibeDiet Production Repository for GitHub ($REPO_NAME)..."

if [ ! -d ".git" ]; then
  git init -b main
fi

git add -A
git commit -m "feat(release): commercial SaaS customer app, founder revenue console, 6-hub connections & full legal shield" || true

if command -v gh >/dev/null 2>&1; then
  echo "🔐 GitHub CLI (gh) detected — creating/syncing repository '$REPO_NAME'..."
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push || git push -u origin main
  
  # Optional: Sync .env secrets to GitHub Actions if .env exists
  if [ -f ".env" ]; then
    echo "🔑 Syncing .env keys to GitHub Actions Secrets..."
    gh secret set -f .env || true
  fi
  echo "✅ Successfully pushed to GitHub! Enable GitHub Pages in Settings -> Pages -> GitHub Actions."
else
  echo "ℹ️ GitHub CLI (gh) not installed. If you have a remote URL or Personal Access Token:"
  echo "   git remote add origin https://github.com/YOUR_USERNAME/$REPO_NAME.git"
  echo "   git push -u origin main"
fi