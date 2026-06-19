import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  Card,
  CardContent,
  CardHeader,
  Divider,
  Grid,
  List,
} from '@mui/material';

import StatusBattery from './battery';
import StatusCpuTemp from './cpu-temp';
import StatusDiskUsage from './disk-usage';
import StatusIpAddress from './ip-address';
import StatusLogs from './logs';
import StatusVersion from './version';

const SettingsStatus = () => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader title={t('settings.status.title')} />
      <Divider />
      <CardContent>
        <Grid container>
          <Grid item xs={12}>
            <List>
              <StatusVersion />
              <StatusBattery />
              <StatusDiskUsage />
              <StatusIpAddress />
              <StatusCpuTemp />
              <StatusLogs />
            </List>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

export default SettingsStatus;
