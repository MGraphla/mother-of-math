$ErrorActionPreference = "Stop"

$projectRef = "yfxomzzihrvaxqyjearo"
$root = Split-Path -Parent $PSScriptRoot
$supabaseEnv = Join-Path $root "supabase\.env"
$migrationPath = Join-Path $root "supabase\migrations\20250325120000_signup_phone_verification.sql"

if (-not (Test-Path $supabaseEnv)) {
  throw "Missing $supabaseEnv"
}

Write-Host "Linking Supabase project $projectRef..." -ForegroundColor Cyan
npx supabase link --project-ref $projectRef

Write-Host "Uploading Edge Function secrets from supabase/.env..." -ForegroundColor Cyan
npx supabase secrets set --env-file $supabaseEnv

Write-Host "Deploying signup-verification function..." -ForegroundColor Cyan
npx supabase functions deploy signup-verification

Write-Host ""
Write-Host "Hosted function deployment complete." -ForegroundColor Green
Write-Host "Next required step if you have not run the SQL yet:" -ForegroundColor Yellow
Write-Host "Open Supabase SQL Editor and run:" -ForegroundColor Yellow
Write-Host "  $migrationPath" -ForegroundColor Yellow
