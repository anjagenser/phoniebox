import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';

import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

import Header from '../Header';
import CardPicker from './CardPicker';
import SheetPreview from './SheetPreview';
import { downloadLabelsPdf } from './pdf';
import { LABEL_W, LABEL_H, SLOTS_PER_SHEET } from './format';
import { emit } from '../../context/toast/events';

const Labels = () => {
  const { t } = useTranslation();

  const [labels, setLabels] = useState([]);
  const [fit, setFit] = useState('cover');
  const [showCaptions, setShowCaptions] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [startOffset, setStartOffset] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [generating, setGenerating] = useState(false);

  const counts = useMemo(() => {
    const acc = {};
    labels.forEach(({ cardId }) => {
      if (cardId) acc[cardId] = (acc[cardId] || 0) + 1;
    });
    return acc;
  }, [labels]);

  const addCard = (labelData) =>
    setLabels((prev) => [...prev, { uid: uuidv4(), rotation, ...labelData }]);

  const addImages = (images) =>
    setLabels((prev) => [
      ...prev,
      ...images.map((image) => ({ uid: uuidv4(), rotation, ...image })),
    ]);

  const removeLabel = (index) =>
    setLabels((prev) => prev.filter((_, i) => i !== index));

  // Turn a single label a further 90 degrees clockwise.
  const rotateLabel = (index) =>
    setLabels((prev) => prev.map((label, i) => (
      i === index ? { ...label, rotation: ((label.rotation || 0) + 90) % 360 } : label
    )));

  // The Rotation control sets the default for new labels and re-applies to all
  // existing ones, so "turn the labels by 90 degrees" is a single action.
  const changeRotation = (value) => {
    setRotation(value);
    setLabels((prev) => prev.map((label) => ({ ...label, rotation: value })));
  };

  const clearAll = () => setLabels([]);

  const download = async () => {
    if (!labels.length) return;
    setGenerating(true);
    try {
      await downloadLabelsPdf(labels, {
        fit,
        showCaptions,
        startOffset,
        offsetX,
        offsetY,
      });
    } catch (e) {
      emit('error', `${t('labels.pdf-error')}: ${e?.message || e}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Grid container id="labels" sx={{ padding: '10px' }}>
      <Header title={t('labels.title')} />

      <Grid item xs={12} sx={{ px: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t('labels.format-info', {
            width: LABEL_W,
            height: LABEL_H,
            perSheet: SLOTS_PER_SHEET,
          })}
        </Typography>

        {/* Options */}
        <Grid container spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Grid item xs={12}>
            <FormControlLabel
              control={(
                <Switch
                  checked={showCaptions}
                  onChange={(e) => setShowCaptions(e.target.checked)}
                />
              )}
              label={t('labels.options.captions')}
            />
          </Grid>
          <Grid item xs={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="labels-rotation">{t('labels.options.rotation-label')}</InputLabel>
              <Select
                labelId="labels-rotation"
                label={t('labels.options.rotation-label')}
                value={rotation}
                onChange={(e) => changeRotation(Number(e.target.value))}
              >
                {[0, 90, 180, 270].map((deg) => (
                  <MenuItem key={deg} value={deg}>{`${deg}°`}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="labels-fit">{t('labels.options.fit-label')}</InputLabel>
              <Select
                labelId="labels-fit"
                label={t('labels.options.fit-label')}
                value={fit}
                onChange={(e) => setFit(e.target.value)}
              >
                <MenuItem value="cover">{t('labels.options.fit.cover')}</MenuItem>
                <MenuItem value="contain">{t('labels.options.fit.contain')}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="labels-start">{t('labels.options.start-label')}</InputLabel>
              <Select
                labelId="labels-start"
                label={t('labels.options.start-label')}
                value={startOffset}
                onChange={(e) => setStartOffset(Number(e.target.value))}
              >
                {Array.from({ length: SLOTS_PER_SHEET }).map((_, i) => (
                  <MenuItem key={i} value={i}>{i}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Accordion
          disableGutters
          sx={{ mb: 1, backgroundColor: 'transparent', boxShadow: 'none', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0 }}>
            <Typography variant="body2" color="text.secondary">
              {t('labels.calibration.title')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {t('labels.calibration.description')}
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ step: 0.5 }}
                  label={t('labels.calibration.offset-x')}
                  value={offsetX}
                  onChange={(e) => setOffsetX(Number(e.target.value) || 0)}
                  InputProps={{ endAdornment: <InputAdornment position="end">mm</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ step: 0.5 }}
                  label={t('labels.calibration.offset-y')}
                  value={offsetY}
                  onChange={(e) => setOffsetY(Number(e.target.value) || 0)}
                  InputProps={{ endAdornment: <InputAdornment position="end">mm</InputAdornment> }}
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          <Button
            variant="contained"
            startIcon={<PictureAsPdfIcon />}
            disabled={!labels.length || generating}
            onClick={download}
          >
            {generating ? t('labels.generating') : t('labels.download')}
          </Button>
          <Button
            variant="text"
            color="inherit"
            startIcon={<DeleteSweepIcon />}
            disabled={!labels.length}
            onClick={clearAll}
          >
            {t('labels.clear')}
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
            {t('labels.count', { count: labels.length })}
          </Typography>
        </Box>

        <SheetPreview
          labels={labels}
          startOffset={startOffset}
          fit={fit}
          showCaptions={showCaptions}
          onRemove={removeLabel}
          onRotate={rotateLabel}
        />

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" sx={{ mb: 1 }}>
          {t('labels.add-title')}
        </Typography>
        <CardPicker
          counts={counts}
          onAddCard={addCard}
          onAddImages={addImages}
        />
      </Grid>
    </Grid>
  );
};

export default Labels;
