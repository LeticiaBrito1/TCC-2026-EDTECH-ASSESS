# ============================================================
# ngrok-start.ps1 — Inicia o projeto completo via ngrok
# Uso: .\ngrok-start.ps1 -Dominio "seu-dominio.ngrok-free.app"
# ============================================================
param(
    [string]$Dominio = ""
)

# ─── Domínio ────────────────────────────────────────────────
if (-not $Dominio) {
    Write-Host ""
    Write-Host "Cole o seu domínio estático ngrok." -ForegroundColor Cyan
    Write-Host "Você o encontra em: https://dashboard.ngrok.com/domains" -ForegroundColor DarkCyan
    Write-Host "(Ex: abc-xyz-123.ngrok-free.app)" -ForegroundColor DarkGray
    Write-Host ""
    $Dominio = Read-Host "Domínio ngrok"
}

$Dominio = $Dominio.Trim().TrimStart("https://").TrimStart("http://").TrimEnd("/")
$NgrokUrl = "https://$Dominio"

Write-Host ""
Write-Host "URL pública: $NgrokUrl" -ForegroundColor Green
Write-Host ""

# ─── Atualiza .env do frontend (raiz) ───────────────────────
Write-Host "  [1/4] Atualizando .env do frontend..." -ForegroundColor Yellow
$frontEnv = Get-Content .env -Raw
$frontEnv = $frontEnv -replace 'VITE_BACKEND_URL=[^\r\n]*', "VITE_BACKEND_URL=$NgrokUrl"
Set-Content .env $frontEnv -Encoding utf8 -NoNewline

# ─── Atualiza .env do backend ────────────────────────────────
Write-Host "  [2/4] Atualizando .env do backend..." -ForegroundColor Yellow
$backEnv = Get-Content backend\.env -Raw
$backEnv = $backEnv -replace 'FRONTEND_ORIGIN=[^\r\n]*', "FRONTEND_ORIGIN=$NgrokUrl"
$backEnv = $backEnv -replace 'APP_URL=[^\r\n]*', "APP_URL=$NgrokUrl"
Set-Content backend\.env $backEnv -Encoding utf8 -NoNewline

# ─── Atualiza .env do mobile ─────────────────────────────────
Write-Host "  [3/4] Atualizando .env do mobile..." -ForegroundColor Yellow
$mobileEnv = Get-Content mobile\.env -Raw
$mobileEnv = $mobileEnv -replace 'EXPO_PUBLIC_API_BASE_URL=[^\r\n]*', "EXPO_PUBLIC_API_BASE_URL=$NgrokUrl"
Set-Content mobile\.env $mobileEnv -Encoding utf8 -NoNewline

# ─── Build do frontend ──────────────────────────────────────
Write-Host "  [4/4] Buildando o frontend (npm run build)..." -ForegroundColor Yellow
$build = Start-Process -FilePath "npm" -ArgumentList "run", "build" -Wait -PassThru -NoNewWindow
if ($build.ExitCode -ne 0) {
    Write-Host ""
    Write-Host "ERRO: Build do frontend falhou. Corrija os erros acima e tente novamente." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  Build concluído!"                                      -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""

# ─── Inicia o backend em janela separada ────────────────────
Write-Host "Iniciando o backend em nova janela..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$PSScriptRoot'; npm run backend:start"
)

Start-Sleep -Seconds 3

# ─── Inicia ngrok ───────────────────────────────────────────
Write-Host "Iniciando ngrok..." -ForegroundColor Cyan
Write-Host ""
Write-Host "  Web/API:  $NgrokUrl" -ForegroundColor White
Write-Host "  Mobile:   configure EXPO_PUBLIC_API_BASE_URL=$NgrokUrl" -ForegroundColor White
Write-Host ""
Write-Host "Pressione Ctrl+C para encerrar o ngrok." -ForegroundColor DarkGray
Write-Host ""

ngrok http --url=$Dominio 8787
