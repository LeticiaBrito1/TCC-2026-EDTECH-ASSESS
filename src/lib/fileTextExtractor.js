import * as XLSX from "xlsx";
import { containsAdultContent, containsProfanity } from "./profanityFilter";

const readAsArrayBuffer = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });

const readAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsText(file, "UTF-8");
  });

async function extractPdf(file) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).href;

  const buffer = await readAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: buffer, useSystemFonts: true }).promise;
  const pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lineMap = {};
    for (const item of content.items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!lineMap[y]) lineMap[y] = [];
      lineMap[y].push(item.str);
    }
    const sortedLines = Object.keys(lineMap)
      .sort((a, b) => Number(b) - Number(a))
      .map((y) => lineMap[y].join("").trim())
      .filter(Boolean);
    pageTexts.push(sortedLines.join("\n"));
  }
  return pageTexts.join("\n");
}

async function extractDocx(file) {
  const mammoth = (await import("mammoth")).default;
  const buffer = await readAsArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

async function extractPptx(file) {
  const JSZip = (await import("jszip")).default;
  const buffer = await readAsArrayBuffer(file);
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort();
  const texts = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async("text");
    const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
    const slideText = matches.map((m) => m.replace(/<[^>]+>/g, "")).join(" ");
    if (slideText.trim()) texts.push(slideText.trim());
  }
  return texts.join("\n");
}

async function extractXlsx(file) {
  const buffer = await readAsArrayBuffer(file);
  const wb = XLSX.read(buffer, { type: "array" });
  return wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    return `[${name}]\n${XLSX.utils.sheet_to_csv(sheet)}`;
  }).join("\n\n");
}

export const ACCEPTED_FILE_TYPES =
  ".txt,.md,.csv,.pdf,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx";

export const ACCEPTED_FILE_LABEL = "PDF, Word, PowerPoint, Excel, TXT, MD, CSV";

export async function extractTextFromFile(file) {
  const name = file.name.toLowerCase();
  let text = "";

  if (/\.(txt|md|csv)$/i.test(name)) text = await readAsText(file);
  else if (/\.pdf$/i.test(name)) text = await extractPdf(file);
  else if (/\.docx?$/i.test(name)) text = await extractDocx(file);
  else if (/\.pptx?$/i.test(name)) text = await extractPptx(file);
  else if (/\.xlsx?$/i.test(name)) text = await extractXlsx(file);
  else text = await readAsText(file);

  // Moderação de conteúdo
  if (containsAdultContent(text) || containsProfanity(text)) {
    throw new Error("O arquivo contém conteúdo inapropriado e não pode ser utilizado.");
  }

  return text;
}
