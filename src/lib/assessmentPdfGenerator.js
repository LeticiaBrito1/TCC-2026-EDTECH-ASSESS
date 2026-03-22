import { jsPDF } from "jspdf";
import QRCode from "qrcode";

const PAGE = {
  margin: 14,
  lineHeight: 5,
};

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

const shuffled = (items, random) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const normalizeAlternativas = (alternativas = [], randomAlternatives = false, random = null) => {
  const list = (Array.isArray(alternativas) ? alternativas : [])
    .map((item, index) => ({
      letra: String(item?.letra || String.fromCharCode(65 + index)).toUpperCase(),
      texto: String(item?.texto || "").trim(),
    }))
    .filter((item) => item.texto);

  if (!randomAlternatives || !random) {
    return list;
  }

  return shuffled(list, random).map((item, index) => ({
    letra: String.fromCharCode(65 + index),
    texto: item.texto,
    originalLetra: item.letra,
  }));
};

const buildVersionQuestions = ({
  questions,
  versionSeed,
  shuffleQuestions = false,
  shuffleAlternatives = false,
}) => {
  const random = mulberry32(versionSeed);
  const sourceList = shuffleQuestions ? shuffled(questions, random) : [...questions];

  return sourceList.map((question) => {
    const alternatives = normalizeAlternativas(
      question.alternativas,
      shuffleAlternatives,
      random
    );

    let gabarito = String(question.gabarito || "A").toUpperCase();
    if (shuffleAlternatives) {
      const found = alternatives.find((alt) => alt.originalLetra === gabarito);
      gabarito = found?.letra || alternatives[0]?.letra || "A";
    }

    return {
      ...question,
      alternativas: alternatives,
      gabarito,
    };
  });
};

const versionLabelFromIndex = (index) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < alphabet.length) return alphabet[index];
  return `V${index + 1}`;
};

const drawHeader = async ({
  doc,
  assessment,
  disciplinaNome,
  turmaNome,
  aluno,
  versionLabel,
  qrPayload,
}) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = PAGE.margin;
  let cursorY = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(assessment.titulo || "Avaliação", margin, cursorY);
  cursorY += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Disciplina: ${disciplinaNome || "—"}`, margin, cursorY);
  cursorY += 5;
  doc.text(`Turma: ${turmaNome || "—"}`, margin, cursorY);
  cursorY += 5;
  doc.text(`Aluno: ${aluno?.nome || "NÃO IDENTIFICADO"}`, margin, cursorY);
  cursorY += 5;
  doc.text(`Versão: ${versionLabel}`, margin, cursorY);
  cursorY += 5;
  doc.text(`Data de aplicação: ${assessment.data_aplicacao || "—"}`, margin, cursorY);

  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 140 });
  doc.addImage(qrDataUrl, "PNG", pageWidth - margin - 32, margin, 32, 32);

  return Math.max(cursorY + 4, margin + 36);
};

const drawQuestion = ({ doc, question, index, cursorY }) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - PAGE.margin * 2;
  let y = cursorY;

  const ensureSpace = (neededHeight) => {
    if (y + neededHeight <= pageHeight - PAGE.margin) return;
    doc.addPage();
    y = PAGE.margin;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const enunciado = `${index + 1}. ${String(question.enunciado || "").trim()}`;
  const qLines = doc.splitTextToSize(enunciado, maxWidth);
  ensureSpace(qLines.length * PAGE.lineHeight + 8);
  doc.text(qLines, PAGE.margin, y);
  y += qLines.length * PAGE.lineHeight + 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  (question.alternativas || []).forEach((alt) => {
    const label = `${alt.letra}) ${alt.texto}`;
    const altLines = doc.splitTextToSize(label, maxWidth - 6);
    ensureSpace(altLines.length * PAGE.lineHeight + 2);
    doc.text(altLines, PAGE.margin + 4, y);
    y += altLines.length * PAGE.lineHeight + 1;
  });

  y += 3;
  return y;
};

const drawAnswerKeyPage = ({ doc, assessment, versionLabel, versionQuestions }) => {
  doc.addPage();
  const margin = PAGE.margin;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Gabarito", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${assessment.titulo || "Avaliação"} - Versão ${versionLabel}`, margin, y);
  y += 8;

  const entries = versionQuestions.map((q, idx) => `${idx + 1}: ${q.gabarito || "—"}`);
  const colSize = Math.ceil(entries.length / 3);
  const cols = [entries.slice(0, colSize), entries.slice(colSize, colSize * 2), entries.slice(colSize * 2)];
  const colWidth = 55;

  cols.forEach((col, colIndex) => {
    col.forEach((value, rowIndex) => {
      doc.text(value, margin + colIndex * colWidth, y + rowIndex * 6);
    });
  });
};

export const generateAssessmentPdf = async ({
  assessment,
  questions,
  alunos = [],
  disciplinaNome = "",
  turmaNome = "",
  versionsCount = 1,
  includeAnswerKey = true,
}) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const safeVersions = Math.max(1, Math.min(10, Number(versionsCount) || 1));
  const students = alunos.length > 0 ? alunos : [null];

  let firstPage = true;

  for (let versionIndex = 0; versionIndex < safeVersions; versionIndex += 1) {
    const versionLabel = versionLabelFromIndex(versionIndex);
    const versionSeed = hashSeed(`${assessment.id}:${versionLabel}`);
    const versionQuestions = buildVersionQuestions({
      questions,
      versionSeed,
      shuffleQuestions: Boolean(assessment.embaralhar_questoes),
      shuffleAlternatives: Boolean(assessment.embaralhar_alternativas),
    });

    for (const aluno of students) {
      if (!firstPage) {
        doc.addPage();
      }
      firstPage = false;

      const qrPayload = JSON.stringify({
        avaliacao_id: assessment.id,
        aluno_id: aluno?.id || "",
        versao: versionLabel,
      });

      let y = await drawHeader({
        doc,
        assessment,
        disciplinaNome,
        turmaNome,
        aluno,
        versionLabel,
        qrPayload,
      });

      for (let qIndex = 0; qIndex < versionQuestions.length; qIndex += 1) {
        y = drawQuestion({ doc, question: versionQuestions[qIndex], index: qIndex, cursorY: y });
      }
    }

    if (includeAnswerKey) {
      drawAnswerKeyPage({ doc, assessment, versionLabel, versionQuestions });
    }
  }

  const safeTitle = String(assessment.titulo || "avaliacao")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  const filename = `${safeTitle || "avaliacao"}_versoes.pdf`;
  doc.save(filename);
};
