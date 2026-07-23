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

import RefreshIcon from '@mui/icons-material/Refresh';

import request from '../../utils/request';
import { emit } from '../../context/toast/events';

// Maintenance action: clear the cached cover art so newly added covers
// (embedded tags or a cover.jpg placed in a folder) are picked up again.
const SettingsCoverArt = () => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleFlush = async () => {
    setBusy(true);
    const { error } = await request('flushCoverArt');
    setBusy(false);
    if (!error) {
      emit('success', t('settings.coverart.flushed'));
    }
  };

  return (
    <Card>
      <CardHeader title={t('settings.coverart.title')} />
      <Divider />
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('settings.coverart.description')}
        </Typography>
        <Button
          variant="outlined"
          startIcon={busy ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={handleFlush}
          disabled={busy}
        >
          {t('settings.coverart.flush')}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SettingsCoverArt;
