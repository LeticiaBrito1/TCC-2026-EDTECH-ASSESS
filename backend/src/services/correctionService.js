import { createWorker } from "tesseract.js";
import OpenAI from "openai";
import { entityRepository } from "../repositories/entityRepository.js";
import { entityService } from "./entityService.js";
import { auditService } from "./auditService.js";
import { HttpError } from "../utils/httpError.js";
import { env } from "../config/env.js";
import { detectAnswersOMR } from "./omrService.js";

const LETTER_OPTIONS = new Set(["A", "B", "C", "D", "E"]);
const GROQ_VISION_MODEL = "meta-llama/llama-4-maverick-17b-128e-instruct";
const GROQ_VISION_FALLBACK = "meta-llama/llama-4-scout-17b-16e-instruct";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUuid = (v) => UUID_REGEX.test(String(v || ""));

const groqVision = env.groqApiKey
  ? new OpenAI({ apiKey: env.groqApiKey, baseURL: "https://api.groq.com/openai/v1" })
  : null;

// ---------------------------------------------------------------------------
// Algoritmo de embaralhamento determinístico (espelhado do PDF generator)
// ---------------------------------------------------------------------------

const hashSeed = (value) => {
  const text = String(value || "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffledArray = (items, random) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const buildVersionQuestions = ({ questions, versionSeed, shuffleQuestions = false, shuffleAlternatives = false }) => {
  const random = mulberry32(versionSeed);
  const sourceList = shuffleQuestions ? shuffledArray(questions, random) : [...questions];

  return sourceList.map((question) => {
    let gabarito = String(question.gabarito || "A").toUpperCase();

    if (shuffleAlternatives && Array.isArray(question.alternativas) && question.alternativas.length > 0) {
      const originalList = question.alternativas.map((item, index) => ({
        letra: String(item?.letra || String.fromCharCode(65 + index)).toUpperCase(),
        texto: String(item?.texto || "").trim(),
      })).filter((item) => item.texto);

      const shuffledAlts = shuffledArray(originalList, random).map((item, index) => ({
        letra: String.fromCharCode(65 + index),
        texto: item.texto,
        originalLetra: item.letra,
      }));

      const found = shuffledAlts.find((alt) => alt.originalLetra === gabarito);
      gabarito = found?.letra || shuffledAlts[0]?.letra || "A";

      return { ...question, alternativas: shuffledAlts, gabarito };
    }

    return { ...question, gabarito };
  });
};

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

LAYOUT DA FOLHA:
- As questões estão dispostas em MÚLTIPLAS COLUNAS (geralmente 3 colunas por linha).
- Leia da ESQUERDA para DIREITA, de cima para baixo: primeira todas as questões da linha 1 (col1, col2, col3), depois linha 2, etc.
- Cada célula de questão mostra o número da questão seguido de 5 círculos: A B C D E (nessa ordem, da esquerda para direita).

COMO IDENTIFICAR A RESPOSTA MARCADA:
- O aluno marca apenas UM círculo por questão.
- A marca pode ser: espiral, rabisco, X, risco, preenchimento — qualquer traço dentro do círculo conta.
- Círculos SEM marca estão completamente vazios.
- Identifique a POSIÇÃO do círculo marcado: 1º=A, 2º=B, 3º=C, 4º=D, 5º=E.

TAREFA 1 — Identificação (JSON impresso no canto da folha, próximo ao QR Code):
Formato: {"avaliacao_id":"uuid","aluno_id":"uuid","versao":"A"}
UUID = exatamente 36 caracteres (8-4-4-4-12, somente hex e hífens).
Se não ler o UUID completo e correto → null. NUNCA invente ou complete.

TAREFA 2 — Respostas:
Examine CADA questão de 1 até ${hintTotal} individualmente.
Para cada uma, localize o círculo que contém qualquer traço/marca e registre sua letra (A/B/C/D/E).
Se nenhum círculo de uma questão tiver marca, omita essa questão do JSON.

Responda SOMENTE com JSON válido (sem markdown, sem texto extra):
{"avaliacao_id":"uuid ou null","aluno_id":"uuid ou null","versao":"letra ou null","respostas":{"1":"A","2":"C","3":"C","4":"B",...}}`;

const runVisionFull = async (dataUrl, hintTotal, model = GROQ_VISION_MODEL) => {
  if (!groqVision) return null;

  const prompt = buildVisionPrompt(hintTotal || "N");

  try {
    const response = await groqVision.chat.completions.create({
      model,
      max_tokens: 2048,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
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
// Moderação de conteúdo — rejeita imagens com conteúdo explícito/pornográfico
// ---------------------------------------------------------------------------

const checkExplicitContent = async (dataUrl) => {
  if (!groqVision) return false;
  try {
    const response = await groqVision.chat.completions.create({
      model: GROQ_VISION_FALLBACK,
      max_tokens: 5,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
            {
              type: "text",
              text: "Does this image contain pornographic, sexually explicit, nudity, or violent content? Answer only YES or NO.",
            },
          ],
        },
      ],
    });
    const answer = (response.choices?.[0]?.message?.content || "").toUpperCase().trim();
    return answer.startsWith("YES");
  } catch (err) {
    console.warn("[moderation] Falha na verificação de conteúdo:", err.message);
    return false;
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
  async correctByOcr({ avaliacaoId, alunoId, imageBase64, recognizedText, preview = false }, actor) {
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

      // Moderação: rejeita imagens com conteúdo explícito
      const isExplicit = await checkExplicitContent(dataUrl);
      if (isExplicit) {
        throw new HttpError(
          422,
          "A imagem enviada contém conteúdo inapropriado e não pode ser processada. " +
          "Envie apenas fotos de folhas de resposta."
        );
      }

      // ── Tentativa 1: OMR por pixel (sem IA) ──────────────────────────────
      // Usa as marcas de registro nos cantos para detectar bolhas marcadas.
      // Funciona offline, sem custo de API. Requer folha gerada com marcas.
      let omrMap = null;
      try {
        const hintForOmr = questionHint || 99;
        omrMap = await detectAnswersOMR(buffer, hintForOmr);
        if (Object.keys(omrMap).length > 0) {
          console.log(`[omr] Detectadas ${Object.keys(omrMap).length} respostas por pixel.`);
        } else {
          omrMap = null;
        }
      } catch (omrErr) {
        console.log("[omr] OMR falhou, usando IA como fallback:", omrErr.message);
      }

      if (omrMap) {
        ocrSource = "omr";
        answerMap = omrMap;
        // OMR não lê QR/texto — IDs ainda precisam vir do formulário ou da IA
        // Tentamos extrair IDs via IA (apenas metadados, sem releitura das bolhas)
        if (!detectedAvaliacaoId || !detectedAlunoId) {
          const metaResult = await runVisionFull(dataUrl, questionHint, GROQ_VISION_FALLBACK);
          if (metaResult) {
            if (!detectedAvaliacaoId && metaResult.avaliacaoId) detectedAvaliacaoId = metaResult.avaliacaoId;
            if (!detectedAlunoId && metaResult.alunoId) detectedAlunoId = metaResult.alunoId;
            detectedVersao = metaResult.versao;
          }
        }
      } else {
        // ── Tentativa 2: Groq Vision (IA) ────────────────────────────────────
        let visionResult = await runVisionFull(dataUrl, questionHint, GROQ_VISION_MODEL);
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
          // ── Tentativa 3: Tesseract (texto puro) ──────────────────────────
          const tesseractText = await runTesseract(buffer);
          ocrSource = "tesseract";
          answerMap = parseAnswersFromText(tesseractText, 99);
        }
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

    // --- Passo 6: Aplicar embaralhamento da versão detectada (se habilitado) ---
    let orderedQuestions = questions;
    const versaoLabel = detectedVersao || null;
    if (
      versaoLabel &&
      (avaliacao.embaralhar_questoes || avaliacao.embaralhar_alternativas)
    ) {
      const versionSeed = hashSeed(`${avaliacao.id}:${versaoLabel}`);
      orderedQuestions = buildVersionQuestions({
        questions,
        versionSeed,
        shuffleQuestions: Boolean(avaliacao.embaralhar_questoes),
        shuffleAlternatives: Boolean(avaliacao.embaralhar_alternativas),
      });
    }

    // --- Passo 7: Montar correção (e salvar apenas se não for preview) ---
    const correctionPayload = buildCorrection({ avaliacao, aluno, questions: orderedQuestions, answerMap });

    // Modo preview: retorna as respostas detectadas sem salvar para revisão do professor
    if (preview) {
      return {
        preview: true,
        source: ocrSource,
        detected: {
          avaliacao_id: avaliacao.id,
          avaliacao_titulo: avaliacao.titulo,
          aluno_id: aluno.id,
          aluno_nome: aluno.nome,
          versao: detectedVersao,
        },
        respostas_map: answerMap,
        // Respostas no formato {questao_id: letra} — usa a ordem embaralhada da versão
        respostas_por_questao: Object.fromEntries(
          orderedQuestions.map((q, idx) => [q.id, answerMap[idx + 1] || ""])
        ),
      };
    }

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
