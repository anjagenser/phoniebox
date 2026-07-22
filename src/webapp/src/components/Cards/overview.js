import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

import AddIcon from '@mui/icons-material/Add';
import CardsList from './list';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import Header from '../Header';
import request from '../../utils/request';
import { MINI_PLAYER_HEIGHT, NAV_HEIGHT, SAFE_AREA_BOTTOM } from '../Player/mini-player';

const CardsOverview = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { t } = useTranslation();

  const [data, setData] = useState({});
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const openRegisterCard = () => {
    navigate('register');
  };

  useEffect(() => {
    const loadCardList = async () => {
      setIsLoading(true);
      const { result, error } = await request('cardsList');
      setIsLoading(false);

      if(result) setData(result);
      if(error) setError(error);
    }

    loadCardList();
  }, []);

  return (
    <Grid container id="cards">
      <Header title={t('cards.overview.cards')} />
      <Grid
        container
        spacing={1}
        sx={{
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {isLoading
          ? <CircularProgress />
          : <CardsList cardsList={data} />
        }
        {error &&
          <Typography>{t('cards.overview.loading-error')}</Typography>
        }
      </Grid>
      <Fab
        aria-label={t('cards.overview.register-card')}
        color="primary"
        onClick={openRegisterCard}
        sx={{
          position: 'fixed',
          // Sit above the fixed MiniPlayer bar (which covers the lower band on
          // every non-home page) instead of being hidden beneath it.
          bottom: `calc(${NAV_HEIGHT + MINI_PLAYER_HEIGHT}px + ${SAFE_AREA_BOTTOM} + ${theme.spacing(2)})`,
          right: theme.spacing(2),
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <AddIcon />
      </Fab>
    </Grid>
  );
};

export default CardsOverview;
