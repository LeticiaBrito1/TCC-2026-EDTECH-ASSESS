import { appClient } from "@/api/appClient";

const LETRAS = ["A", "B", "C", "D", "E"];

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

const normalizeAlternativas = (alternativas) => {
  if (Array.isArray(alternativas)) {
    return alternativas
      .slice(0, LETRAS.length)
      .map((item, index) => {
        if (typeof item === "string") {
          return { letra: LETRAS[index], texto: item.trim() };
        }

        const texto = textValue(
          item?.texto,
          item?.text,
          item?.conteudo,
          item?.content
        );

        const letraRaw = textValue(item?.letra, item?.letter).toUpperCase();
        const letra = LETRAS.includes(letraRaw) ? letraRaw : LETRAS[index];
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
  if (letraMatch && alternativas.some((item) => item.letra === letraMatch[0])) {
    return letraMatch[0];
  }

  const numeroMatch = normalized.match(/[1-5]/);
  if (numeroMatch) {
    const mapped = LETRAS[Number(numeroMatch[0]) - 1];
    if (alternativas.some((item) => item.letra === mapped)) {
      return mapped;
    }
  }

  return fallback;
};

const buildFallbackQuestions = ({ tema, quantidade, nivel, competencia }) => {
  return Array.from({ length: quantidade }).map((_, index) => ({
    enunciado: `Questão ${index + 1}: Sobre ${tema}, assinale a alternativa correta.`,
    alternativas: [
      { letra: "A", texto: `Conceito-chave de ${tema} aplicado corretamente.` },
      { letra: "B", texto: `Afirmação parcialmente correta sobre ${tema}.` },
      { letra: "C", texto: `Exemplo com erro conceitual de ${tema}.` },
      { letra: "D", texto: `Definição que não se aplica ao tema.` },
      { letra: "E", texto: `Alternativa sem relação direta com o conteúdo.` },
    ],
    gabarito: "A",
    tema,
    nivel_dificuldade: nivel,
    competencia,
  }));
};

const normalizeQuestions = (rawQuestions, defaults) => {
  if (!Array.isArray(rawQuestions)) return [];

  return rawQuestions.map((item, index) => {
    const tema = textValue(item?.tema, item?.topic, defaults.tema);
    const competencia = textValue(
      item?.competencia,
      item?.competency,
      defaults.competencia
    );
    const nivel = normalizeNivel(item?.nivel_dificuldade || item?.difficulty, defaults.nivel);

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
      disciplina_id: defaults.disciplinaId,
      tema,
      nivel_dificuldade: nivel,
      competencia,
      alternativas,
      gabarito,
    };
  }).filter((questao) => questao.enunciado && questao.alternativas.length >= 2);
};

const extractQuestions = (result) => {
  const payload = result?.data ?? result;
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  return (
    payload.questoes ||
    payload.questions ||
    payload.perguntas ||
    payload.items ||
    payload.data ||
    []
  );
};

const callBackendGenerator = async (functionName, payload) => {
  const response = await appClient.functions.invoke(functionName, payload);
  return response?.data ?? response;
};

export async function generateQuestionsForAssessment({
  titulo,
  tema,
  quantidade,
  nivel,
  disciplinaId,
  competencia,
  contexto,
  allowFallback = true,
}) {
  const functionName = import.meta.env.VITE_AI_FUNCTION_NAME || "gerar_questoes_ia";
  const quantitySafe = Math.max(1, Math.min(20, Number(quantidade || 5)));
  let lastErrorMessage = "";

  const payload = {
    titulo,
    tema,
    quantidade: quantitySafe,
    nivel_dificuldade: normalizeNivel(nivel),
    competencia,
    contexto,
    formato: "multipla_escolha",
    linguagem: "pt-BR",
  };

  try {
    const backendResult = await callBackendGenerator(functionName, payload);
    if (backendResult) {
      const normalized = normalizeQuestions(extractQuestions(backendResult), {
        tema,
        nivel: normalizeNivel(nivel),
        competencia,
        disciplinaId,
      });

      if (normalized.length > 0) {
        return {
          questions: normalized,
          source: backendResult.source || "backend",
          reason: backendResult.reason || "",
        };
      }
    }
  } catch (error) {
    lastErrorMessage = error?.message || "Falha ao acionar o backend de IA.";
    if (!allowFallback) throw error;
  }

  const fallback = buildFallbackQuestions({
    tema,
    quantidade: quantitySafe,
    nivel: normalizeNivel(nivel),
    competencia,
  }).map((q) => ({ ...q, disciplina_id: disciplinaId }));

  return {
    questions: fallback,
    source: "fallback",
    reason: lastErrorMessage || "Retorno inválido da IA. Aplicado fallback local.",
  };
}
