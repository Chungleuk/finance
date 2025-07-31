# PowerShell script to create .env.local file
# Run this script in the decision-tree-tracker directory

$envContent = @"
# Database Configuration
DATABASE_URL="postgres://neondb_owner:npg_iZXY4kHwg6Ll@ep-silent-breeze-a1yc8xoj-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# Optional: Alternative environment variable names that the app checks for
POSTGRES_URL="postgres://neondb_owner:npg_iZXY4kHwg6Ll@ep-silent-breeze-a1yc8xoj-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
POSTGRES_PRISMA_URL="postgres://neondb_owner:npg_iZXY4kHwg6Ll@ep-silent-breeze-a1yc8xoj-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
"@

# Create the .env.local file
$envContent | Out-File -FilePath ".env.local" -Encoding UTF8

Write-Host "✅ .env.local file created successfully!" -ForegroundColor Green
Write-Host "📁 File location: $(Get-Location)\.env.local" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: npm install" -ForegroundColor White
Write-Host "2. Run: node scripts/test-db.js" -ForegroundColor White
Write-Host "3. Run: npm run dev" -ForegroundColor White 