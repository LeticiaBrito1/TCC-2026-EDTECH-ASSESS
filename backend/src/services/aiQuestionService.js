import OpenAI from "openai";
import { readFileSync } from "node:fs";
import { env } from "../config/env.js";

const LETRAS = ["A", "B", "C", "D", "E"];
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const hasOpenAiKey = Boolean(OPENAI_API_KEY);
const openai = hasOpenAiKey
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

const hasGroqKey = Boolean(env.groqApiKey);
const groq = hasGroqKey
  ? new OpenAI({ apiKey: env.groqApiKey, baseURL: "https://api.groq.com/openai/v1" })
  : null;

const OLLAMA_TIMEOUT_MS = 120000;
const PREVIEW_MAX_CHARS = 240;

const elapsedMs = (startedAt) => Date.now() - startedAt;

const previewText = (value) => textValue(value).slice(0, PREVIEW_MAX_CHARS);

const logAiInfo = (message, details) => {
  if (details === undefined) {
    console.log(`[ai-service] ${message}`);
    return;
  }
  console.log(`[ai-service] ${message}`, details);
};

const logAiWarn = (message, details) => {
  if (details === undefined) {
    console.warn(`[ai-service] ${message}`);
    return;
  }
  console.warn(`[ai-service] ${message}`, details);
};

const logAiError = (message, details) => {
  if (details === undefined) {
    console.error(`[ai-service] ${message}`);
    return;
  }
  console.error(`[ai-service] ${message}`, details);
};

const textValue = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return "";
};

const normalizeUrl = (value) => {
  const normalized = textValue(value).replace(/\/+$/, "");
  if (!normalized) return "";
  if (!/^https?:\/\//i.test(normalized)) {
    return `http://${normalized}`;
  }
  return normalized;
};

const readWslHostIp = () => {
  try {
    const resolvConf = readFileSync("/etc/resolv.conf", "utf8");
    const match = resolvConf.match(/^nameserver\s+([^\s#]+)$/m);
    return textValue(match?.[1]);
  } catch {
    return "";
  }
};

const uniqueUrls = (urls) => {
  const seen = new Set();
  const result = [];

  for (const rawUrl of urls) {
    const normalized = normalizeUrl(rawUrl);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
};

const resolveOllamaBaseUrls = () => {
  const configuredBaseUrl = normalizeUrl(env.ollamaBaseUrl);
  const configuredList = String(process.env.OLLAMA_BASE_URLS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const candidates = [configuredBaseUrl, ...configuredList];
  const defaultPort = "11434";

  try {
    const parsedConfigured = new URL(configuredBaseUrl || "http://127.0.0.1:11434");
    const port = parsedConfigured.port || defaultPort;
    const protocol = parsedConfigured.protocol || "http:";
    const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);

    if (localHosts.has(parsedConfigured.hostname.toLowerCase())) {
      candidates.push(
        `${protocol}//127.0.0.1:${port}`,
        `${protocol}//localhost:${port}`,
        `${protocol}//host.docker.internal:${port}`
      );

      const wslHostIp = readWslHostIp();
      if (wslHostIp && !localHosts.has(wslHostIp.toLowerCase())) {
        candidates.push(`${protocol}//${wslHostIp}:${port}`);
      }
    }
  } catch {
    // Ignora erro de parsing e segue com os candidatos configurados.
  }

  return uniqueUrls(candidates);
};

const fetchJsonWithTimeout = async (url, options = {}, timeoutMs = OLLAMA_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};

const formatOllamaError = (error) => {
  if (error?.name === "AbortError") {
    return `timeout após ${Math.round(OLLAMA_TIMEOUT_MS / 1000)}s`;
  }

  const causeCode = textValue(error?.cause?.code);
  const causeMessage = textValue(error?.cause?.message);
  const message = textValue(error?.message);

  return textValue(causeCode, causeMessage, message, "erro desconhecido");
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

const isValidProvider = (provider) => ["ollama", "openai", "groq"].includes(String(provider || "").toLowerCase());

const resolveProviders = () => {
  if (isValidProvider(env.aiProvider)) {
    return [env.aiProvider];
  }

  if (hasGroqKey) return ["groq", "openai", "ollama"];
  if (hasOpenAiKey) return ["openai", "ollama"];
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
  let parsedContent;

  try {
    parsedContent = JSON.parse(extractJsonString(rawContent));
  } catch (error) {
    logAiWarn("Falha ao converter resposta da IA em JSON.", {
      error: error?.message || "erro desconhecido",
      raw_preview: previewText(rawContent),
    });
    throw new Error(`Falha ao converter resposta da IA em JSON: ${error?.message || "erro desconhecido"}`);
  }

  const normalizedQuestions = normalizeQuestions(extractQuestionsPayload(parsedContent), defaults);

  if (normalizedQuestions.length === 0) {
    logAiWarn("Resposta da IA veio sem questões válidas após normalização.", {
      raw_preview: previewText(rawContent),
    });
    throw new Error("A IA respondeu, mas o conteúdo não veio em formato válido.");
  }

  return normalizedQuestions;
};

const generateWithOpenAi = async (payload, defaults) => {
  const startedAt = Date.now();

  if (!openai) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }

  logAiInfo("Iniciando chamada ao provedor OpenAI.", {
    model: env.openAiModel,
    tema: payload.tema,
    quantidade: payload.quantidade,
  });

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

  logAiInfo("OpenAI respondeu com sucesso.", {
    model: completion.model || env.openAiModel,
    questions: questions.length,
    duration_ms: elapsedMs(startedAt),
  });

  return {
    source: "openai",
    model: completion.model || env.openAiModel,
    reason: "",
    questions,
  };
};

const generateWithGroq = async (payload, defaults) => {
  const startedAt = Date.now();

  if (!groq) throw new Error("GROQ_API_KEY não configurada.");

  logAiInfo("Iniciando chamada ao provedor Groq.", {
    model: env.groqModel,
    tema: payload.tema,
    quantidade: payload.quantidade,
  });

  const completion = await groq.chat.completions.create({
    model: env.groqModel,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Você gera questões no formato JSON solicitado, sem texto adicional." },
      { role: "user", content: buildPrompt(payload) },
    ],
  });

  const rawContent = completion.choices?.[0]?.message?.content || "";
  const questions = parseAndNormalizeQuestions(rawContent, defaults);

  logAiInfo("Groq respondeu com sucesso.", {
    model: completion.model || env.groqModel,
    questions: questions.length,
    duration_ms: elapsedMs(startedAt),
  });

  return { source: "groq", model: completion.model || env.groqModel, reason: "", questions };
};

const generateWithOllama = async (payload, defaults) => {
  const startedAt = Date.now();
  const baseUrls = resolveOllamaBaseUrls();
  const errors = [];

  logAiInfo("Iniciando chamada ao provedor Ollama.", {
    model: env.ollamaModel,
    timeout_ms: OLLAMA_TIMEOUT_MS,
    attempts: baseUrls,
    tema: payload.tema,
    quantidade: payload.quantidade,
  });

  for (const baseUrl of baseUrls) {
    const attemptStartedAt = Date.now();

    try {
      logAiInfo("Tentando endpoint Ollama.", { base_url: baseUrl });

      const response = await fetchJsonWithTimeout(`${baseUrl}/api/chat`, {
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
        const errorDetail = `${baseUrl}: HTTP ${response.status} (${textValue(detail) || "sem detalhes"})`;
        errors.push(errorDetail);
        logAiWarn("Endpoint Ollama retornou HTTP de erro.", {
          base_url: baseUrl,
          status: response.status,
          detail: previewText(detail),
          duration_ms: elapsedMs(attemptStartedAt),
        });
        continue;
      }

      const data = await response.json();
      const rawContent = textValue(data?.message?.content, data?.response);

      if (!rawContent) {
        const emptyError = `${baseUrl}: resposta vazia`;
        errors.push(emptyError);
        logAiWarn("Endpoint Ollama respondeu sem conteúdo.", {
          base_url: baseUrl,
          duration_ms: elapsedMs(attemptStartedAt),
        });
        continue;
      }

      const questions = parseAndNormalizeQuestions(rawContent, defaults);
      const model = textValue(data?.model, env.ollamaModel);

      logAiInfo("Endpoint Ollama respondeu com sucesso.", {
        base_url: baseUrl,
        model,
        questions: questions.length,
        attempt_duration_ms: elapsedMs(attemptStartedAt),
        total_duration_ms: elapsedMs(startedAt),
      });

      return {
        source: "ollama",
        model,
        reason: "",
        questions,
      };
    } catch (error) {
      const errorMessage = formatOllamaError(error);
      errors.push(`${baseUrl}: ${errorMessage}`);
      logAiWarn("Falha ao chamar endpoint Ollama.", {
        base_url: baseUrl,
        error: errorMessage,
        duration_ms: elapsedMs(attemptStartedAt),
      });
    }
  }

  logAiError("Falha em todas as tentativas com Ollama.", {
    attempts: baseUrls,
    errors,
    total_duration_ms: elapsedMs(startedAt),
  });

  throw new Error(
    `Falha ao chamar Ollama. Tentativas: ${errors.join(" | ") || "nenhuma URL disponível"}.`
  );
};

export async function generateQuestions(payload) {
  const startedAt = Date.now();
  const defaults = {
    tema: payload.tema,
    competencia: payload.competencia || "",
    nivel_dificuldade: normalizeNivel(payload.nivel_dificuldade || "medio"),
  };

  const providers = resolveProviders();
  const errors = [];

  logAiInfo("Fluxo de geração iniciado.", {
    configured_provider: env.aiProvider,
    selected_providers: providers,
    has_openai_key: hasOpenAiKey,
    tema: payload.tema,
    quantidade: payload.quantidade,
    nivel_dificuldade: defaults.nivel_dificuldade,
  });

  for (const provider of providers) {
    const providerStartedAt = Date.now();

    try {
      if (provider === "groq") {
        const result = await generateWithGroq(payload, defaults);
        logAiInfo("Provedor concluído com sucesso.", {
          provider, source: result.source, model: result.model || "",
          questions: result.questions.length, duration_ms: elapsedMs(providerStartedAt), total_duration_ms: elapsedMs(startedAt),
        });
        return result;
      }

      if (provider === "openai") {
        const result = await generateWithOpenAi(payload, defaults);
        logAiInfo("Provedor concluído com sucesso.", {
          provider,
          source: result.source,
          model: result.model || "",
          questions: result.questions.length,
          duration_ms: elapsedMs(providerStartedAt),
          total_duration_ms: elapsedMs(startedAt),
        });
        return result;
      }

      if (provider === "ollama") {
        const result = await generateWithOllama(payload, defaults);
        logAiInfo("Provedor concluído com sucesso.", {
          provider,
          source: result.source,
          model: result.model || "",
          questions: result.questions.length,
          duration_ms: elapsedMs(providerStartedAt),
          total_duration_ms: elapsedMs(startedAt),
        });
        return result;
      }
    } catch (error) {
      const errorMessage = error?.message || "erro desconhecido";
      errors.push(`${provider}: ${errorMessage}`);
      logAiWarn("Provedor falhou, tentando próximo se disponível.", {
        provider,
        error: errorMessage,
        duration_ms: elapsedMs(providerStartedAt),
      });
    }
  }

  logAiWarn("Nenhum provedor de IA respondeu com sucesso. Aplicando fallback local.", {
    errors,
    total_duration_ms: elapsedMs(startedAt),
  });

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
