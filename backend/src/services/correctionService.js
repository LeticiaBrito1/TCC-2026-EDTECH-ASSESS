import { createWorker } from "tesseract.js";
import { entityRepository } from "../repositories/entityRepository.js";
import { entityService } from "./entityService.js";
import { auditService } from "./auditService.js";
import { HttpError } from "../utils/httpError.js";

const LETTER_OPTIONS = new Set(["A", "B", "C", "D", "E"]);

const decodeImage = (imageBase64) => {
  const input = String(imageBase64 || "").trim();
  if (!input) {
    throw new HttpError(400, "Imagem não informada para OCR.");
  }

  if (input.startsWith("data:")) {
    const comma = input.indexOf(",");
    if (comma === -1) {
      throw new HttpError(400, "Formato de imagem base64 inválido.");
    }
    return Buffer.from(input.slice(comma + 1), "base64");
  }

  return Buffer.from(input, "base64");
};

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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
    const tokens = text
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

    for (let i = 0; i < tokens.length - 1; i += 1) {
      const q = Number(tokens[i]);
      const ans = tokens[i + 1];
      if (Number.isInteger(q) && q >= 1 && q <= totalQuestions && LETTER_OPTIONS.has(ans)) {
        map[q] = ans;
      }
    }
  }

  return map;
};

const runOcr = async (imageBuffer) => {
  const worker = await createWorker("por+eng");
  try {
    const result = await worker.recognize(imageBuffer);
    return result?.data?.text || "";
  } finally {
    await worker.terminate();
  }
};

const buildCorrection = ({ avaliacao, aluno, questions, answerMap }) => {
  const respostas = questions.map((question, idx) => {
    const questaoIndex = idx + 1;
    const resposta = answerMap[questaoIndex] || "";
    const gabarito = String(question.gabarito || "").toUpperCase();
    return {
      questao_id: question.id,
      resposta,
      correta: Boolean(resposta) && resposta === gabarito,
    };
  });

  const totalAcertos = respostas.filter((item) => item.correta).length;
  const totalQuestoes = respostas.length;
  const percentual = totalQuestoes > 0 ? Math.round((totalAcertos / totalQuestoes) * 100) : 0;
  const nota = totalQuestoes > 0
    ? (totalAcertos / totalQuestoes) * (Number(avaliacao.total_pontos) || 10)
    : 0;

  return {
    avaliacao_id: avaliacao.id,
    aluno_id: aluno.id,
    turma_id: avaliacao.turma_id,
    respostas,
    nota: Math.round(nota * 100) / 100,
    total_acertos: totalAcertos,
    total_questoes: totalQuestoes,
    percentual_acerto: percentual,
    status: "corrigido",
  };
};

export const correctionService = {
  async correctByOcr({ avaliacaoId, alunoId, imageBase64, recognizedText }, actor) {
    const avaliacao = await entityRepository.getById("avaliacoes", avaliacaoId, actor);
    if (!avaliacao) {
      throw new HttpError(404, "Avaliação não encontrada.");
    }

    const aluno = await entityRepository.getById("alunos", alunoId, actor);
    if (!aluno) {
      throw new HttpError(404, "Aluno não encontrado.");
    }

    if (avaliacao.turma_id && aluno.turma_id && avaliacao.turma_id !== aluno.turma_id) {
      throw new HttpError(400, "Aluno e avaliação pertencem a turmas diferentes.");
    }

    const questionIds = Array.isArray(avaliacao.questoes_ids) ? avaliacao.questoes_ids : [];
    if (questionIds.length === 0) {
      throw new HttpError(400, "A avaliação não possui questões vinculadas.");
    }

    const questions = (
      await Promise.all(
        questionIds.map((id) => entityRepository.getById("questoes", id, actor))
      )
    ).filter(Boolean);

    if (questions.length === 0) {
      throw new HttpError(400, "Nenhuma questão vinculada foi encontrada.");
    }

    let ocrText = String(recognizedText || "").trim();
    if (!ocrText) {
      const imageBuffer = decodeImage(imageBase64);
      ocrText = await runOcr(imageBuffer);
    }

    const answerMap = parseAnswersFromText(ocrText, questions.length);
    if (Object.keys(answerMap).length === 0) {
      throw new HttpError(422, "Não foi possível identificar marcações no OCR.");
    }

    const correctionPayload = buildCorrection({
      avaliacao,
      aluno,
      questions,
      answerMap,
    });

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
      },
    });

    return {
      source: "ocr",
      recognized_text: ocrText.slice(0, 4000),
      respostas_map: answerMap,
      resultado: createdResult,
    };
  },
};
