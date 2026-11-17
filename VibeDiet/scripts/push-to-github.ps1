# ==============================================================================
# VibeDiet 1-Command Windows PowerShell GitHub Publisher
# Usage: .\scripts\push-to-github.ps1 -RepoName "vibediet-production-saas"
# ==============================================================================
param(
    [string]$RepoName = "vibediet-production-saas"
)

Write-Host "🚀 Initializing VibeDiet Production Repository ($RepoName)..." -ForegroundColor Green
if (!(Test-Path ".git")) {
    git init -b main
}
git add -A
git commit -m "feat(release): commercial SaaS customer app, founder console, connections hub & legal compliance suite"

if (Get-Command gh -ErrorAction SilentlyContinue) {
    gh repo create $RepoName --public --source=. --remote=origin --push
    Write-Host "✅ Pushed to GitHub via GitHub CLI!" -ForegroundColor Cyan
} else {
    Write-Host "Run: git remote add origin https://github.com/<YOUR_USER>/$RepoName.git; git push -u origin main" -ForegroundColor Yellow
}
