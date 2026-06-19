import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CircularProgress,
  Grid,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';

import CheckIcon from '@mui/icons-material/Check';

import request from '../../../utils/request';

const BoxName = () => {
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      const { result } = await request('getBoxName');
      setIsLoading(false);
      if (result !== undefined) {
        setName(result);
        setSavedName(result);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!name.trim() || name === savedName) return;
    setIsSaving(true);
    const { result, error } = await request('setBoxName', { name: name.trim() });
    setIsSaving(false);
    if (!error && result !== undefined) {
      setSavedName(result);
      setName(result);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      inputRef.current?.blur();
      handleSave();
    }
  };

  const isDirty = name !== savedName;

  return (
    <Grid container direction="row" justifyContent="space-between" alignItems="center">
      <Typography sx={{ flexShrink: 0, marginRight: '16px' }}>
        {t('settings.general.box_name.title')}
      </Typography>
      <TextField
        inputRef={inputRef}
        size="small"
        value={name}
        disabled={isLoading}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        inputProps={{ maxLength: 64 }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              {isSaving
                ? <CircularProgress size={16} />
                : isDirty && (
                  <IconButton size="small" onClick={handleSave} edge="end">
                    <CheckIcon fontSize="small" />
                  </IconButton>
                )
              }
            </InputAdornment>
          ),
        }}
        sx={{ minWidth: '180px' }}
      />
    </Grid>
  );
};

export default BoxName;
