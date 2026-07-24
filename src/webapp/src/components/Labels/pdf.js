// Client-side PDF generation for the HERMA 5028 label sheet.
//
// Each label is first rendered onto an off-screen canvas at print resolution
// (cover-crop or contain-fit, plus an optional caption band). The canvas is
// then placed onto the A4 page at the exact millimetre position of its slot.
// Doing the image work in canvas keeps cropping, letter-boxing and captions in
// one well-understood place and hands jsPDF a single flat image per label.

import { jsPDF } from 'jspdf';

import {
  LABEL_W,
  LABEL_H,
  SLOTS_PER_SHEET,
  slotPosition,
} from './format';

const DPI = 300;
const MM_PER_INCH = 25.4;
const PX_W = Math.round((LABEL_W / MM_PER_INCH) * DPI); // ~990 px
const PX_H = Math.round((LABEL_H / MM_PER_INCH) * DPI); // ~600 px

// Load an image URL (a /cover-cache path or an uploaded data URL) into an
// HTMLImageElement. cover-cache images are same-origin, so the canvas is not
// tainted and toDataURL works.
const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load image: ${src}`));
    img.src = src;
  });

const drawImageFit = (ctx, img, w, h, fit) => {
  const scale =
    fit === 'contain'
      ? Math.min(w / img.width, h / img.height)
      : Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
};

// Shrink the font until the caption fits on a single line, then draw it.
const fitFont = (ctx, text, maxWidth, startPx, minPx) => {
  let size = startPx;
  ctx.font = `600 ${size}px Arial, Helvetica, sans-serif`;
  while (size > minPx && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `600 ${size}px Arial, Helvetica, sans-serif`;
  }
  return size;
};

const drawCaptionBand = (ctx, text, w, h) => {
  const bandH = Math.round(h * 0.24);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, h - bandH, w, bandH);
  fitFont(ctx, text, w * 0.92, Math.round(bandH * 0.5), 18);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h - bandH / 2, w * 0.92);
};

// Wrap and centre dark text on a blank label (used when there is no cover).
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

// Draw the label content (cover + optional caption) onto a canvas of the given
// size. Used both un-rotated and, for 90/270deg turns, on a portrait canvas
// that is then rotated into the landscape label.
const drawContent = async (ctx, label, w, h, { fit, showCaptions }) => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

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
    drawImageFit(ctx, img, w, h, fit);
    if (showCaptions && caption) drawCaptionBand(ctx, caption, w, h);
  } else if (caption) {
    drawCenteredText(ctx, caption, w, h);
  }
};

// Render one label to a JPEG data URL, honouring label.rotation (0/90/180/270).
// The whole content (image + caption) turns together, so a turned label reads
// correctly when the card is physically rotated.
export const renderLabel = async (label, { fit, showCaptions }) => {
  const canvas = document.createElement('canvas');
  canvas.width = PX_W;
  canvas.height = PX_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PX_W, PX_H);

  const rotation = (((label.rotation || 0) % 360) + 360) % 360;

  if (rotation === 0) {
    await drawContent(ctx, label, PX_W, PX_H, { fit, showCaptions });
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  // Compose the content on its own canvas (portrait for 90/270), then blit it
  // rotated about the centre of the landscape label.
  const swap = rotation === 90 || rotation === 270;
  const cw = swap ? PX_H : PX_W;
  const ch = swap ? PX_W : PX_H;
  const content = document.createElement('canvas');
  content.width = cw;
  content.height = ch;
  await drawContent(content.getContext('2d'), label, cw, ch, { fit, showCaptions });

  ctx.save();
  ctx.translate(PX_W / 2, PX_H / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(content, -cw / 2, -ch / 2);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.92);
};

// Build the PDF document (does not save it). `labels` is an ordered array of
// { image, caption }. Options: fit ('cover'|'contain'), showCaptions,
// startOffset (empty slots on the first sheet), offsetX/offsetY (mm calibration).
export const buildLabelsPdf = async (labels, options = {}) => {
  const {
    fit = 'cover',
    showCaptions = true,
    startOffset = 0,
    offsetX = 0,
    offsetY = 0,
  } = options;

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
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
    const dataUrl = await renderLabel(labels[i], { fit, showCaptions });
    const { x, y } = slotPosition(within, offsetX, offsetY);
    doc.addImage(dataUrl, 'JPEG', x, y, LABEL_W, LABEL_H);
  }

  return doc;
};

// Build the PDF and trigger a browser download.
export const downloadLabelsPdf = async (labels, options = {}) => {
  const doc = await buildLabelsPdf(labels, options);
  doc.save(options.filename || 'phoniebox-labels.pdf');
};
