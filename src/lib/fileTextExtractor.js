import * as XLSX from "xlsx";

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
  const { getDocument, GlobalWorkerOptions, version } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
  const buffer = await readAsArrayBuffer(file);
  const pdf = await getDocument({ data: buffer, useSystemFonts: true }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return pages.join("\n");
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
    // Extract all <a:t> text nodes from slide XML
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
  ".txt,.md,.csv,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx";

export const ACCEPTED_FILE_LABEL = "PDF, Word, PowerPoint, Excel, TXT, MD, CSV";

export async function extractTextFromFile(file) {
  const name = file.name.toLowerCase();

  if (/\.(txt|md|csv)$/i.test(name)) {
    return readAsText(file);
  }
  if (/\.pdf$/i.test(name)) {
    return extractPdf(file);
  }
  if (/\.docx?$/i.test(name)) {
    return extractDocx(file);
  }
  if (/\.pptx?$/i.test(name)) {
    return extractPptx(file);
  }
  if (/\.xlsx?$/i.test(name)) {
    return extractXlsx(file);
  }

  // Fallback: attempt plain text read
  return readAsText(file);
}
