import { jsPDF } from 'jspdf';

import {
  PAGE_W,
  LABEL_W,
  LABEL_H,
  CORNER_R,
  COLS,
  ROWS,
  SLOTS_PER_SHEET,
  slotPosition,
} from './format';

const DPI = 300;
const MM_PER_INCH = 25.4;
const PX_W = Math.round((LABEL_W / MM_PER_INCH) * DPI);
const PX_H = Math.round((LABEL_H / MM_PER_INCH) * DPI);
const PX_PER_MM = DPI / MM_PER_INCH;

// Overprint past the die-cut like HERMA's own generator, so a printer that is a
// millimetre off still leaves no white edge. Must stay below half the column gap.
export const BLEED = 2;
const NO_BLEED = { left: 0, top: 0, right: 0, bottom: 0 };

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load image: ${src}`));
    img.src = src;
  });

export const DEFAULT_IMAGE_SIZE = 100;

// Size zooms the whole image, so shrinking a cropped image reveals what the crop hid
// instead of cropping it again to a smaller box.
// Cover also has to fill the overprint, kept centred on the label so the framing
// matches the preview.
const drawImageFit = (ctx, img, w, h, fit, size, bleed) => {
  const coverW = w + 2 * Math.max(bleed.left, bleed.right);
  const coverH = h + 2 * Math.max(bleed.top, bleed.bottom);
  const base =
    fit === 'contain'
      ? Math.min(w / img.width, h / img.height)
      : Math.max(coverW / img.width, coverH / img.height);
  const scale = (base * size) / 100;
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
};

export const effectiveFit = (label, fit) => label.fit || fit;
export const effectiveSize = (label) => label.size ?? DEFAULT_IMAGE_SIZE;

const fitFont = (ctx, text, maxWidth, startPx, minPx) => {
  let size = startPx;
  ctx.font = `600 ${size}px Arial, Helvetica, sans-serif`;
  while (size > minPx && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `600 ${size}px Arial, Helvetica, sans-serif`;
  }
  return size;
};

const drawCaptionBand = (ctx, text, w, h, bleed) => {
  const bandH = Math.round(h * 0.24);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(-bleed.left, h - bandH, w + bleed.left + bleed.right, bandH + bleed.bottom);
  fitFont(ctx, text, w * 0.92, Math.round(bandH * 0.5), 18);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h - bandH / 2, w * 0.92);
};

const drawCenteredText = (ctx, text, w, h) => {
  const size = Math.round(h * 0.16);
  ctx.font = `600 ${size}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = '#222222';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > w * 0.86 && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);

  const lineH = size * 1.2;
  const startY = h / 2 - ((lines.length - 1) * lineH) / 2;
  lines.slice(0, 4).forEach((l, i) => {
    ctx.fillText(l, w / 2, startY + i * lineH, w * 0.86);
  });
};

// Laid out against the w x h label area at (0, 0); the canvas extends past it by
// `bleed` so only the image and caption band spill into the overprint.
const drawContent = async (ctx, label, w, h, { fit, showCaptions }, bleed) => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-bleed.left, -bleed.top, w + bleed.left + bleed.right, h + bleed.top + bleed.bottom);

  let img = null;
  if (label.image) {
    try {
      img = await loadImage(label.image);
    } catch (e) {
      img = null;
    }
  }

  const caption = (label.caption || '').trim();
  if (img) {
    drawImageFit(ctx, img, w, h, effectiveFit(label, fit), effectiveSize(label), bleed);
    if (showCaptions && caption) drawCaptionBand(ctx, caption, w, h, bleed);
  } else if (caption) {
    drawCenteredText(ctx, caption, w, h);
  }
};

// Which page edge each content edge lands on after rotating clockwise.
const contentBleed = (page, rotation) => {
  switch (rotation) {
    case 90: return { top: page.right, right: page.bottom, bottom: page.left, left: page.top };
    case 180: return { top: page.bottom, right: page.left, bottom: page.top, left: page.right };
    case 270: return { top: page.left, right: page.top, bottom: page.right, left: page.bottom };
    default: return page;
  }
};

const toPx = (bleed) => ({
  left: Math.round(bleed.left * PX_PER_MM),
  top: Math.round(bleed.top * PX_PER_MM),
  right: Math.round(bleed.right * PX_PER_MM),
  bottom: Math.round(bleed.bottom * PX_PER_MM),
});

export const renderLabel = async (label, { fit, showCaptions }, bleedMm = NO_BLEED) => {
  const rotation = (((label.rotation || 0) % 360) + 360) % 360;
  const swap = rotation === 90 || rotation === 270;
  const page = toPx(bleedMm);
  const inner = contentBleed(page, rotation);

  const contentW = swap ? PX_H : PX_W;
  const contentH = swap ? PX_W : PX_H;
  const content = document.createElement('canvas');
  content.width = contentW + inner.left + inner.right;
  content.height = contentH + inner.top + inner.bottom;
  const contentCtx = content.getContext('2d');
  contentCtx.translate(inner.left, inner.top);
  await drawContent(contentCtx, label, contentW, contentH, { fit, showCaptions }, inner);

  if (rotation === 0) return content.toDataURL('image/jpeg', 0.92);

  const canvas = document.createElement('canvas');
  canvas.width = PX_W + page.left + page.right;
  canvas.height = PX_H + page.top + page.bottom;
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(content, -content.width / 2, -content.height / 2);

  return canvas.toDataURL('image/jpeg', 0.92);
};

// Rows butt against each other, so only the outer rows get overprint at top/bottom.
const slotBleed = (within) => {
  const row = Math.floor(within / COLS);
  return {
    left: BLEED,
    right: BLEED,
    top: row === 0 ? BLEED : 0,
    bottom: row === ROWS - 1 ? BLEED : 0,
  };
};

// Without this hint most viewers print with "fit to page", shrinking the sheet
// off the die-cut; HERMA's own PDFs print at 100%.
const newSheetDoc = () => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.viewerPreferences({ PrintScaling: 'None' });
  return doc;
};

export const buildLabelsPdf = async (labels, options = {}) => {
  const {
    fit = 'cover',
    showCaptions = true,
    startOffset = 0,
    offsetX = 0,
    offsetY = 0,
  } = options;

  const doc = newSheetDoc();
  let currentPage = 0;

  for (let i = 0; i < labels.length; i += 1) {
    const slotIndex = startOffset + i;
    const page = Math.floor(slotIndex / SLOTS_PER_SHEET);
    const within = slotIndex % SLOTS_PER_SHEET;

    if (page > currentPage) {
      doc.addPage();
      currentPage = page;
    }

    // eslint-disable-next-line no-await-in-loop
    const bleed = slotBleed(within);
    const dataUrl = await renderLabel(labels[i], { fit, showCaptions }, bleed);
    const { x, y } = slotPosition(within, offsetX, offsetY);
    doc.addImage(dataUrl, 'JPEG', x - bleed.left, y - bleed.top,
      LABEL_W + bleed.left + bleed.right, LABEL_H + bleed.top + bleed.bottom);
  }

  return doc;
};

export const downloadLabelsPdf = async (labels, options = {}) => {
  const doc = await buildLabelsPdf(labels, options);
  doc.save(options.filename || 'phoniebox-labels.pdf');
};

// Outlines only: whatever is off on this page comes from the printer or the print
// dialog's scaling, not from images or per-label settings.
export const downloadTestPagePdf = ({ offsetX = 0, offsetY = 0, rulerText = '' } = {}) => {
  const doc = newSheetDoc();
  doc.setLineWidth(0.2);
  doc.setFontSize(9);
  for (let within = 0; within < SLOTS_PER_SHEET; within += 1) {
    const { x, y } = slotPosition(within, offsetX, offsetY);
    doc.roundedRect(x, y, LABEL_W, LABEL_H, CORNER_R, CORNER_R, 'S');
    doc.text(String(within + 1), x + LABEL_W / 2, y + LABEL_H / 2, { align: 'center', baseline: 'middle' });
  }

  const rulerX = (PAGE_W - 100) / 2;
  const rulerY = 10;
  doc.line(rulerX, rulerY, rulerX + 100, rulerY);
  for (let mm = 0; mm <= 100; mm += 10) {
    const tick = mm % 50 === 0 ? 3 : 1.5;
    doc.line(rulerX + mm, rulerY - tick, rulerX + mm, rulerY);
  }
  doc.text(rulerText, PAGE_W / 2, rulerY + 4, { align: 'center', baseline: 'top' });
  doc.save('phoniebox-label-test-page.pdf');
};
