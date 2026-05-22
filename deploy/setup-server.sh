#!/bin/bash
# =============================================================================
# setup-server.sh — Configuração inicial do servidor EC2 (Ubuntu 22.04)
# Execute UMA ÚNICA VEZ após criar a instância EC2.
# =============================================================================
set -e

APP_DIR="/var/www/edtech"
DB_NAME="edtech_db"
DB_USER="edtech_user"
DB_PASS="$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)"

echo "======================================================"
echo " EdTech Assess — Setup do servidor"
echo "======================================================"

# --- 1. Atualizar sistema ---
echo "[1/8] Atualizando pacotes..."
sudo apt-get update -y && sudo apt-get upgrade -y

# --- 2. Instalar Node.js 20 ---
echo "[2/8] Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# --- 3. Instalar PostgreSQL 15 ---
echo "[3/8] Instalando PostgreSQL..."
sudo apt-get install -y postgresql postgresql-contrib

# --- 4. Instalar Nginx ---
echo "[4/8] Instalando Nginx..."
sudo apt-get install -y nginx

# --- 5. Instalar PM2 ---
echo "[5/8] Instalando PM2..."
sudo npm install -g pm2

# --- 6. Criar banco de dados e usuário ---
echo "[6/8] Configurando banco de dados..."
sudo -u postgres psql <<SQL
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
SQL
echo ""
echo ">>> ANOTE ESTAS CREDENCIAIS (use no backend/.env) <<<"
echo "    DB_USER : ${DB_USER}"
echo "    DB_PASS : ${DB_PASS}"
echo "    DB_NAME : ${DB_NAME}"
echo "    DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
echo "=================================================="

# --- 7. Adicionar swap de 1 GB (EC2 t2.micro tem apenas 1 GB RAM) ---
echo "[7/8] Criando swap de 1 GB..."
if [ ! -f /swapfile ]; then
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# --- 8. Criar pasta da aplicação e configurar Nginx ---
echo "[8/8] Configurando Nginx e pastas..."
sudo mkdir -p ${APP_DIR}/dist
sudo chown -R $USER:$USER ${APP_DIR}

# Copiar configuração do Nginx
sudo cp "$(dirname "$0")/nginx.conf" /etc/nginx/sites-available/edtech
sudo ln -sf /etc/nginx/sites-available/edtech /etc/nginx/sites-enabled/edtech
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl enable nginx

# PM2 iniciar com sistema
pm2 startup systemd -u $USER --hp $HOME | tail -1 | sudo bash

echo ""
echo "======================================================"
echo " Setup concluído!"
echo " Próximo passo: execute deploy.sh para subir o código"
echo "======================================================"
