# Backend - Projeto TCC IA

## Rodar localmente

1. Copie `.env.example` para `.env` na pasta `backend`.
2. Instale dependências:
   - `npm --prefix backend install`
3. Inicie a API:
   - `npm run backend:dev`

## Endpoints

- `GET /api/health`
  - Retorna status da API.
- `POST /api/ai/generate-questions`
  - Gera questões de múltipla escolha para avaliações.

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
  "source": "openai",
  "model": "gpt-4o-mini",
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
