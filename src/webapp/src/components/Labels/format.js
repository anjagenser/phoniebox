export const PAGE_W = 210;
export const PAGE_H = 297;

export const LABEL_W = 83.82;
export const LABEL_H = 50.8;
export const CORNER_R = 2;

export const COLS = 2;
export const ROWS = 5;
export const SLOTS_PER_SHEET = COLS * ROWS;

// From HERMA's 5028 die-cut template (5028_SV.pdf): 3.3 x 2 inch labels on a 3.5 inch
// column pitch, rows butting, the block centred on A4.
export const COL_GAP = 5.08;
export const ROW_GAP = 0;

export const COL_PITCH = LABEL_W + COL_GAP;
export const ROW_PITCH = LABEL_H + ROW_GAP;

export const MARGIN_X = (PAGE_W - (COLS * LABEL_W + (COLS - 1) * COL_GAP)) / 2;
export const MARGIN_Y = (PAGE_H - ROWS * LABEL_H) / 2;

export const LABEL_ASPECT = LABEL_W / LABEL_H;

export const slotPosition = (within, offsetX = 0, offsetY = 0) => {
  const col = within % COLS;
  const row = Math.floor(within / COLS);
  return {
    x: MARGIN_X + col * COL_PITCH + offsetX,
    y: MARGIN_Y + row * ROW_PITCH + offsetY,
  };
};

export const sheetCount = (count, startOffset = 0) =>
  Math.max(1, Math.ceil((startOffset + count) / SLOTS_PER_SHEET));
