# Backend - Projeto TCC IA

## Arquitetura

Backend estruturado em MVC:

- `routes/` -> definição de rotas da API
- `controllers/` -> camada HTTP (req/res)
- `services/` -> regras de negócio
- `repositories/` -> acesso ao modelo
- `models/` -> persistência dos dados
- `middlewares/` -> tratamento de erro e utilitários

## Banco de dados atual

O backend está usando PostgreSQL.

- Tabela principal: `app_entities`
- Campos: `id`, `entity_type`, `data (jsonb)`, `created_at`, `updated_at`
- A tabela e índices são criados automaticamente na inicialização.

## Rodar localmente

1. Suba o PostgreSQL local:
   - `docker compose -f backend/docker-compose.yml up -d`
2. Copie `.env.example` para `.env` na pasta `backend`.
3. Instale dependências:
   - `npm --prefix backend install`
4. Inicie a API:
   - `npm run backend:dev`

## IA gratuita local (Ollama)

Por padrão, o backend está configurado para usar Ollama local (`AI_PROVIDER=ollama`).

1. Instale o Ollama: `https://ollama.com/download`
2. Baixe um modelo:
   - `ollama pull llama3.2:3b`
3. Inicie o Ollama (normalmente ele sobe como serviço local na porta `11434`).
4. Confirme as variáveis no `backend/.env`:
   - `AI_PROVIDER=ollama`
   - `OLLAMA_BASE_URL=http://127.0.0.1:11434`
   - `OLLAMA_MODEL=llama3.2:3b`

Quando quiser migrar para serviço pago, altere:

- `AI_PROVIDER=openai`
- `OPENAI_API_KEY=...`

## Endpoints

- `GET /api/health`
  - Retorna status da API.
- `GET /api/entities/:entity`
  - Lista registros da entidade.
- `GET /api/entities/:entity/:id`
  - Busca um registro por `id`.
- `POST /api/entities/:entity`
  - Cria um registro.
- `PUT /api/entities/:entity/:id`
  - Atualiza um registro.
- `DELETE /api/entities/:entity/:id`
  - Remove um registro.
- `POST /api/ai/generate-questions`
  - Gera questões de múltipla escolha para avaliações.

Entidades suportadas:

- `turmas`
- `disciplinas`
- `alunos`
- `questoes`
- `avaliacoes`
- `resultados`

### Exemplo de payload

```json
{
  "titulo": "Avaliação Diagnóstica",
  "tema": "Equações do 1º grau",
  "quantidade": 5,
  "nivel_dificuldade": "medio",
  "competencia": "Resolver problemas",
  "contexto": "Turma do 8º ano",
  "linguagem": "pt-BR"
}
```

### Exemplo de retorno

```json
{
  "source": "ollama",
  "model": "llama3.2:3b",
  "questions": [
    {
      "enunciado": "Questão...",
      "alternativas": [
        { "letra": "A", "texto": "..." },
        { "letra": "B", "texto": "..." }
      ],
      "gabarito": "A",
      "tema": "Equações do 1º grau",
      "nivel_dificuldade": "medio",
      "competencia": "Resolver problemas"
    }
  ]
}
```
