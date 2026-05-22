# Deploy na AWS — EdTech Assess

Arquitetura: **1 instância EC2 t2.micro** com Ubuntu 22.04  
- Nginx serve o frontend (React SPA)  
- PM2 mantém o backend (Node.js) rodando  
- PostgreSQL roda localmente na mesma VM  

---

## Parte 1 — Criar a instância EC2

1. Acesse o **AWS Console** → EC2 → **Launch Instance**

2. Configure:
   | Campo | Valor |
   |---|---|
   | Name | `edtech-assess` |
   | OS | Ubuntu Server 22.04 LTS |
   | Instance type | `t2.micro` (free tier) |
   | Key pair | Crie um novo → baixe o `.pem` |
   | Storage | 20 GB gp2 (padrão) |

3. Em **Network settings**, clique em **Edit** e adicione as regras:
   | Type | Port | Source |
   |---|---|---|
   | SSH | 22 | Meu IP (só seu IP) |
   | HTTP | 80 | 0.0.0.0/0 |

4. Clique **Launch Instance** e aguarde ficar em "Running".

5. Anote o **IP Público** (IPv4) da instância — você vai usar em vários lugares.

---

## Parte 2 — Primeira conexão SSH

### Windows (PowerShell)
```powershell
# Ajustar permissão do arquivo .pem
icacls "C:\caminho\para\sua-chave.pem" /inheritance:r /grant:r "$($env:USERNAME):(R)"

# Conectar
ssh -i "C:\caminho\para\sua-chave.pem" ubuntu@SEU_IP_EC2
```

### Mac/Linux
```bash
chmod 400 ~/Downloads/sua-chave.pem
ssh -i ~/Downloads/sua-chave.pem ubuntu@SEU_IP_EC2
```

---

## Parte 3 — Setup do servidor (execute UMA vez)

Dentro da instância EC2:

```bash
# Clonar o repositório
git clone https://github.com/SEU_USUARIO/SEU_REPO.git ~/edtech-repo
cd ~/edtech-repo

# Dar permissão e executar o setup
chmod +x deploy/setup-server.sh
bash deploy/setup-server.sh
```

**Anote as credenciais do banco de dados** que aparecem no final — você vai precisar delas no próximo passo.

---

## Parte 4 — Configurar as variáveis de ambiente

### Frontend (.env.production na raiz)
```bash
cp deploy/.env.production.example ~/edtech-repo/.env.production
nano ~/edtech-repo/.env.production
```
Preencha:
```
VITE_BACKEND_URL=http://SEU_IP_EC2
```

### Backend (backend/.env.production)
```bash
cp deploy/.env.backend.example ~/edtech-repo/backend/.env.production
nano ~/edtech-repo/backend/.env.production
```
Preencha todos os valores, especialmente:
- `DATABASE_URL` — use as credenciais geradas no setup
- `GROQ_API_KEY` — sua chave do Groq (https://console.groq.com)
- `JWT_SECRET` — gere um valor forte:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `FRONTEND_ORIGIN=http://SEU_IP_EC2`

---

## Parte 5 — Primeiro deploy

```bash
cd ~/edtech-repo
chmod +x deploy/deploy.sh
bash deploy/deploy.sh
```

Acesse `http://SEU_IP_EC2` no navegador — o projeto deve estar no ar.

---

## Parte 6 — Atualizar o projeto (próximos deploys)

Toda vez que fizer alterações e quiser publicar:

```bash
# No seu computador: commit e push para o GitHub
git add .
git commit -m "sua mensagem"
git push origin main

# No EC2: atualizar
ssh -i sua-chave.pem ubuntu@SEU_IP_EC2
bash ~/edtech-repo/deploy/deploy.sh
```

---

## Comandos úteis no servidor

```bash
# Ver status do backend
pm2 status

# Ver logs em tempo real
pm2 logs edtech-backend

# Reiniciar backend manualmente
pm2 restart edtech-backend

# Ver uso de memória/CPU
pm2 monit

# Status do Nginx
sudo systemctl status nginx

# Testar config do Nginx
sudo nginx -t

# Ver logs do Nginx
sudo tail -f /var/log/nginx/error.log
```

---

## Solução de problemas

### Site não abre
```bash
sudo systemctl status nginx
sudo nginx -t
pm2 logs edtech-backend --lines 50
```

### Backend não inicia
```bash
cd /var/www/edtech/backend
cat .env          # verificar se .env existe e está correto
node src/server.js  # testar diretamente (Ctrl+C para sair)
```

### Banco de dados com erro
```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "\l"   # listar bancos
```

### Sem memória (t2.micro tem apenas 1 GB)
```bash
free -h           # ver uso de memória
pm2 monit         # monitorar Node.js
```

---

## Custos estimados (free tier por 12 meses)

| Serviço | Free tier | Após 12 meses |
|---|---|---|
| EC2 t2.micro | 750h/mês grátis | ~$9/mês |
| Armazenamento 20 GB | 30 GB/mês grátis | ~$2/mês |
| Transferência | 15 GB/mês grátis | ~$0.09/GB |
| **Total** | **R$ 0** | **~R$ 60/mês** |
