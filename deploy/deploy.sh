#!/bin/bash
# =============================================================================
# deploy.sh — Atualiza o código na AWS e reinicia os serviços
# Execute toda vez que quiser publicar uma nova versão.
# =============================================================================
set -e

APP_DIR="/var/www/edtech"
REPO_DIR="$HOME/edtech-repo"

echo "======================================================"
echo " EdTech Assess — Deploy"
echo "======================================================"

# --- 1. Atualizar código do repositório ---
echo "[1/5] Atualizando código..."
if [ -d "$REPO_DIR/.git" ]; then
  cd "$REPO_DIR"
  git pull origin main
else
  echo "ERRO: Repositório não encontrado em $REPO_DIR"
  echo "      Execute primeiro: git clone <URL_DO_SEU_REPO> $REPO_DIR"
  exit 1
fi

# --- 2. Instalar dependências do backend ---
echo "[2/5] Instalando dependências do backend..."
cd "$REPO_DIR/backend"
npm install --omit=dev

# --- 3. Build do frontend ---
echo "[3/5] Fazendo build do frontend..."
cd "$REPO_DIR"
npm install --omit=dev

if [ ! -f ".env.production" ]; then
  echo "ERRO: Arquivo .env.production não encontrado na raiz do projeto."
  echo "      Copie o arquivo deploy/.env.production.example para .env.production e preencha."
  exit 1
fi

# Copia o .env.production para .env para o build do Vite
cp .env.production .env
npm run build

# --- 4. Copiar arquivos para as pastas de produção ---
echo "[4/5] Copiando arquivos..."

# Frontend (arquivos estáticos)
sudo cp -r "$REPO_DIR/dist/." "$APP_DIR/dist/"

# Backend
sudo mkdir -p "$APP_DIR/backend"
sudo cp -r "$REPO_DIR/backend/." "$APP_DIR/backend/"

# Copiar .env do backend
if [ -f "$REPO_DIR/backend/.env.production" ]; then
  sudo cp "$REPO_DIR/backend/.env.production" "$APP_DIR/backend/.env"
else
  echo "AVISO: backend/.env.production não encontrado. Verifique se o .env já existe em $APP_DIR/backend/.env"
fi

sudo mkdir -p /var/log/edtech
sudo chown -R $USER:$USER "$APP_DIR" /var/log/edtech

# --- 5. Reiniciar backend com PM2 ---
echo "[5/5] Reiniciando backend..."
cd "$APP_DIR/backend"

if pm2 list | grep -q "edtech-backend"; then
  pm2 reload edtech-backend --update-env
else
  pm2 start ecosystem.config.cjs --env production
fi

pm2 save

echo ""
echo "======================================================"
echo " Deploy concluído!"
echo " Backend : pm2 logs edtech-backend"
echo " Nginx   : sudo nginx -t && sudo systemctl reload nginx"
echo "======================================================"
