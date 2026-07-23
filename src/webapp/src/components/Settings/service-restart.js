import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';

import RestartAltIcon from '@mui/icons-material/RestartAlt';

import request from '../../utils/request';
import { emit } from '../../context/toast/events';

// Maintenance action: restart the critical services from the web UI.
const SettingsServiceRestart = () => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(null); // command currently running

  const restart = async (command, toastKey) => {
    setBusy(command);
    const { error } = await request(command);
    setBusy(null);
    if (!error) {
      emit('success', t(toastKey));
    }
  };

  return (
    <Card>
      <CardHeader title={t('settings.servicerestart.title')} />
      <Divider />
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('settings.servicerestart.description')}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            startIcon={busy === 'restartMopidy' ? <CircularProgress size={16} /> : <RestartAltIcon />}
            onClick={() => restart('restartMopidy', 'settings.servicerestart.mopidy-done')}
            disabled={!!busy}
          >
            {t('settings.servicerestart.mopidy')}
          </Button>
          <Button
            variant="outlined"
            color="warning"
            startIcon={busy === 'restartService' ? <CircularProgress size={16} /> : <RestartAltIcon />}
            onClick={() => restart('restartService', 'settings.servicerestart.jukebox-done')}
            disabled={!!busy}
          >
            {t('settings.servicerestart.jukebox')}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default SettingsServiceRestart;
