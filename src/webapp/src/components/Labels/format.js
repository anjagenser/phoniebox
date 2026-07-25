export const PAGE_W = 210;
export const PAGE_H = 297;

export const LABEL_W = 83.8;
export const LABEL_H = 50.8;
export const CORNER_R = 2;

export const COLS = 2;
export const ROWS = 5;
export const SLOTS_PER_SHEET = COLS * ROWS;

// HERMA 5028 die-cut: 5.4 mm gutter between the columns, rows butt against each other
export const COL_GAP = 5.4;
export const ROW_GAP = 0;

export const COL_PITCH = LABEL_W + COL_GAP;
export const ROW_PITCH = LABEL_H + ROW_GAP;

export const MARGIN_X = 18.6;
export const MARGIN_Y = 22;

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
