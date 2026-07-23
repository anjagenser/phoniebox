import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  Typography,
} from '@mui/material';

import CachedIcon from '@mui/icons-material/Cached';

import request from '../../utils/request';
import { emit } from '../../context/toast/events';

// Maintenance action: rescan the local music library so newly added, renamed or
// moved files are indexed by the player backend.
const SettingsLibraryScan = () => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleScan = async () => {
    setBusy(true);
    const { error } = await request('rescanLibrary');
    setBusy(false);
    if (!error) {
      emit('success', t('settings.libraryscan.done'));
    }
  };

  return (
    <Card>
      <CardHeader title={t('settings.libraryscan.title')} />
      <Divider />
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('settings.libraryscan.description')}
        </Typography>
        <Button
          variant="outlined"
          startIcon={busy ? <CircularProgress size={16} /> : <CachedIcon />}
          onClick={handleScan}
          disabled={busy}
        >
          {t('settings.libraryscan.scan')}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SettingsLibraryScan;
