import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
} from '@mui/material';

import BluetoothIcon from '@mui/icons-material/Bluetooth';
import BluetoothConnectedIcon from '@mui/icons-material/BluetoothConnected';
import DeleteIcon from '@mui/icons-material/Delete';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import SearchIcon from '@mui/icons-material/Search';

import PubSubContext from '../../../context/pubsub/context';
import request from '../../../utils/request';
import { emit } from '../../../context/toast/events';

const SettingsBluetooth = () => {
  const { t } = useTranslation();
  const { state: pubsubState } = useContext(PubSubContext);
  // activeSink is republished on Bluetooth connect/disconnect; use it to refresh devices.
  const activeSink = pubsubState['volume.sink']?.active_sink;
  // Slow bluetoothctl jobs report back on this topic instead of in the request reply.
  const jobResult = pubsubState['host.bluetooth'];

  const [available, setAvailable] = useState(true);
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [busyMac, setBusyMac] = useState(null);
  // The last result is replayed on subscribe; only a job started here may end the wait.
  const pending = useRef(null);
  const fallback = useRef(null);

  const loadDevices = useCallback(async () => {
    const { result, error } = await request('bluetoothDevices');
    setIsLoading(false);
    if (error) return;
    if (result) {
      setAvailable(result.available !== false);
      setDevices(result.devices || []);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices, activeSink]);

  const finishJob = useCallback(() => {
    pending.current = null;
    clearTimeout(fallback.current);
    setIsScanning(false);
    setBusyMac(null);
  }, []);

  useEffect(() => () => clearTimeout(fallback.current), []);

  useEffect(() => {
    if (!jobResult || !pending.current) return;
    const { toastKey } = pending.current;
    finishJob();
    setAvailable(jobResult.available !== false);
    setDevices(jobResult.devices || []);
    if (!jobResult.ok) {
      emit('error', t('settings.bluetooth.toasts.failed'));
    } else if (toastKey) {
      emit('success', t(`settings.bluetooth.toasts.${toastKey}`));
    }
  }, [jobResult, finishJob, t]);

  const startJob = async (command, kwargs, toastKey) => {
    pending.current = { toastKey };
    // Fallback if the result never arrives, e.g. the backend restarted meanwhile
    fallback.current = setTimeout(() => {
      finishJob();
      loadDevices();
    }, 60000);
    const { error } = await request(command, kwargs);
    if (error) finishJob();
  };

  const handleScan = () => {
    setIsScanning(true);
    startJob('bluetoothScan', { timeout: 12 }, null);
  };

  const runAction = (mac, command, toastKey) => {
    setBusyMac(mac);
    startJob(command, { mac }, toastKey);
  };

  if (!available) {
    return (
      <Card>
        <CardHeader title={t('settings.bluetooth.title')} />
        <Divider />
        <CardContent>
          <Typography>{t('settings.bluetooth.not-available')}</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={t('settings.bluetooth.title')}
        action={
          <Button
            startIcon={isScanning ? <CircularProgress size={16} /> : <SearchIcon />}
            onClick={handleScan}
            disabled={isScanning}
          >
            {t('settings.bluetooth.scan')}
          </Button>
        }
      />
      <Divider />
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('settings.bluetooth.description')}
        </Typography>

        {isLoading && <CircularProgress size={20} />}

        {!isLoading && devices.length === 0 && (
          <Typography>{t('settings.bluetooth.no-devices')}</Typography>
        )}

        <List sx={{ width: '100%' }}>
          {devices.map((device) => (
            <ListItem
              key={device.mac}
              disableGutters
              sx={{ flexWrap: 'wrap', gap: 1 }}
              secondaryAction={
                device.paired ? (
                  <IconButton
                    edge="end"
                    aria-label={t('settings.bluetooth.remove')}
                    onClick={() => runAction(device.mac, 'bluetoothRemove', 'removed')}
                    disabled={busyMac === device.mac}
                  >
                    <DeleteIcon />
                  </IconButton>
                ) : null
              }
            >
              <ListItemAvatar>
                <Avatar>
                  {device.connected ? <BluetoothConnectedIcon /> : <HeadphonesIcon />}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={device.name || device.mac}
                secondary={device.mac}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 5 }}>
                {device.connected && (
                  <Chip
                    size="small"
                    color="success"
                    icon={<BluetoothConnectedIcon />}
                    label={t('settings.bluetooth.connected')}
                  />
                )}
                {busyMac === device.mac && <CircularProgress size={18} />}
                {!device.paired && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<BluetoothIcon />}
                    onClick={() => runAction(device.mac, 'bluetoothPair', 'paired')}
                    disabled={busyMac === device.mac}
                  >
                    {t('settings.bluetooth.pair')}
                  </Button>
                )}
                {device.paired && !device.connected && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => runAction(device.mac, 'bluetoothConnect', 'connected')}
                    disabled={busyMac === device.mac}
                  >
                    {t('settings.bluetooth.connect')}
                  </Button>
                )}
                {device.connected && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => runAction(device.mac, 'bluetoothDisconnect', 'disconnected')}
                    disabled={busyMac === device.mac}
                  >
                    {t('settings.bluetooth.disconnect')}
                  </Button>
                )}
              </Box>
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};

export default SettingsBluetooth;
