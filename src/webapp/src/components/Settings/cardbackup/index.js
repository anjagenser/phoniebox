import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  Typography,
} from '@mui/material';

import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';

import request from '../../../utils/request';
import { emit } from '../../../context/toast/events';

const SettingsCardBackup = () => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const [busy, setBusy] = useState(false);
  const [merge, setMerge] = useState(false);
  const [pending, setPending] = useState(null); // { cards, count }

  const handleExport = async () => {
    setBusy(true);
    const { result, error } = await request('exportCards');
    setBusy(false);
    if (error || !result) return;

    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `phoniebox-cards-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleFileSelected = async (event) => {
    const file = event.target.files && event.target.files[0];
    // Reset so selecting the same file again re-triggers onChange
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const cards = JSON.parse(text);
      if (!cards || typeof cards !== 'object' || Array.isArray(cards)) {
        throw new Error('not an object');
      }
      setPending({ cards, count: Object.keys(cards).length });
    } catch (e) {
      emit('error', t('settings.cardbackup.invalid-file'));
    }
  };

  const handleConfirmImport = async () => {
    if (!pending) return;
    setBusy(true);
    const { error } = await request('importCards', { cards: pending.cards, merge });
    setBusy(false);
    setPending(null);
    if (!error) {
      emit('success', t('settings.cardbackup.imported', { count: pending.count }));
    }
  };

  return (
    <Card>
      <CardHeader
        title={t('settings.cardbackup.title')}
        action={busy ? <CircularProgress size={20} sx={{ m: 1 }} /> : null}
      />
      <Divider />
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('settings.cardbackup.description')}
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={busy}
          >
            {t('settings.cardbackup.export')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            disabled={busy}
          >
            {t('settings.cardbackup.import')}
          </Button>
          <FormControlLabel
            control={
              <Checkbox
                checked={merge}
                onChange={(event) => setMerge(event.target.checked)}
              />
            }
            label={t('settings.cardbackup.merge')}
          />
        </Box>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleFileSelected}
        />
      </CardContent>

      <Dialog open={Boolean(pending)} onClose={() => setPending(null)}>
        <DialogTitle>{t('settings.cardbackup.confirm-title')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {merge
              ? t('settings.cardbackup.confirm-merge', { count: pending?.count })
              : t('settings.cardbackup.confirm-replace', { count: pending?.count })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)} color="primary" autoFocus>
            {t('general.buttons.cancel')}
          </Button>
          <Button onClick={handleConfirmImport} color="secondary">
            {t('settings.cardbackup.import')}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default SettingsCardBackup;
