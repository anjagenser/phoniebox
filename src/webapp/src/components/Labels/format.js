export const PAGE_W = 210;
export const PAGE_H = 297;

export const LABEL_W = 83.8;
export const LABEL_H = 50.8;

export const COLS = 2;
export const ROWS = 5;
export const SLOTS_PER_SHEET = COLS * ROWS;

export const COL_PITCH = LABEL_W;
export const ROW_PITCH = LABEL_H;

export const MARGIN_X = (PAGE_W - COLS * COL_PITCH) / 2;
export const MARGIN_Y = (PAGE_H - ROWS * ROW_PITCH) / 2;

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
