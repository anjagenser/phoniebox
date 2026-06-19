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

import request from '../../utils/request';

// Map backend alias → i18n key within 'settings.secondswipe'
const OPTIONS = [
  { value: 'rewind', labelKey: 'restart' },
  { value: 'toggle', labelKey: 'toggle' },
  { value: 'skip',   labelKey: 'skip' },
  { value: 'none',   labelKey: 'ignore' },
];

const SettingsSecondSwipe = () => {
  const { t } = useTranslation();

  const [option, setOption] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { result, error } = await request('getSecondSwipeOption');
      setIsLoading(false);
      if (error || result === undefined) {
        setIsError(true);
      } else {
        setOption(result);
      }
    };
    load();
  }, []);

  const handleChange = async (event) => {
    const newAlias = event.target.value;
    setOption(newAlias);
    const { error } = await request('setSecondSwipeOption', { alias: newAlias });
    if (error) {
      setIsError(true);
    }
  };

  return (
    <Card>
      <CardHeader
        title={t('settings.secondswipe.title')}
        subheader={t('settings.secondswipe.description')}
      />
      <Divider />
      <CardContent>
        <Grid container direction="column">
          {isLoading && (
            <Grid item sx={{ display: 'flex', justifyContent: 'center', padding: '8px' }}>
              <CircularProgress size={24} />
            </Grid>
          )}
          {isError && !isLoading && (
            <Typography color="error" variant="body2">
              {t('settings.secondswipe.load-error')}
            </Typography>
          )}
          {!isLoading && !isError && (
            <Grid item>
              <RadioGroup
                aria-label={t('settings.secondswipe.title')}
                name="second-swipe"
                value={option || ''}
                onChange={handleChange}
              >
                {OPTIONS.map(({ value, labelKey }) => (
                  <FormControlLabel
                    key={value}
                    value={value}
                    control={<Radio />}
                    label={t(`settings.secondswipe.${labelKey}`)}
                  />
                ))}
              </RadioGroup>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default SettingsSecondSwipe;
