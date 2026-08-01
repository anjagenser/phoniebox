import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  createSearchParams,
  useNavigate,
} from 'react-router-dom';

import {
  Button,
  Grid,
  Typography,
} from '@mui/material';

import FolderIcon from '@mui/icons-material/Folder';
import MusicNoteIcon from '@mui/icons-material/MusicNote';

// The two ways a card is assigned almost every time. They are offered directly, so
// neither of them needs a trip through the action and command dropdowns first.
const QuickActions = ({
  cardId,
  handleActionDataChange,
  onShowAllActions,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const selectFolder = () => {
    const searchParams = createSearchParams({
      isSelecting: true,
      cardId,
    });

    navigate({
      pathname: '/library/folders',
      search: `?${searchParams}`,
    });
  };

  const selectUri = () => {
    handleActionDataChange('play_music', 'play_uri', { uri: '' });
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Typography>
          {t('cards.controls.quick-actions.title')}
        </Typography>
      </Grid>
      <Grid item xs={12} sm={6}>
        <Button
          fullWidth
          size="large"
          variant="contained"
          startIcon={<FolderIcon />}
          onClick={selectFolder}
          sx={{ padding: '16px' }}
        >
          {t('cards.controls.quick-actions.folder')}
        </Button>
      </Grid>
      <Grid item xs={12} sm={6}>
        <Button
          fullWidth
          size="large"
          variant="contained"
          startIcon={<MusicNoteIcon />}
          onClick={selectUri}
          sx={{ padding: '16px' }}
        >
          {t('cards.controls.quick-actions.spotify')}
        </Button>
      </Grid>
      <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center' }}>
        <Button size="small" color="secondary" onClick={onShowAllActions}>
          {t('cards.controls.quick-actions.all-actions')}
        </Button>
      </Grid>
    </Grid>
  );
};

export default QuickActions;
