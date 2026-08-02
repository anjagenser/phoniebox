import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Typography,
} from '@mui/material';

import request from '../../../utils/request';
import { emit } from '../../../context/toast/events';

const PLACE = 'place';
const SWIPE = 'swipe';

// A reader behind a card slot misses a read now and then. The delay must outlast those
// dropouts, so the choice reaches well beyond the default.
const DELAY_OPTIONS = [1, 1.5, 2, 2.5, 3, 4, 5, 7, 10];

const SettingsCardMode = () => {
  const { t } = useTranslation();

  const [mode, setMode] = useState(null);
  const [delay, setDelay] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { result, error } = await request('getCardReadingMode');
      setIsLoading(false);
      if (error || !result) {
        setIsError(true);
        return;
      }
      setMode(result.place_not_swipe ? PLACE : SWIPE);
      setDelay(result.card_removal_delay ?? null);
    };
    load();
  }, []);

  const handleChange = async (event) => {
    const value = event.target.value;
    const previous = mode;
    setMode(value);
    const { error } = await request('setCardReadingMode', {
      place_not_swipe: value === PLACE,
    });
    if (error) {
      setMode(previous);
      return;
    }
    emit('success', t('settings.cardmode.saved'));
  };

  const handleDelayChange = async (event) => {
    const value = event.target.value;
    const previous = delay;
    setDelay(value);
    const { error } = await request('setCardRemovalDelay', { delay: value });
    if (error) {
      setDelay(previous);
      return;
    }
    emit('success', t('settings.cardmode.saved'));
  };

  const delayValue = DELAY_OPTIONS.includes(delay) ? delay : '';

  return (
    <Card>
      <CardHeader
        title={t('settings.cardmode.title')}
        subheader={t('settings.cardmode.description')}
        action={isLoading ? <CircularProgress size={20} sx={{ m: 1 }} /> : null}
      />
      <Divider />
      <CardContent>
        {isError && !isLoading && (
          <Typography color="error" variant="body2">
            {t('settings.cardmode.load-error')}
          </Typography>
        )}
        {!isLoading && !isError && (
          <Grid container direction="column">
            <RadioGroup
              aria-label={t('settings.cardmode.title')}
              name="card-reading-mode"
              value={mode || ''}
              onChange={handleChange}
            >
              <FormControlLabel
                value={PLACE}
                control={<Radio />}
                label={
                  <>
                    <Typography>{t('settings.cardmode.place-title')}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('settings.cardmode.place-description')}
                    </Typography>
                  </>
                }
                sx={{ alignItems: 'flex-start', mb: 1 }}
              />
              <FormControlLabel
                value={SWIPE}
                control={<Radio />}
                label={
                  <>
                    <Typography>{t('settings.cardmode.swipe-title')}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('settings.cardmode.swipe-description')}
                    </Typography>
                  </>
                }
                sx={{ alignItems: 'flex-start' }}
              />
            </RadioGroup>

            {mode === PLACE && delay !== null && (
              <>
                <Divider sx={{ my: 2 }} />
                <FormControl size="small" sx={{ maxWidth: '260px' }}>
                  <InputLabel id="card-removal-delay-label">
                    {t('settings.cardmode.removal-delay-label')}
                  </InputLabel>
                  <Select
                    labelId="card-removal-delay-label"
                    label={t('settings.cardmode.removal-delay-label')}
                    value={delayValue}
                    onChange={handleDelayChange}
                  >
                    {DELAY_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {t('settings.cardmode.removal-delay-seconds', { seconds: option })}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {t('settings.cardmode.removal-delay-description')}
                </Typography>
              </>
            )}
          </Grid>
        )}
      </CardContent>
    </Card>
  );
};

export default SettingsCardMode;
