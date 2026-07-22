import React, { useCallback, useEffect, useState } from 'react';
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

import request from '../../../utils/request';

const SettingsBluetooth = () => {
  const { t } = useTranslation();

  const [available, setAvailable] = useState(true);
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  // MAC address currently performing a pair/connect/disconnect/remove action
  const [busyMac, setBusyMac] = useState(null);

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
  }, [loadDevices]);

  const handleScan = async () => {
    setIsScanning(true);
    const { result } = await request('bluetoothScan', { timeout: 12 });
    setIsScanning(false);
    if (result) {
      setAvailable(result.available !== false);
      setDevices(result.devices || []);
    }
  };

  const runAction = async (mac, command) => {
    setBusyMac(mac);
    await request(command, { mac });
    setBusyMac(null);
    await loadDevices();
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
                    onClick={() => runAction(device.mac, 'bluetoothRemove')}
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
                    onClick={() => runAction(device.mac, 'bluetoothPair')}
                    disabled={busyMac === device.mac}
                  >
                    {t('settings.bluetooth.pair')}
                  </Button>
                )}
                {device.paired && !device.connected && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => runAction(device.mac, 'bluetoothConnect')}
                    disabled={busyMac === device.mac}
                  >
                    {t('settings.bluetooth.connect')}
                  </Button>
                )}
                {device.connected && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => runAction(device.mac, 'bluetoothDisconnect')}
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
