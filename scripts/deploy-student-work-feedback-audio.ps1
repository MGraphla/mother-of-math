$ErrorActionPreference = "Stop"

$projectRef = "yfxomzzihrvaxqyjearo"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "Linking Supabase project $projectRef..." -ForegroundColor Cyan
npx supabase link --project-ref $projectRef

Write-Host "Deploying student-work-feedback-audio (--no-verify-jwt: required for browser CORS preflight)..." -ForegroundColor Cyan
npx supabase functions deploy student-work-feedback-audio --no-verify-jwt

Write-Host "Done. Ensure ELEVENLABS_API_KEY is set: npx supabase secrets list" -ForegroundColor Green
