import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import Rotate90DegreesCwIcon from '@mui/icons-material/Rotate90DegreesCw';

import { renderLabel } from './pdf';
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

const thumbKey = (label, fit, showCaptions) =>
  `${fit}|${showCaptions ? 1 : 0}|${label.rotation || 0}|${label.caption || ''}|${label.image || ''}`;

const FilledSlot = ({ thumb, onRemove, onRotate, removeLabel, rotateLabel }) => (
  <Box sx={{ position: 'absolute', inset: 0, backgroundColor: '#fff', overflow: 'hidden' }}>
    {thumb && (
      <Box
        component="img"
        src={thumb}
        alt=""
        sx={{ width: '100%', height: '100%', display: 'block' }}
      />
    )}
    <IconButton
      size="small"
      aria-label={rotateLabel}
      title={rotateLabel}
      onClick={onRotate}
      sx={{
        position: 'absolute',
        top: 1,
        left: 1,
        padding: '2px',
        backgroundColor: 'rgba(0,0,0,0.5)',
        color: '#fff',
        '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
      }}
    >
      <Rotate90DegreesCwIcon sx={{ fontSize: 14 }} />
    </IconButton>
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

const SheetPage = ({
  pageIndex,
  labels,
  thumbs,
  startOffset,
  onRemove,
  onRotate,
  usedLabel,
  removeLabel,
  rotateLabel,
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
              thumb={thumbs[label.uid]}
              removeLabel={removeLabel}
              rotateLabel={rotateLabel}
              onRemove={() => onRemove(labelIndex)}
              onRotate={() => onRotate(labelIndex)}
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
  onRotate,
}) => {
  const { t } = useTranslation();
  const pages = sheetCount(labels.length, startOffset);

  const [thumbs, setThumbs] = useState({});
  const cache = useRef(new Map());

  useEffect(() => {
    let active = true;
    (async () => {
      const next = {};
      for (let i = 0; i < labels.length; i += 1) {
        const label = labels[i];
        const key = thumbKey(label, fit, showCaptions);
        let url = cache.current.get(key);
        if (!url) {
          // eslint-disable-next-line no-await-in-loop
          url = await renderLabel(label, { fit, showCaptions });
          cache.current.set(key, url);
        }
        next[label.uid] = url;
      }
      if (active) setThumbs(next);
    })();
    return () => { active = false; };
  }, [labels, fit, showCaptions]);

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
            thumbs={thumbs}
            startOffset={startOffset}
            onRemove={onRemove}
            onRotate={onRotate}
            usedLabel={t('labels.preview.used')}
            removeLabel={t('labels.preview.remove')}
            rotateLabel={t('labels.preview.rotate')}
          />
        </Box>
      ))}
    </Box>
  );
};

export default SheetPreview;
