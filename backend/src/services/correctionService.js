import { createWorker } from "tesseract.js";
import OpenAI from "openai";
import { entityRepository } from "../repositories/entityRepository.js";
import { entityService } from "./entityService.js";
import { auditService } from "./auditService.js";
import { HttpError } from "../utils/httpError.js";
import { env } from "../config/env.js";

const LETTER_OPTIONS = new Set(["A", "B", "C", "D", "E"]);
const GROQ_VISION_MODEL = "meta-llama/llama-4-maverick-17b-128e-instruct";
const GROQ_VISION_FALLBACK = "meta-llama/llama-4-scout-17b-16e-instruct";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUuid = (v) => UUID_REGEX.test(String(v || ""));

const groqVision = env.groqApiKey
  ? new OpenAI({ apiKey: env.groqApiKey, baseURL: "https://api.groq.com/openai/v1" })
  : null;

// ---------------------------------------------------------------------------
// Utilitários de imagem
// ---------------------------------------------------------------------------

const decodeImage = (imageBase64) => {
  const input = String(imageBase64 || "").trim();
  if (!input) throw new HttpError(400, "Imagem não informada.");

  if (input.startsWith("data:")) {
    const comma = input.indexOf(",");
    if (comma === -1) throw new HttpError(400, "Formato de imagem base64 inválido.");
    return { buffer: Buffer.from(input.slice(comma + 1), "base64"), dataUrl: input };
  }

  const buffer = Buffer.from(input, "base64");
  return { buffer, dataUrl: `data:image/jpeg;base64,${input}` };
};

// ---------------------------------------------------------------------------
// Parser de respostas a partir de texto (legado / fallback)
// ---------------------------------------------------------------------------

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\r/g, "\n")
    .toUpperCase();

const parseAnswersFromText = (rawText, totalQuestions) => {
  const map = {};
  const text = normalizeText(rawText);

  const regexes = [
    /(?:^|\b)(\d{1,3})\s*[:\-=\.\)]\s*([A-E])\b/gm,
    /(?:QUESTAO|Q)\s*(\d{1,3})\s*[:\-=\.\)]\s*([A-E])\b/gm,
  ];

  for (const regex of regexes) {
    let match = regex.exec(text);
    while (match) {
      const index = Number(match[1]);
      const answer = String(match[2]).toUpperCase();
      if (index >= 1 && index <= totalQuestions && LETTER_OPTIONS.has(answer)) {
        map[index] = answer;
      }
      match = regex.exec(text);
    }
  }

  if (Object.keys(map).length === 0) {
    const tokens = text.split(/\s+/).map((t) => t.trim()).filter(Boolean);
    for (let i = 0; i < tokens.length - 1; i++) {
      const q = Number(tokens[i]);
      const ans = tokens[i + 1];
      if (Number.isInteger(q) && q >= 1 && q <= totalQuestions && LETTER_OPTIONS.has(ans)) {
        map[q] = ans;
      }
    }
  }

  return map;
};

// ---------------------------------------------------------------------------
// Groq Llama 4 Scout — leitura completa do cartão resposta
// Extrai: avaliacao_id, aluno_id, versao E respostas das bolhas em uma chamada.
// ---------------------------------------------------------------------------

const buildVisionPrompt = (hintTotal) =>
  `Você está analisando uma FOLHA DE RESPOSTAS de prova escolar.

ESTRUTURA DA FOLHA:
- Cada questão tem 5 círculos na mesma linha, rotulados da ESQUERDA para DIREITA: A, B, C, D, E
- A = 1º círculo (mais à esquerda)
- B = 2º círculo
- C = 3º círculo (centro)
- D = 4º círculo
- E = 5º círculo (mais à direita)
- O aluno preencheu/escureceu apenas UM círculo por questão
- Círculos não marcados estão vazios ou apenas com a borda

TAREFA 1 — Identificação:
Localize o JSON impresso junto ao QR Code:
{"avaliacao_id":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx","aluno_id":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx","versao":"A"}
REGRAS: UUID = exatamente 36 chars (8-4-4-4-12, hex). Se não ler o UUID completo → null. Nunca invente.

TAREFA 2 — Respostas (questões 1 a ${hintTotal}):
Para CADA questão, conte os círculos da esquerda e identifique qual está escurecido.
Seja meticuloso: uma marcação leve já conta. Se dois estiverem marcados, escolha o mais escuro.
Se nenhum estiver marcado, omita a questão do JSON.

Responda SOMENTE com JSON válido (sem markdown, sem explicação):
{"avaliacao_id":"uuid ou null","aluno_id":"uuid ou null","versao":"letra ou null","respostas":{"1":"B","2":"A","3":"C",...}}`;

const runVisionFull = async (dataUrl, hintTotal, model = GROQ_VISION_MODEL) => {
  if (!groqVision) return null;

  const prompt = buildVisionPrompt(hintTotal || "N");

  try {
    const response = await groqVision.chat.completions.create({
      model,
      max_tokens: 1024,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const raw = response.choices?.[0]?.message?.content || "";
    console.log(`[vision:${model}] resposta bruta:`, raw.slice(0, 600));

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    const clean = (v) => (typeof v === "string" ? v.replace(/\s/g, "") : null);

    const respostasMap = {};
    for (const [k, v] of Object.entries(parsed.respostas || {})) {
      const idx = Number(k);
      const letra = String(v || "").toUpperCase().trim();
      if (idx >= 1 && LETTER_OPTIONS.has(letra)) respostasMap[idx] = letra;
    }

    const avaliacaoId = clean(parsed.avaliacao_id);
    const alunoId = clean(parsed.aluno_id);

    if (avaliacaoId && !isValidUuid(avaliacaoId)) {
      console.warn("[vision] avaliacao_id extraído não é UUID válido:", avaliacaoId);
    }
    if (alunoId && !isValidUuid(alunoId)) {
      console.warn("[vision] aluno_id extraído não é UUID válido:", alunoId);
    }

    return {
      avaliacaoId: isValidUuid(avaliacaoId) ? avaliacaoId : null,
      alunoId: isValidUuid(alunoId) ? alunoId : null,
      versao: parsed.versao || null,
      respostasMap,
    };
  } catch (err) {
    console.warn(`[vision:${model}] Falha:`, err.message);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Tesseract — fallback para leitura de texto puro
// ---------------------------------------------------------------------------

const runTesseract = async (imageBuffer) => {
  const worker = await createWorker("por+eng");
  try {
    const result = await worker.recognize(imageBuffer);
    return result?.data?.text || "";
  } finally {
    await worker.terminate();
  }
};

// ---------------------------------------------------------------------------
// Monta o objeto de correção a partir das respostas detectadas
// ---------------------------------------------------------------------------

const buildCorrection = ({ avaliacao, aluno, questions, answerMap }) => {
  const respostas = questions.map((question, idx) => {
    const resposta = answerMap[idx + 1] || "";
    const gabarito = String(question.gabarito || "").toUpperCase();
    return {
      questao_id: question.id,
      resposta,
      correta: Boolean(resposta) && resposta === gabarito,
    };
  });

  const totalAcertos = respostas.filter((r) => r.correta).length;
  const totalQuestoes = respostas.length;
  const percentual = totalQuestoes > 0 ? Math.round((totalAcertos / totalQuestoes) * 100) : 0;
  const nota = totalQuestoes > 0
    ? (totalAcertos / totalQuestoes) * (Number(avaliacao.total_pontos) || 10)
    : 0;

  return {
    avaliacao_id: avaliacao.id,
    aluno_id: aluno.id,
    turma_id: avaliacao.turma_id || null,
    respostas,
    nota: Math.round(nota * 100) / 100,
    total_acertos: totalAcertos,
    total_questoes: totalQuestoes,
    percentual_acerto: percentual,
    status: "corrigido",
  };
};

// ---------------------------------------------------------------------------
// Serviço principal
// ---------------------------------------------------------------------------

export const correctionService = {
  async correctByOcr({ avaliacaoId, alunoId, imageBase64, recognizedText }, actor) {
    let detectedAvaliacaoId = avaliacaoId || null;
    let detectedAlunoId = alunoId || null;
    let detectedVersao = null;
    let answerMap = {};
    let ocrSource = "provided";

    // --- Passo 1: Pré-carregar avaliação se ID já conhecido (para ter total de questões) ---
    let questionHint = null;
    if (detectedAvaliacaoId && isValidUuid(detectedAvaliacaoId)) {
      const preAvaliacao = await entityRepository.getById("avaliacoes", detectedAvaliacaoId, actor);
      if (preAvaliacao?.questoes_ids?.length) questionHint = preAvaliacao.questoes_ids.length;
    }

    // --- Passo 2: Processar imagem se fornecida ---
    if (imageBase64) {
      const { buffer, dataUrl } = decodeImage(imageBase64);

      // Tenta modelo principal com hint do total de questões
      let visionResult = await runVisionFull(dataUrl, questionHint, GROQ_VISION_MODEL);

      // Fallback para modelo secundário se o principal falhou
      if (!visionResult) {
        console.log("[vision] Tentando modelo fallback...");
        visionResult = await runVisionFull(dataUrl, questionHint, GROQ_VISION_FALLBACK);
      }

      if (visionResult) {
        ocrSource = "groq-vision";
        if (!detectedAvaliacaoId && visionResult.avaliacaoId) detectedAvaliacaoId = visionResult.avaliacaoId;
        if (!detectedAlunoId && visionResult.alunoId) detectedAlunoId = visionResult.alunoId;
        detectedVersao = visionResult.versao;
        answerMap = visionResult.respostasMap;
      } else {
        const tesseractText = await runTesseract(buffer);
        ocrSource = "tesseract";
        answerMap = parseAnswersFromText(tesseractText, 99);
      }
    } else if (recognizedText) {
      answerMap = parseAnswersFromText(recognizedText, 99);
      ocrSource = "text";
    }

    // --- Passo 3: Validar IDs ---
    if (!detectedAvaliacaoId || !isValidUuid(detectedAvaliacaoId)) {
      throw new HttpError(
        422,
        "Não foi possível identificar a avaliação na imagem. " +
        "Certifique-se de que o código de texto impresso abaixo do QR Code esteja visível e nítido, " +
        "ou selecione a avaliação manualmente antes de enviar a imagem."
      );
    }

    if (!detectedAlunoId || !isValidUuid(detectedAlunoId)) {
      throw new HttpError(
        422,
        "Não foi possível identificar o aluno na imagem. " +
        "Certifique-se de que o código de texto impresso abaixo do QR Code esteja visível e nítido, " +
        "ou selecione o aluno manualmente antes de enviar a imagem."
      );
    }

    // --- Passo 4: Carregar entidades do banco ---
    const avaliacao = await entityRepository.getById("avaliacoes", detectedAvaliacaoId, actor);
    if (!avaliacao) throw new HttpError(404, `Avaliação (${detectedAvaliacaoId}) não encontrada.`);

    const aluno = await entityRepository.getById("alunos", detectedAlunoId, actor);
    if (!aluno) throw new HttpError(404, `Aluno (${detectedAlunoId}) não encontrado.`);

    if (avaliacao.turma_id && aluno.turma_id && avaliacao.turma_id !== aluno.turma_id) {
      throw new HttpError(400, "Aluno e avaliação pertencem a turmas diferentes.");
    }

    const questionIds = Array.isArray(avaliacao.questoes_ids) ? avaliacao.questoes_ids : [];
    if (questionIds.length === 0) throw new HttpError(400, "A avaliação não possui questões vinculadas.");

    const questions = (
      await Promise.all(questionIds.map((id) => entityRepository.getById("questoes", id, actor)))
    ).filter(Boolean);

    if (questions.length === 0) throw new HttpError(400, "Nenhuma questão vinculada foi encontrada.");

    // --- Passo 5: Se vision não retornou respostas, retry com total exato ---
    if (Object.keys(answerMap).length === 0 && imageBase64 && ocrSource === "groq-vision") {
      const { dataUrl } = decodeImage(imageBase64);
      const retry = await runVisionFull(dataUrl, questions.length, GROQ_VISION_MODEL)
        || await runVisionFull(dataUrl, questions.length, GROQ_VISION_FALLBACK);
      if (retry) answerMap = retry.respostasMap;
    }

    if (Object.keys(answerMap).length === 0) {
      throw new HttpError(
        422,
        "Não foi possível identificar as marcações na folha de respostas. " +
        "Verifique se a imagem está nítida e bem iluminada, ou corrija manualmente."
      );
    }

    // --- Passo 6: Montar e salvar correção ---
    const correctionPayload = buildCorrection({ avaliacao, aluno, questions, answerMap });
    const createdResult = await entityService.create("resultados", correctionPayload, actor);

    await auditService.log({
      userId: actor?.id,
      action: "correction.ocr",
      entityType: "resultados",
      entityId: createdResult.id,
      details: {
        avaliacao_id: avaliacao.id,
        aluno_id: aluno.id,
        total_lidas: Object.keys(answerMap).length,
        ocr_source: ocrSource,
        versao_detectada: detectedVersao,
      },
    });

    return {
      source: ocrSource,
      detected: {
        avaliacao_titulo: avaliacao.titulo,
        aluno_nome: aluno.nome,
        versao: detectedVersao,
      },
      respostas_map: answerMap,
      resultado: createdResult,
    };
  },
};
