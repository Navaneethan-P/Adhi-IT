# CampusOS Quick Deploy Script
# Usage: .\deploy.ps1 "your change message"

param(
    [string]$message = "Update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
)

Write-Host "`n🚀 Deploying CampusOS..." -ForegroundColor Cyan
Write-Host "📝 Commit: $message`n" -ForegroundColor Yellow

git add .
git commit -m $message
git push

Write-Host "`n  Pushed to GitHub. Render will auto-deploy in ~2-3 minutes." -ForegroundColor Green
Write-Host "  Live app:     https://adhi-it.onrender.com" -ForegroundColor Cyan
Write-Host "  Dashboard:    https://dashboard.render.com" -ForegroundColor Cyan
Write-Host "  Deploy logs:  https://dashboard.render.com -> Adhi-IT -> Logs`n" -ForegroundColor Cyan
