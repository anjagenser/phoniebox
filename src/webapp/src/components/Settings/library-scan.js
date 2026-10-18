import React from 'react';

import CachedIcon from '@mui/icons-material/Cached';

import ActionCard from './action-card';

const SettingsLibraryScan = () => (
  <ActionCard
    command="rescanLibrary"
    textKey="settings.libraryscan"
    buttonKey="scan"
    doneKey="done"
    icon={<CachedIcon />}
  />
);

export default SettingsLibraryScan;
