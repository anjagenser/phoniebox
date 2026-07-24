// Geometry of the HERMA 5028 label sheet and helpers to place labels onto it.
//
// HERMA 5028: A4 sheet with 10 labels (2 columns x 5 rows), each label
// 83.8 x 50.8 mm, arranged centred with no gaps between labels. See
// https://www.herma.ch/.../produkt/etiketten-premium-a4-weiss-838x508-mm-...
//
// All values are millimetres. The sheet is centred, so the outer margins are
// derived from the page size; a per-print calibration offset (offsetX/offsetY)
// can be added to nudge every label if a particular printer is off-register.

export const PAGE_W = 210; // A4 width (mm)
export const PAGE_H = 297; // A4 height (mm)

export const LABEL_W = 83.8;
export const LABEL_H = 50.8;

export const COLS = 2;
export const ROWS = 5;
export const SLOTS_PER_SHEET = COLS * ROWS;

// No gaps between labels; pitch equals the label size.
export const COL_PITCH = LABEL_W;
export const ROW_PITCH = LABEL_H;

// Centre the block of labels on the page.
export const MARGIN_X = (PAGE_W - COLS * COL_PITCH) / 2; // 21.2 mm
export const MARGIN_Y = (PAGE_H - ROWS * ROW_PITCH) / 2; // 21.5 mm

// Label aspect ratio (landscape), used by the on-screen preview.
export const LABEL_ASPECT = LABEL_W / LABEL_H;

// Position (top-left corner, mm) of the label sitting in slot `within`
// (0..9) of a sheet. `offsetX`/`offsetY` shift every position for printer
// calibration.
export const slotPosition = (within, offsetX = 0, offsetY = 0) => {
  const col = within % COLS;
  const row = Math.floor(within / COLS);
  return {
    x: MARGIN_X + col * COL_PITCH + offsetX,
    y: MARGIN_Y + row * ROW_PITCH + offsetY,
  };
};

// How many A4 sheets are needed for `count` labels when the first
// `startOffset` slots of the first sheet are left empty (already used).
export const sheetCount = (count, startOffset = 0) =>
  Math.max(1, Math.ceil((startOffset + count) / SLOTS_PER_SHEET));
