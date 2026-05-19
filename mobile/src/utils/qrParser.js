const AVALIACAO_KEYS = ["avaliacao_id", "avaliacaoId", "prova_id", "provaId", "avaliacao", "prova"];
const ALUNO_KEYS = ["aluno_id", "alunoId", "student_id", "studentId", "aluno", "student"];
const VERSAO_KEYS = ["versao", "versão", "version", "prova_versao", "provaVersao"];

const getFirstValue = (obj, keys) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return null;
};

const buildResult = (obj) => {
  const avaliacaoId = getFirstValue(obj, AVALIACAO_KEYS);
  const alunoId = getFirstValue(obj, ALUNO_KEYS);
  if (!avaliacaoId || !alunoId) return null;
  const versao = getFirstValue(obj, VERSAO_KEYS);
  return { avaliacaoId, alunoId, versao };
};

export const parseQrPayload = (rawValue) => {
  // Remove todo whitespace (espacos, quebras de linha, tabs) — UUIDs nao tem espacos.
  const raw = String(rawValue || "").replace(/\s/g, "");
  if (!raw) return null;

  if (raw.startsWith("{")) {
    // Auto-completa "}" se o texto foi copiado incompleto do PDF.
    const jsonStr = raw.endsWith("}") ? raw : raw + "}";
    try {
      const parsedJson = JSON.parse(jsonStr);
      const result = buildResult(parsedJson);
      if (result) return result;
    } catch {
      // Ignora JSON invalido e tenta outros formatos.
    }
  }

  try {
    const parsedUrl = new URL(raw);
    const paramsObj = Object.fromEntries(parsedUrl.searchParams.entries());
    const result = buildResult(paramsObj);
    if (result) return result;
  } catch {
    // Nao e URL. Continua.
  }

  const normalizedPairs = raw.replace(/[;,|]/g, "&");
  if (normalizedPairs.includes("=")) {
    const paramsObj = Object.fromEntries(new URLSearchParams(normalizedPairs).entries());
    const result = buildResult(paramsObj);
    if (result) return result;
  }

  return null;
};
