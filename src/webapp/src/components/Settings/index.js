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
import SettingsQuietHours from './quiethours/index';
import SettingsSecondSwipe from './secondswipe';
import SettingsStatus from './status/index';
import SettingsTimers from './timers/index';
import SystemControls from './systemcontrols';

import { useTheme } from '@mui/material/styles';

// Group the settings cards into labelled sections so the page stays readable as
// it grows. Each section renders a small overline heading followed by its cards.
const SECTIONS = [
  { key: 'general', items: [SettingsGeneral] },
  { key: 'playback', items: [SettingsAudio, SettingsCardMode, SettingsSecondSwipe] },
  { key: 'cards', items: [SettingsCardBackup] },
  { key: 'schedule', items: [SettingsTimers, SettingsQuietHours] },
  { key: 'network', items: [SettingsBluetooth, SettingsAutoHotspot] },
  { key: 'system', items: [SystemControls, SettingsCoverArt] },
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
        // Belt-and-suspenders: keep every child within the pane width.
        maxWidth: '100%',
      }}
    >
      {/* Status overview stays pinned at the top, above the grouped sections. */}
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
