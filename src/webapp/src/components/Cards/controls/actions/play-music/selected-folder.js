import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Switch,
  Typography,
} from '@mui/material';

import NoMusicSelected from './no-music-selected';
import FolderTypeAvatar from '../../../../Library/lists/folders/folder-type-avatar';

import request from '../../../../../utils/request';

const SelectedFolder = ({ values: [folder] }) => {
  const { t } = useTranslation();
  // TODO: Implement type correctly
  const type = 'directory';

  const [config, setConfig] = useState({
    resume: false,
    shuffle: false,
    loop: false,
    single: false,
  });

  useEffect(() => {
    if (!folder) return;

    const loadConfig = async () => {
      const { result } = await request('get_folder_config', { folder });
      if (result) {
        setConfig({
          resume: result.resume || false,
          shuffle: result.shuffle || false,
          loop: result.loop || false,
          single: result.single || false,
        });
      }
    };

    loadConfig();
  }, [folder]);

  const handleToggle = async (key) => {
    const newConfig = { ...config, [key]: !config[key] };
    setConfig(newConfig);
    await request('set_folder_config', {
      folder,
      resume: newConfig.resume,
      shuffle: newConfig.shuffle,
      loop: newConfig.loop,
      single: newConfig.single,
    });
  };

  if (folder) {
    return (
      <>
        <List sx={{ width: '100%', margin: '10px' }}>
          <ListItem disablePadding>
            <FolderTypeAvatar type={type} />
            <ListItemText primary={folder} />
          </ListItem>
        </List>
        <Typography variant="subtitle2" sx={{ marginLeft: '10px', marginTop: '8px' }}>
          {t('cards.controls.actions.play-music.folder-config.title')}
        </Typography>
        {['resume', 'shuffle', 'loop', 'single'].map((key) => (
          <FormControlLabel
            key={key}
            sx={{ display: 'block', marginLeft: '10px' }}
            control={
              <Switch
                checked={config[key]}
                onChange={() => handleToggle(key)}
                size="small"
              />
            }
            label={t(`cards.controls.actions.play-music.folder-config.${key}`)}
          />
        ))}
      </>
    );
  }

  return <NoMusicSelected />;
};

export default SelectedFolder;
