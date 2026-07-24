import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';

import request from '../../../utils/request';
import { emit } from '../../../context/toast/events';

const PLACE = 'place';
const SWIPE = 'swipe';

const SettingsCardMode = () => {
  const { t } = useTranslation();

  const [mode, setMode] = useState(null);
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
          </Grid>
        )}
      </CardContent>
    </Card>
  );
};

export default SettingsCardMode;
