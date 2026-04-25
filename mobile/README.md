# Mobile (React Native + Expo)

Aplicativo mobile para:

- login no mesmo backend do projeto
- leitura de QR Code da prova
- captura/seleção de imagem da folha
- envio para `POST /api/corrections/ocr`

## Pré-requisitos

- Node.js instalado
- Expo Go no celular
- Backend rodando em `http://SEU_IP:8787`

## Configuração

1. Copie `.env.example` para `.env` dentro de `mobile/`
2. Defina o IP da sua máquina:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.10:8787
```

Importante:

- no celular, `localhost` não funciona para acessar o backend do PC.
- use o IP local da máquina onde o backend está rodando.

## Rodar

Na raiz do projeto:

```bash
npm run mobile:install
npm run mobile:start
```

Ou direto na pasta `mobile/`:

```bash
npm install
npm run start
```

Depois:

- abra o Expo Go
- escaneie o QR do terminal

## Fluxo no app

1. Login com usuário do backend (`professor@edtech.local` / `123456`)
2. Ler QR da prova (preenche `avaliacao_id` e `aluno_id`)
3. Tirar foto ou escolher da galeria
4. Tocar em `Corrigir Prova`

## Observação

Permissões de câmera/galeria são solicitadas pelo app na primeira utilização.
