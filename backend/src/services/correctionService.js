import { createWorker } from "tesseract.js";
import OpenAI from "openai";
import { entityRepository } from "../repositories/entityRepository.js";
import { entityService } from "./entityService.js";
import { auditService } from "./auditService.js";
import { HttpError } from "../utils/httpError.js";
import { env } from "../config/env.js";

const LETTER_OPTIONS = new Set(["A", "B", "C", "D", "E"]);
const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
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

const runVisionFull = async (dataUrl, hintTotal) => {
  if (!groqVision) return null;

  const prompt =
    `Você está analisando um cartão resposta de prova escolar.\n\n` +
    `TAREFA 1 — Código de identificação (JSON impresso próximo ao QR Code):\n` +
    `Localize o bloco de texto JSON impresso junto ao QR Code. Ele tem este formato:\n` +
    `{"avaliacao_id":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx","aluno_id":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx","versao":"A"}\n` +
    `Os UUIDs têm EXATAMENTE 36 caracteres no padrão 8-4-4-4-12 ` +
    `(somente dígitos 0-9 e letras a-f, separados por hífens na posição certa).\n` +
    `REGRAS CRÍTICAS:\n` +
    `- Se não conseguir ler um UUID COMPLETO e correto (todos os 36 chars), retorne null para esse campo.\n` +
    `- NÃO invente, complete, adivinhe nem substitua caracteres por dígitos de outras partes do formulário.\n` +
    `- Número de matrícula, código de turma ou qualquer outro número do formulário NÃO é UUID — ignore.\n\n` +
    `TAREFA 2 — Respostas marcadas:\n` +
    `Na seção "Folha de Respostas", identifique qual círculo está marcado/preenchido ` +
    `com caneta ou lápis para cada questão numerada (de 1 a ${hintTotal || "N"}).\n\n` +
    `Responda SOMENTE com JSON válido neste formato (sem markdown, sem texto extra):\n` +
    `{"avaliacao_id":"uuid ou null","aluno_id":"uuid ou null","versao":"letra ou null",` +
    `"respostas":{"1":"B","2":"A","3":"C"}}`;

  try {
    const response = await groqVision.chat.completions.create({
      model: GROQ_VISION_MODEL,
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
    console.log("[vision] resposta bruta:", raw.slice(0, 600));

    // Extrai o primeiro bloco JSON da resposta (o modelo pode adicionar texto ao redor)
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
    console.warn("[vision] Falha no modelo de visão:", err.message);
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

    // --- Passo 1: Processar imagem se fornecida ---
    if (imageBase64) {
      const { buffer, dataUrl } = decodeImage(imageBase64);

      // Tenta Groq Vision (lê identificação + bolhas em uma chamada)
      const visionResult = await runVisionFull(dataUrl, null);

      if (visionResult) {
        ocrSource = "groq-vision";
        // Usa IDs detectados na imagem apenas se não foram fornecidos explicitamente
        if (!detectedAvaliacaoId && visionResult.avaliacaoId) detectedAvaliacaoId = visionResult.avaliacaoId;
        if (!detectedAlunoId && visionResult.alunoId) detectedAlunoId = visionResult.alunoId;
        detectedVersao = visionResult.versao;
        answerMap = visionResult.respostasMap;
      } else {
        // Fallback: Tesseract para texto + parse manual
        const tesseractText = await runTesseract(buffer);
        ocrSource = "tesseract";
        // Tesseract não extrai IDs, mas pode extrair respostas se digitadas
        answerMap = parseAnswersFromText(tesseractText, 99);
      }
    } else if (recognizedText) {
      answerMap = parseAnswersFromText(recognizedText, 99);
      ocrSource = "text";
    }

    // --- Passo 2: Validar que temos IDs no formato correto ---
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

    // --- Passo 3: Carregar entidades do banco ---
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

    // --- Passo 4: Se vision falhou nas respostas, tenta novamente com hint do total ---
    if (Object.keys(answerMap).length === 0 && imageBase64 && ocrSource === "groq-vision") {
      const { dataUrl } = decodeImage(imageBase64);
      const retry = await runVisionFull(dataUrl, questions.length);
      if (retry) answerMap = retry.respostasMap;
    }

    if (Object.keys(answerMap).length === 0) {
      throw new HttpError(
        422,
        "Não foi possível identificar as marcações na folha de respostas. " +
        "Verifique se a imagem está nítida e bem iluminada, ou corrija manualmente."
      );
    }

    // --- Passo 5: Montar e salvar correção ---
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
