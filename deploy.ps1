# CampusOS Quick Deploy Script
# Run: .\deploy.ps1 "your change message"

param(
    [string]$message = "Update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
)

Write-Host "`n🚀 Deploying CampusOS..." -ForegroundColor Cyan
Write-Host "📝 Commit: $message`n" -ForegroundColor Yellow

git add .
git commit -m $message
git push

Write-Host "`n✅ Pushed to GitHub! Render will auto-deploy in ~2 minutes." -ForegroundColor Green
Write-Host "🌐 Check status at: https://dashboard.render.com" -ForegroundColor Cyan
