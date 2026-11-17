# ==============================================================================
# VibeDiet — Dynamic Netlify Drop Auto-Sync Script (PowerShell)
# Usage:
#   .\scripts\sync-netlify-drop.ps1          # Syncs if changes detected
#   .\scripts\sync-netlify-drop.ps1 -Force   # Forces rebuild and repackaging
#   .\scripts\sync-netlify-drop.ps1 -Watch   # Watches for local file changes
# ==============================================================================
param(
    [switch]$Force,
    [switch]$Watch,
    [switch]$Deploy
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

Set-Location $projectRoot

if ($Watch) {
    Write-Host "👀 Starting VibeDiet Netlify Drop Watcher..." -ForegroundColor Cyan
    npx tsx scripts/sync-netlify-drop.ts --watch
} elseif ($Force) {
    Write-Host "⚡ Force-updating Netlify Drop..." -ForegroundColor Cyan
    npx tsx scripts/sync-netlify-drop.ts --force
} else {
    npx tsx scripts/sync-netlify-drop.ts
}

if ($Deploy) {
    Write-Host "🚀 Deploying to Netlify live..." -ForegroundColor Green
    $netlifyDir = "C:\Users\coder\Desktop\VibeDiet-Netlify"
    if (Test-Path $netlifyDir) {
        Set-Location $netlifyDir
        npx -y @netlify/mcp@latest --site-id f7ad1efc-9cb5-4e10-a300-5f121eb537d8
    }
}
