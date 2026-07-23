import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Card,
  CardContent,
  CardHeader,
  Divider,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';

import request from '../../utils/request';
import { emit } from '../../context/toast/events';

const LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];

// Runtime backend log-level control (previously only settable via config/CLI).
const SettingsLogLevel = () => {
  const { t } = useTranslation();
  const [level, setLevel] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    request('getLogLevel').then(({ result }) => {
      if (result) setLevel(result);
    });
  }, []);

  const handleChange = async (event) => {
    const value = event.target.value;
    setBusy(true);
    const { result, error } = await request('setLogLevel', { level: value });
    setBusy(false);
    if (!error) {
      setLevel(result || value);
      emit('success', t('settings.loglevel.changed', { level: result || value }));
    }
  };

  return (
    <Card>
      <CardHeader title={t('settings.loglevel.title')} />
      <Divider />
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('settings.loglevel.description')}
        </Typography>
        <TextField
          select
          size="small"
          label={t('settings.loglevel.label')}
          value={level}
          onChange={handleChange}
          disabled={busy || !level}
          sx={{ minWidth: 160 }}
        >
          {LEVELS.map((l) => (
            <MenuItem key={l} value={l}>{l}</MenuItem>
          ))}
        </TextField>
      </CardContent>
    </Card>
  );
};

export default SettingsLogLevel;
