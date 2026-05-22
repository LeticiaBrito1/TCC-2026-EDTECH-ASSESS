import { Jimp } from "jimp";

// ─── PDF layout constants (must match assessmentPdfGenerator.js) ─────────────
const PDF_W = 210; // A4 width mm
const PDF_H = 297; // A4 height mm

// Registration mark squares drawn at page corners
const REG_SIZE = 5;   // mm
const REG_INSET = 3;  // mm from page edge

// Center of each registration mark in PDF mm coords: [TL, TR, BL, BR]
const REG_PDF = [
  { x: REG_INSET + REG_SIZE / 2,          y: REG_INSET + REG_SIZE / 2 },           // TL
  { x: PDF_W - REG_INSET - REG_SIZE / 2,  y: REG_INSET + REG_SIZE / 2 },           // TR
  { x: REG_INSET + REG_SIZE / 2,          y: PDF_H - REG_INSET - REG_SIZE / 2 },   // BL
  { x: PDF_W - REG_INSET - REG_SIZE / 2,  y: PDF_H - REG_INSET - REG_SIZE / 2 },   // BR
];

// Answer grid layout
const GRID_MARGIN = 14;  // mm (PAGE.margin)
const GRID_COLS = 3;
const GRID_COL_W = (PDF_W - GRID_MARGIN * 2) / GRID_COLS; // ~60.67 mm
const GRID_ROW_H = 12;   // mm
const GRID_Y = 74;       // mm — y of first question row (traced from drawCoverPage)
const CIRC_OFFSET = 8;   // mm from col-left to first circle center
const CIRC_SPACING = 9;  // mm between circle centers
const CIRC_RADIUS = 3.5; // mm
const LETTERS = ["A", "B", "C", "D", "E"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function brightness(rgba) {
  return (rgba.r + rgba.g + rgba.b) / 3;
}

// Return centroid of dark pixels in a rectangular region of the image
function darkCentroid(image, rx, ry, rw, rh, threshold = 100) {
  const W = image.bitmap.width;
  const H = image.bitmap.height;
  let sx = 0, sy = 0, n = 0;

  for (let y = Math.max(0, ry); y < Math.min(H, ry + rh); y++) {
    for (let x = Math.max(0, rx); x < Math.min(W, rx + rw); x++) {
      const px = Jimp.intToRGBA(image.getPixelColor(x, y));
      if (brightness(px) < threshold) { sx += x; sy += y; n++; }
    }
  }
  return n >= 8 ? { x: sx / n, y: sy / n } : null;
}

// Bilinear map: PDF mm (u,v) → image pixel (x,y)
// Uses 4 control points: image corners matched to REG_PDF corners
function makeTransform(imgCorners) {
  const [tl, tr, bl, br] = imgCorners;
  const [ptl, , pbl] = REG_PDF;
  const pdfSpanX = PDF_W - 2 * ptl.x;
  const pdfSpanY = PDF_H - 2 * ptl.y;

  return function pdfToImg(u, v) {
    const s = (u - ptl.x) / pdfSpanX;
    const t = (v - ptl.y) / pdfSpanY;
    return {
      x: Math.round((1-s)*(1-t)*tl.x + s*(1-t)*tr.x + (1-s)*t*bl.x + s*t*br.x),
      y: Math.round((1-s)*(1-t)*tl.y + s*(1-t)*tr.y + (1-s)*t*bl.y + s*t*br.y),
    };
  };
}

// Fraction of dark pixels inside a circle of radius r centred at (cx,cy)
function circleFill(image, cx, cy, r) {
  const W = image.bitmap.width;
  const H = image.bitmap.height;
  let dark = 0, total = 0;

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx*dx + dy*dy > r*r) continue;
      const px = cx + dx, py = cy + dy;
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const rgba = Jimp.intToRGBA(image.getPixelColor(px, py));
      if (brightness(rgba) < 128) dark++;
      total++;
    }
  }
  return total > 0 ? dark / total : 0;
}

// PDF coords of the circle centre for question qIdx, letter lIdx
function circlePdf(qIdx, lIdx) {
  const col = qIdx % GRID_COLS;
  const row = Math.floor(qIdx / GRID_COLS);
  return {
    x: GRID_MARGIN + col * GRID_COL_W + CIRC_OFFSET + lIdx * CIRC_SPACING,
    y: GRID_Y + row * GRID_ROW_H - 2,
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function detectAnswersOMR(imageBuffer, questionCount) {
  let image;
  try {
    image = await Jimp.fromBuffer(imageBuffer);
  } catch (err) {
    throw new Error("Falha ao carregar imagem para OMR: " + err.message);
  }

  // Greyscale + enhance contrast
  image.greyscale().normalize();

  const W = image.bitmap.width;
  const H = image.bitmap.height;

  // Search 12% of each dimension in each corner for registration marks
  const sw = Math.round(W * 0.12);
  const sh = Math.round(H * 0.12);

  const corners = [
    darkCentroid(image, 0,      0,      sw, sh), // TL
    darkCentroid(image, W - sw, 0,      sw, sh), // TR
    darkCentroid(image, 0,      H - sh, sw, sh), // BL
    darkCentroid(image, W - sw, H - sh, sw, sh), // BR
  ];

  if (corners.some(c => !c)) {
    throw new Error(
      "Marcas de registro não encontradas nos cantos da folha. " +
      "Certifique-se de que os quadrados pretos nos quatro cantos estejam visíveis."
    );
  }

  const toImg = makeTransform(corners);

  // Estimate mm→px scale for circle sampling radius
  const scaleX = (corners[1].x - corners[0].x) / (REG_PDF[1].x - REG_PDF[0].x);
  const scaleY = (corners[2].y - corners[0].y) / (REG_PDF[2].y - REG_PDF[0].y);
  const scale = (scaleX + scaleY) / 2;
  const rPx = Math.max(3, Math.round(CIRC_RADIUS * scale * 0.75));

  const MIN_FILL = 0.15; // ≥15% dark pixels → marked

  const answerMap = {};

  for (let qIdx = 0; qIdx < questionCount; qIdx++) {
    let bestFill = MIN_FILL;
    let bestLetter = null;

    for (let lIdx = 0; lIdx < LETTERS.length; lIdx++) {
      const pdf = circlePdf(qIdx, lIdx);
      const img = toImg(pdf.x, pdf.y);
      const fill = circleFill(image, img.x, img.y, rPx);

      if (fill > bestFill) {
        bestFill = fill;
        bestLetter = LETTERS[lIdx];
      }
    }

    if (bestLetter) answerMap[qIdx + 1] = bestLetter;
  }

  return answerMap;
}
