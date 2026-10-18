import React from 'react';

import RefreshIcon from '@mui/icons-material/Refresh';

import ActionCard from './action-card';

const SettingsCoverArt = () => (
  <ActionCard
    command="flushCoverArt"
    textKey="settings.coverart"
    buttonKey="flush"
    doneKey="flushed"
    icon={<RefreshIcon />}
  />
);

export default SettingsCoverArt;
