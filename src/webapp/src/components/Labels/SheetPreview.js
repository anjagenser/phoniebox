import React from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';

import {
  PAGE_W,
  PAGE_H,
  LABEL_W,
  LABEL_H,
  SLOTS_PER_SHEET,
  slotPosition,
  sheetCount,
} from './format';

const pct = (value, total) => `${(value / total) * 100}%`;

// One label placed on the paper: the cover fills the slot (cover/contain), with
// an optional dark caption band. Colours are fixed (this depicts white paper),
// so it reads the same in the app's dark theme.
const FilledSlot = ({ label, fit, showCaptions, onRemove, removeLabel }) => {
  const caption = (label.caption || '').trim();
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#fff',
        backgroundImage: label.image ? `url(${label.image})` : 'none',
        backgroundSize: fit === 'contain' ? 'contain' : 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        overflow: 'hidden',
      }}
    >
      {!label.image && caption && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 0.5,
            textAlign: 'center',
            color: '#222',
            fontSize: 'clamp(7px, 2.4vw, 13px)',
            fontWeight: 600,
            lineHeight: 1.15,
            wordBreak: 'break-word',
          }}
        >
          {caption}
        </Box>
      )}

      {label.image && showCaptions && caption && (
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '24%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 0.5,
            backgroundColor: 'rgba(0,0,0,0.55)',
            color: '#fff',
            fontSize: 'clamp(6px, 2vw, 12px)',
            fontWeight: 600,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {caption}
        </Box>
      )}

      <IconButton
        size="small"
        aria-label={removeLabel}
        title={removeLabel}
        onClick={onRemove}
        sx={{
          position: 'absolute',
          top: 1,
          right: 1,
          padding: '2px',
          backgroundColor: 'rgba(0,0,0,0.5)',
          color: '#fff',
          '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
        }}
      >
        <CloseIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
  );
};

// A single A4 page with its 10 label positions drawn to scale.
const SheetPage = ({
  pageIndex,
  labels,
  startOffset,
  fit,
  showCaptions,
  onRemove,
  usedLabel,
  removeLabel,
}) => (
  <Box
    sx={{
      position: 'relative',
      width: '100%',
      maxWidth: 460,
      mx: 'auto',
      mb: 2,
      aspectRatio: `${PAGE_W} / ${PAGE_H}`,
      backgroundColor: '#f4f4f4',
      border: '1px solid rgba(255,255,255,0.25)',
      boxShadow: 3,
    }}
  >
    {Array.from({ length: SLOTS_PER_SHEET }).map((_, within) => {
      const slot = pageIndex * SLOTS_PER_SHEET + within;
      const { x, y } = slotPosition(within);
      const labelIndex = slot - startOffset;
      const isUsed = slot < startOffset;
      const label = !isUsed ? labels[labelIndex] : undefined;

      return (
        <Box
          key={within}
          sx={{
            position: 'absolute',
            left: pct(x, PAGE_W),
            top: pct(y, PAGE_H),
            width: pct(LABEL_W, PAGE_W),
            height: pct(LABEL_H, PAGE_H),
            border: '1px dashed rgba(120,120,120,0.55)',
            boxSizing: 'border-box',
            backgroundColor: isUsed ? 'rgba(120,120,120,0.18)' : 'transparent',
          }}
        >
          {isUsed && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666',
                fontSize: 'clamp(6px, 1.8vw, 11px)',
                fontStyle: 'italic',
              }}
            >
              {usedLabel}
            </Box>
          )}
          {label && (
            <FilledSlot
              label={label}
              fit={fit}
              showCaptions={showCaptions}
              removeLabel={removeLabel}
              onRemove={() => onRemove(labelIndex)}
            />
          )}
        </Box>
      );
    })}
  </Box>
);

const SheetPreview = ({
  labels = [],
  startOffset = 0,
  fit = 'cover',
  showCaptions = true,
  onRemove,
}) => {
  const { t } = useTranslation();
  const pages = sheetCount(labels.length, startOffset);

  return (
    <Box sx={{ width: '100%', mt: 1 }}>
      {Array.from({ length: pages }).map((_, pageIndex) => (
        <Box key={pageIndex}>
          {pages > 1 && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', textAlign: 'center', mb: 0.5 }}
            >
              {t('labels.preview.sheet', { current: pageIndex + 1, total: pages })}
            </Typography>
          )}
          <SheetPage
            pageIndex={pageIndex}
            labels={labels}
            startOffset={startOffset}
            fit={fit}
            showCaptions={showCaptions}
            onRemove={onRemove}
            usedLabel={t('labels.preview.used')}
            removeLabel={t('labels.preview.remove')}
          />
        </Box>
      ))}
    </Box>
  );
};

export default SheetPreview;
