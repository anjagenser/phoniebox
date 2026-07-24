import React from 'react';
import { useTranslation } from 'react-i18next';

import { Grid, Typography } from '@mui/material';

import SettingsAudio from './audio/index';
import SettingsAutoHotspot from './autohotspot';
import SettingsBluetooth from './bluetooth/index';
import SettingsCardBackup from './cardbackup/index';
import SettingsCardMode from './cardmode/index';
import SettingsCoverArt from './coverart';
import SettingsGeneral from './general';
import SettingsLibraryScan from './library-scan';
import SettingsLogLevel from './log-level';
import SettingsQuietHours from './quiethours/index';
import SettingsSecondSwipe from './secondswipe';
import SettingsServiceRestart from './service-restart';
import SettingsStatus from './status/index';
import SettingsTimers from './timers/index';
import SystemControls from './systemcontrols';

import { useTheme } from '@mui/material/styles';

const SECTIONS = [
  { key: 'general', items: [SettingsGeneral] },
  { key: 'playback', items: [SettingsAudio, SettingsCardMode, SettingsSecondSwipe] },
  { key: 'cards', items: [SettingsCardBackup] },
  { key: 'schedule', items: [SettingsTimers, SettingsQuietHours] },
  { key: 'network', items: [SettingsBluetooth, SettingsAutoHotspot] },
  { key: 'maintenance', items: [SettingsLibraryScan, SettingsCoverArt, SettingsServiceRestart, SettingsLogLevel] },
  { key: 'system', items: [SystemControls] },
];

const Settings = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const spacer = { marginBottom: theme.spacing(1) };

  return (
    <Grid
      container
      direction="column"
      id="settings"
      sx={{
        '& > .MuiGrid-item': spacer,
        padding: '10px',
        maxWidth: '100%',
      }}
    >
      <Grid item>
        <SettingsStatus />
      </Grid>

      {SECTIONS.map(({ key, items }) => (
        <React.Fragment key={key}>
          <Grid item>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: 'block', mt: 1, px: 0.5, fontWeight: 600 }}
            >
              {t(`settings.sections.${key}`)}
            </Typography>
          </Grid>
          {items.map((Item, index) => (
            <Grid item key={`${key}-${index}`}>
              <Item />
            </Grid>
          ))}
        </React.Fragment>
      ))}
    </Grid>
  );
};

export default Settings;
