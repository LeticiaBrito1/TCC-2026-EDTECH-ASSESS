import OpenAI from "openai";
import { env } from "../config/env.js";

const LETRAS = ["A", "B", "C", "D", "E"];
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const hasOpenAiKey = Boolean(OPENAI_API_KEY);
const openai = hasOpenAiKey
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

const textValue = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return "";
};

const normalizeNivel = (value, fallback = "medio") => {
  const normalized = textValue(value).toLowerCase();
  if (["facil", "fácil"].includes(normalized)) return "facil";
  if (["medio", "médio"].includes(normalized)) return "medio";
  if (["dificil", "difícil"].includes(normalized)) return "dificil";
  return fallback;
};

const normalizeQuantidade = (value, fallback = 5) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(20, Math.trunc(parsed)));
};

const isValidProvider = (provider) => ["ollama", "openai"].includes(String(provider || "").toLowerCase());

const resolveProviders = () => {
  if (isValidProvider(env.aiProvider)) {
    return [env.aiProvider];
  }

  if (hasOpenAiKey) {
    return ["openai", "ollama"];
  }

  return ["ollama"];
};

const fallbackQuestions = ({ tema, quantidade, nivel_dificuldade, competencia }) =>
  Array.from({ length: normalizeQuantidade(quantidade) }).map((_, index) => ({
    enunciado: `Questão ${index + 1}: Sobre ${tema}, assinale a alternativa correta.`,
    alternativas: [
      { letra: "A", texto: `Definição correta sobre ${tema}.` },
      { letra: "B", texto: `Afirmação parcialmente correta sobre ${tema}.` },
      { letra: "C", texto: `Interpretação incorreta sobre ${tema}.` },
      { letra: "D", texto: `Aplicação não correspondente ao tema.` },
      { letra: "E", texto: `Alternativa sem relação com o conteúdo.` },
    ],
    gabarito: "A",
    tema,
    nivel_dificuldade,
    competencia,
  }));

const extractJsonString = (content) => {
  const trimmed = textValue(content);
  if (!trimmed) return "";
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;

  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
};

const normalizeAlternativas = (alternativas) => {
  if (Array.isArray(alternativas)) {
    return alternativas
      .slice(0, LETRAS.length)
      .map((item, index) => {
        if (typeof item === "string") {
          return { letra: LETRAS[index], texto: item.trim() };
        }

        const letraRaw = textValue(item?.letra, item?.letter).toUpperCase();
        const letra = LETRAS.includes(letraRaw) ? letraRaw : LETRAS[index];
        const texto = textValue(item?.texto, item?.text, item?.conteudo, item?.content);
        return { letra, texto };
      })
      .filter((item) => item.texto);
  }

  if (alternativas && typeof alternativas === "object") {
    return LETRAS.map((letra) => {
      const rawValue =
        alternativas?.[letra] ??
        alternativas?.[letra.toLowerCase()] ??
        alternativas?.[`opcao_${letra.toLowerCase()}`];

      const texto = textValue(
        rawValue,
        rawValue?.texto,
        rawValue?.text,
        rawValue?.conteudo,
        rawValue?.content
      );

      return { letra, texto };
    }).filter((item) => item.texto);
  }

  return [];
};

const normalizeGabarito = (alternativas, ...values) => {
  const fallback = alternativas[0]?.letra || "A";
  const normalized = textValue(...values).toUpperCase();
  if (!normalized) return fallback;

  const letraMatch = normalized.match(/[A-E]/);
  if (letraMatch && alternativas.some((option) => option.letra === letraMatch[0])) {
    return letraMatch[0];
  }

  const numeroMatch = normalized.match(/[1-5]/);
  if (numeroMatch) {
    const mapped = LETRAS[Number(numeroMatch[0]) - 1];
    if (alternativas.some((option) => option.letra === mapped)) {
      return mapped;
    }
  }

  return fallback;
};

const normalizeQuestions = (rawQuestions, defaults) => {
  if (!Array.isArray(rawQuestions)) return [];

  return rawQuestions
    .map((item, index) => {
      const tema = textValue(item?.tema, item?.topic, defaults.tema);
      const competencia = textValue(item?.competencia, item?.competency, defaults.competencia);
      const nivel = normalizeNivel(item?.nivel_dificuldade || item?.difficulty, defaults.nivel_dificuldade);
      const alternativas = normalizeAlternativas(
        item?.alternativas ||
          item?.alternatives ||
          item?.opcoes ||
          item?.options ||
          {
            A: item?.A ?? item?.a,
            B: item?.B ?? item?.b,
            C: item?.C ?? item?.c,
            D: item?.D ?? item?.d,
            E: item?.E ?? item?.e,
          }
      );

      const gabarito = normalizeGabarito(
        alternativas,
        item?.gabarito,
        item?.correct_answer,
        item?.correctOption,
        item?.answer
      );

      return {
        enunciado: textValue(
          item?.enunciado,
          item?.question,
          item?.pergunta,
          `Questão ${index + 1} sobre ${tema}`
        ),
        alternativas,
        gabarito,
        tema,
        nivel_dificuldade: nivel,
        competencia,
      };
    })
    .filter((question) => question.enunciado && question.alternativas.length >= 2);
};

const buildPrompt = ({
  titulo,
  tema,
  quantidade,
  nivel_dificuldade,
  competencia,
  contexto,
  linguagem,
}) => {
  return [
    "Você é um professor especialista em avaliações escolares.",
    `Idioma de saída: ${linguagem || "pt-BR"}.`,
    `Gere exatamente ${quantidade} questões de múltipla escolha sobre o tema: ${tema}.`,
    `Nível de dificuldade: ${nivel_dificuldade}.`,
    competencia ? `Competência alvo: ${competencia}.` : "",
    contexto ? `Contexto adicional: ${contexto}.` : "",
    `Título da avaliação: ${titulo || "Avaliação"}.`,
    "Formato obrigatório de saída (JSON puro):",
    "{",
    '  "questions": [',
    "    {",
    '      "enunciado": "texto",',
    '      "alternativas": [',
    '        {"letra":"A","texto":"..."},',
    '        {"letra":"B","texto":"..."},',
    '        {"letra":"C","texto":"..."},',
    '        {"letra":"D","texto":"..."},',
    '        {"letra":"E","texto":"..."}',
    "      ],",
    '      "gabarito": "A",',
    '      "tema": "texto",',
    '      "nivel_dificuldade": "facil|medio|dificil",',
    '      "competencia": "texto"',
    "    }",
    "  ]",
    "}",
    "Não inclua markdown, comentários nem explicações fora do JSON.",
  ]
    .filter(Boolean)
    .join("\n");
};

const extractQuestionsPayload = (data) => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  return data.questions || data.questoes || data.perguntas || data.items || data.data || [];
};

const parseAndNormalizeQuestions = (rawContent, defaults) => {
  const parsedContent = JSON.parse(extractJsonString(rawContent));
  const normalizedQuestions = normalizeQuestions(extractQuestionsPayload(parsedContent), defaults);

  if (normalizedQuestions.length === 0) {
    throw new Error("A IA respondeu, mas o conteúdo não veio em formato válido.");
  }

  return normalizedQuestions;
};

const generateWithOpenAi = async (payload, defaults) => {
  if (!openai) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }

  const completion = await openai.chat.completions.create({
    model: env.openAiModel,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Você gera questões no formato JSON solicitado, sem texto adicional.",
      },
      {
        role: "user",
        content: buildPrompt(payload),
      },
    ],
  });

  const rawContent = completion.choices?.[0]?.message?.content || "";
  const questions = parseAndNormalizeQuestions(rawContent, defaults);

  return {
    source: "openai",
    model: completion.model || env.openAiModel,
    reason: "",
    questions,
  };
};

const generateWithOllama = async (payload, defaults) => {
  const response = await fetch(`${env.ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.ollamaModel,
      stream: false,
      format: "json",
      options: {
        temperature: 0.7,
      },
      messages: [
        {
          role: "system",
          content: "Você gera questões no formato JSON solicitado, sem texto adicional.",
        },
        {
          role: "user",
          content: buildPrompt(payload),
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Falha ao chamar Ollama (${response.status}): ${textValue(detail) || "sem detalhes"}`);
  }

  const data = await response.json();
  const rawContent = textValue(data?.message?.content, data?.response);

  if (!rawContent) {
    throw new Error("Ollama retornou resposta vazia.");
  }

  const questions = parseAndNormalizeQuestions(rawContent, defaults);

  return {
    source: "ollama",
    model: textValue(data?.model, env.ollamaModel),
    reason: "",
    questions,
  };
};

export async function generateQuestions(payload) {
  const defaults = {
    tema: payload.tema,
    competencia: payload.competencia || "",
    nivel_dificuldade: normalizeNivel(payload.nivel_dificuldade || "medio"),
  };

  const providers = resolveProviders();
  const errors = [];

  for (const provider of providers) {
    try {
      if (provider === "openai") {
        return await generateWithOpenAi(payload, defaults);
      }

      if (provider === "ollama") {
        return await generateWithOllama(payload, defaults);
      }
    } catch (error) {
      errors.push(`${provider}: ${error?.message || "erro desconhecido"}`);
    }
  }

  return {
    source: "mock",
    model: null,
    reason:
      errors.length > 0
        ? `Falha na geração com IA (${errors.join(" | ")}). Aplicado fallback local.`
        : "Nenhum provedor de IA disponível. Aplicado fallback local.",
    questions: fallbackQuestions({
      tema: defaults.tema,
      quantidade: payload.quantidade,
      nivel_dificuldade: defaults.nivel_dificuldade,
      competencia: defaults.competencia,
    }),
  };
}
