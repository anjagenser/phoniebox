import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  InputAdornment,
  TextField,
} from '@mui/material';

import MusicNoteIcon from '@mui/icons-material/MusicNote';

const SelectedUri = ({ values: [uri], actionData, handleActionDataChange }) => {
  const { t } = useTranslation();

  const handleChange = (event) => {
    handleActionDataChange('play_music', 'play_uri', { uri: event.target.value });
  };

  return (
    <TextField
      autoFocus
      fullWidth
      size="small"
      label={t('cards.controls.actions.play-music.spotify-uri-label')}
      helperText={t('cards.controls.actions.play-music.spotify-uri-helper')}
      value={uri || ''}
      onChange={handleChange}
      sx={{ margin: '10px' }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <MusicNoteIcon fontSize="small" />
          </InputAdornment>
        ),
      }}
    />
  );
};

export default SelectedUri;
