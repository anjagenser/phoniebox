import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Typography,
} from '@mui/material';

import { renderLabel, effectiveFit, effectiveSize } from './pdf';
import { LABEL_W, LABEL_H } from './format';

const LabelEditor = ({
  label,
  fit,
  showCaptions,
  onChange,
  onReset,
  onClose,
}) => {
  const { t } = useTranslation();
  const [preview, setPreview] = useState(null);

  // Slider drags fire many changes; only the newest render may land.
  useEffect(() => {
    if (!label) return undefined;
    let active = true;
    renderLabel(label, { fit, showCaptions }).then((url) => {
      if (active) setPreview(url);
    });
    return () => { active = false; };
  }, [label, fit, showCaptions]);

  if (!label) return null;

  const hasImage = Boolean(label.image);
  const size = effectiveSize(label);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('labels.edit.title')}</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            width: '100%',
            maxWidth: 260,
            mx: 'auto',
            mb: 2,
            aspectRatio: `${LABEL_W} / ${LABEL_H}`,
            border: '1px dashed rgba(120,120,120,0.55)',
            backgroundColor: '#fff',
          }}
        >
          {preview && (
            <Box
              component="img"
              src={preview}
              alt=""
              sx={{ width: '100%', height: '100%', display: 'block' }}
            />
          )}
        </Box>

        <Typography variant="body2" color={hasImage ? 'text.primary' : 'text.disabled'}>
          {t('labels.edit.size-label', { size })}
        </Typography>
        <Slider
          value={size}
          min={30}
          max={100}
          step={5}
          disabled={!hasImage}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${value}%`}
          onChange={(e, value) => onChange({ size: value })}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControl fullWidth size="small" disabled={!hasImage}>
            <InputLabel id="label-edit-fit">{t('labels.options.fit-label')}</InputLabel>
            <Select
              labelId="label-edit-fit"
              label={t('labels.options.fit-label')}
              value={effectiveFit(label, fit)}
              onChange={(e) => onChange({ fit: e.target.value })}
            >
              <MenuItem value="cover">{t('labels.options.fit.cover')}</MenuItem>
              <MenuItem value="contain">{t('labels.options.fit.contain')}</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel id="label-edit-rotation">{t('labels.options.rotation-label')}</InputLabel>
            <Select
              labelId="label-edit-rotation"
              label={t('labels.options.rotation-label')}
              value={label.rotation || 0}
              onChange={(e) => onChange({ rotation: Number(e.target.value) })}
            >
              {[0, 90, 180, 270].map((deg) => (
                <MenuItem key={deg} value={deg}>{`${deg}°`}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onReset} color="inherit">
          {t('labels.edit.reset')}
        </Button>
        <Button onClick={onClose} variant="contained">
          {t('labels.edit.done')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LabelEditor;
