import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  Slider,
  Switch,
  TextField,
  Typography,
} from '@mui/material';

import request from '../../../utils/request';

const DEFAULT_CONFIG = {
  enabled: false,
  start: '21:00',
  end: '06:00',
  fade_minutes: 15,
};

const SettingsQuietHours = () => {
  const { t } = useTranslation();

  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      const { result, error } = await request('getQuietHours');
      setIsLoading(false);
      if (error) {
        setIsError(true);
        return;
      }
      if (result) {
        const merged = { ...DEFAULT_CONFIG, ...result };
        setConfig(merged);
        setSaved(merged);
      }
    };
    fetchConfig();
  }, []);

  const update = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const isDirty = JSON.stringify(config) !== JSON.stringify(saved);

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await request('setQuietHours', {
      enabled: config.enabled,
      start: config.start,
      end: config.end,
      fade_minutes: config.fade_minutes,
    });
    setIsSaving(false);
    if (!error) {
      setSaved(config);
    }
  };

  return (
    <Card>
      <CardHeader
        title={t('settings.quiethours.title')}
        action={(isLoading || isSaving) ? <CircularProgress size={20} sx={{ m: 1 }} /> : null}
      />
      <Divider />
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('settings.quiethours.description')}
        </Typography>

        {isError && <Typography>⚠️ {t('settings.quiethours.load-error')}</Typography>}

        <FormControlLabel
          control={
            <Switch
              checked={config.enabled}
              onChange={(event) => update('enabled', event.target.checked)}
            />
          }
          label={t('settings.quiethours.enable')}
        />

        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={6}>
            <TextField
              fullWidth
              type="time"
              label={t('settings.quiethours.start')}
              value={config.start}
              onChange={(event) => update('start', event.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 300 }}
              disabled={!config.enabled}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth
              type="time"
              label={t('settings.quiethours.end')}
              value={config.end}
              onChange={(event) => update('end', event.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 300 }}
              disabled={!config.enabled}
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 3 }}>
          <Typography gutterBottom>
            {t('settings.quiethours.fade-label', { minutes: config.fade_minutes })}
          </Typography>
          <Slider
            value={config.fade_minutes}
            onChange={(event, value) => update('fade_minutes', value)}
            min={0}
            max={60}
            step={5}
            marks
            valueLabelDisplay="auto"
            disabled={!config.enabled}
            aria-label={t('settings.quiethours.fade-label', { minutes: config.fade_minutes })}
          />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
          >
            {t('general.buttons.save')}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default SettingsQuietHours;
