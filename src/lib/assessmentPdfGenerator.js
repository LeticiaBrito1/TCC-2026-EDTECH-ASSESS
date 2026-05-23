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

  if (!randomAlternatives || !random) return list;

  return shuffled(list, random).map((item, index) => ({
    letra: String.fromCharCode(65 + index),
    texto: item.texto,
    originalLetra: item.letra,
  }));
};

const buildVersionQuestions = ({ questions, versionSeed, shuffleQuestions = false, shuffleAlternatives = false }) => {
  const random = mulberry32(versionSeed);
  const sourceList = shuffleQuestions ? shuffled(questions, random) : [...questions];

  return sourceList.map((question) => {
    const alternatives = normalizeAlternativas(question.alternativas, shuffleAlternatives, random);
    let gabarito = String(question.gabarito || "A").toUpperCase();
    if (shuffleAlternatives) {
      const found = alternatives.find((alt) => alt.originalLetra === gabarito);
      gabarito = found?.letra || alternatives[0]?.letra || "A";
    }
    return { ...question, alternativas: alternatives, gabarito };
  });
};

const versionLabelFromIndex = (index) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < alphabet.length) return alphabet[index];
  return `V${index + 1}`;
};

const drawCoverPage = async ({ doc, assessment, disciplinaNome, turmaNome, aluno, versionLabel, qrPayload, versionQuestions }) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PAGE.margin;
  let y = margin;

  // Registration marks for OMR (5x5mm black squares, 3mm from each corner)
  const regSize = 5;
  const regInset = 3;
  doc.setFillColor(0, 0, 0);
  doc.rect(regInset, regInset, regSize, regSize, "F");
  doc.rect(pageWidth - regInset - regSize, regInset, regSize, regSize, "F");
  doc.rect(regInset, pageHeight - regInset - regSize, regSize, regSize, "F");
  doc.rect(pageWidth - regInset - regSize, pageHeight - regInset - regSize, regSize, regSize, "F");
  doc.setFillColor(0);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(assessment.titulo || "Avaliação", margin, y);
  y += 9;

  // Info block
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const infoLines = [
    ["Disciplina:", disciplinaNome || "—"],
    ["Turma:", turmaNome || "—"],
    ["Aluno:", aluno?.nome || "____________________________________"],
    ["Versão:", versionLabel],
    ["Data de aplicação:", assessment.data_aplicacao || "____/____/________"],
  ];

  infoLines.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 35, y);
    y += 6;
  });

  // QR Code (large, right side)
  const qrSize = 40;
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 300 });
  doc.addImage(qrDataUrl, "PNG", pageWidth - margin - qrSize, margin, qrSize, qrSize);

  // QR payload text below QR image (for manual entry)
  doc.setFontSize(5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text("Código (correção manual):", pageWidth - margin - qrSize, margin + qrSize + 3.5);
  doc.setFontSize(4.8);
  const qrTextLines = doc.splitTextToSize(qrPayload, qrSize);
  doc.text(qrTextLines, pageWidth - margin - qrSize, margin + qrSize + 7);
  doc.setTextColor(0);

  y += 6;

  // Separator line
  doc.setDrawColor(180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Answer grid for student
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Folha de Respostas", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const letters = versionQuestions.length > 0
    ? [...new Set(versionQuestions.flatMap(q => (q.alternativas || []).map(a => a.letra)))].sort()
    : ["A", "B", "C", "D", "E"];

  const circleR = 3.5;
  const circleSpacing = 9;
  const rowHeight = 10;

  versionQuestions.forEach((q, idx) => {
    const qy = y + idx * rowHeight;

    if (qy + rowHeight > doc.internal.pageSize.getHeight() - margin) return;

    doc.setFont("helvetica", "bold");
    doc.text(`${idx + 1}.`, margin, qy);

    const alts = q.alternativas?.length > 0 ? q.alternativas.map(a => a.letra) : letters;
    alts.forEach((letra, li) => {
      const cx = margin + 10 + li * circleSpacing;
      doc.setDrawColor(80);
      doc.circle(cx, qy - 2, circleR);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(letra, cx - 1.5, qy - 0.5);
      doc.setFontSize(9);
    });
  });

  return y + versionQuestions.length * rowHeight + 4;
};

const stripLeadingNumber = (text) =>
  String(text || "")
    .trim()
    .replace(/^(n[uú]mero|quest[aã]o)\s+\d+\s*[-.):]?\s*/i, "")
    .replace(/^\d+\s*[.)\-]\s*/, "");

const drawQuestion = ({ doc, question, index, cursorY, peso }) => {
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
  const pesoStr = peso != null ? ` (${Number(peso)} pt${Number(peso) !== 1 ? "s" : ""})` : "";
  const enunciado = `${index + 1}.${pesoStr} ${stripLeadingNumber(question.enunciado)}`;
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
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PAGE.margin;

  const initFirstPage = () => {
    doc.addPage();
    doc.setFillColor(230, 230, 230);
    doc.rect(0, 0, pageWidth, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text("GABARITO DO PROFESSOR", margin, margin + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`${assessment.titulo || "Avaliação"} — Versão ${versionLabel}`, margin, margin + 12);
    doc.text("USO EXCLUSIVO DO PROFESSOR — NÃO DISTRIBUIR", pageWidth - margin, margin + 12, { align: "right" });
    doc.setTextColor(0, 0, 0);
    const startY = 30;
    doc.setDrawColor(150);
    doc.line(margin, startY, pageWidth - margin, startY);
    return startY + 8;
  };

  const initContinuationPage = () => {
    doc.addPage();
    const contY = margin + 6;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Gabarito — ${assessment.titulo || "Avaliação"} — Versão ${versionLabel} (continuação)`,
      margin,
      contY
    );
    doc.setTextColor(0, 0, 0);
    return contY + 8;
  };

  let y = initFirstPage();
  let isFirstPage = true;

  const letters = ["A", "B", "C", "D", "E"];
  const circleR = 3.5;
  const circleSpacing = 10;
  const rowHeight = 12;

  for (let idx = 0; idx < versionQuestions.length; idx += 1) {
    if (y + rowHeight > pageHeight - margin - 20) {
      isFirstPage = false;
      y = initContinuationPage();
    }

    const q = versionQuestions[idx];
    const gabarito = String(q.gabarito || "").toUpperCase();
    const alts = q.alternativas?.length > 0 ? q.alternativas.map((a) => a.letra) : letters;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(`${idx + 1}.`, margin, y);

    alts.forEach((letra, li) => {
      const cx = margin + 12 + li * circleSpacing;
      const cy = y - 3;
      const isCorrect = letra === gabarito;

      if (isCorrect) {
        doc.setFillColor(30, 30, 30);
        doc.circle(cx, cy, circleR, "F");
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setDrawColor(150);
        doc.circle(cx, cy, circleR, "S");
        doc.setTextColor(160, 160, 160);
      }

      doc.setFont("helvetica", isCorrect ? "bold" : "normal");
      doc.setFontSize(7);
      doc.text(letra, cx - 1.5, cy + 0.5);
    });

    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
    y += rowHeight;
  }

  // Resumo em texto
  y += 4;
  if (y + 18 > pageHeight - margin) {
    y = initContinuationPage();
  }
  doc.setDrawColor(180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text("Respostas:", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const summaryEntries = versionQuestions.map((q, i) => `${i + 1}:${q.gabarito || "—"}`);
  const summaryLines = doc.splitTextToSize(summaryEntries.join("  "), pageWidth - margin * 2);
  doc.text(summaryLines, margin, y);
  doc.setTextColor(0, 0, 0);
};

export const generateAssessmentPdf = async ({
  assessment,
  questions,
  alunos = [],
  disciplinaNome = "",
  turmaNome = "",
  versionsCount = 1,
  includeAnswerKey = false,
}) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const safeVersions = Math.max(1, Math.min(10, Number(versionsCount) || 1));
  const students = alunos.length > 0 ? alunos : [null];
  const questoesPesos = assessment.questoes_pesos || {};

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
      if (!firstPage) doc.addPage();
      firstPage = false;

      const qrPayload = JSON.stringify({
        avaliacao_id: assessment.id,
        aluno_id: aluno?.id || "",
        versao: versionLabel,
      });

      // Cover page (with QR code + answer grid)
      await drawCoverPage({
        doc,
        assessment,
        disciplinaNome,
        turmaNome,
        aluno,
        versionLabel,
        qrPayload,
        versionQuestions,
      });

      // Questions page(s)
      doc.addPage();
      let y = PAGE.margin;

      // Compact header on question pages
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`${assessment.titulo || "Avaliação"} — Versão ${versionLabel} — ${aluno?.nome || ""}`, PAGE.margin, y);
      y += 7;
      doc.setDrawColor(200);
      doc.line(PAGE.margin, y, doc.internal.pageSize.getWidth() - PAGE.margin, y);
      y += 5;

      for (let qIndex = 0; qIndex < versionQuestions.length; qIndex += 1) {
        const q = versionQuestions[qIndex];
        const peso = questoesPesos[q.id] != null ? questoesPesos[q.id] : null;
        y = drawQuestion({ doc, question: q, index: qIndex, cursorY: y, peso });
      }
    }

    if (includeAnswerKey) {
      drawAnswerKeyPage({ doc, assessment, versionLabel, versionQuestions });
    }
  }

  const safeTitle = String(assessment.titulo || "avaliacao")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  doc.save(`${safeTitle || "avaliacao"}_versoes.pdf`);
};
