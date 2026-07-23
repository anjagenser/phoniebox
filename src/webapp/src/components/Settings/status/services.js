import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Box,
  Chip,
  ListItem,
  ListItemText,
} from '@mui/material';

import request from '../../../utils/request';

// Colour a service's systemd state.
const stateColor = (state) => {
  if (state === 'active') return 'success';
  if (state === 'not-found') return 'default';
  return 'error';
};

const StatusServices = () => {
  const { t } = useTranslation();
  const [services, setServices] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      const { result } = await request('getServicesStatus');
      if (active && result) setServices(result);
    };
    fetchData();
    // Refresh periodically so a restart is reflected without reopening settings.
    const timer = setInterval(fetchData, 10000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  return (
    <ListItem
      disableGutters
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
    >
      <ListItemText
        sx={{ width: '100%' }}
        secondary={t('settings.status.services.label')}
      />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, width: '100%' }}>
        {!services && (
          <ListItemText primary={`${t('general.loading')} ...`} />
        )}
        {services && Object.entries(services).map(([name, state]) => (
          <Chip
            key={name}
            size="small"
            color={stateColor(state)}
            label={`${name}: ${t(`settings.status.services.state.${state}`, state)}`}
          />
        ))}
      </Box>
    </ListItem>
  );
};

export default StatusServices;
