import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import CardsList from './list';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import Header from '../Header';
import request from '../../utils/request';
import { resolveCardDisplay } from './display';
import { MINI_PLAYER_HEIGHT, NAV_HEIGHT, SAFE_AREA_BOTTOM } from '../Player/mini-player';

const SORT_OPTIONS = ['name-asc', 'name-desc', 'artist-asc', 'artist-desc'];

const CardsOverview = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { t } = useTranslation();

  const [data, setData] = useState({});
  const [details, setDetails] = useState({});
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name-asc');

  const openRegisterCard = () => {
    navigate('register');
  };

  useEffect(() => {
    const loadCardList = async () => {
      setIsLoading(true);
      const { result, error } = await request('cardsList');
      setIsLoading(false);

      if (result) setData(result);
      if (error) setError(error);
    }

    loadCardList();
  }, []);

  useEffect(() => {
    let active = true;
    const ids = Object.keys(data);
    if (!ids.length) return undefined;

    (async () => {
      const resolved = {};
      await Promise.all(ids.map(async (id) => {
        resolved[id] = await resolveCardDisplay(data[id]);
      }));
      if (active) setDetails(resolved);
    })();

    return () => { active = false; };
  }, [data]);

  const label = (id) =>
    details[id]?.name || data[id]?.from_alias || id;

  const artistLabel = (id) => details[id]?.artist || '';

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLowerCase();

    const entries = Object.keys(data).map((id) => ({ id, card: data[id] }));

    const matches = ({ id }) => {
      if (!query) return true;
      const haystack = [
        details[id]?.name,
        details[id]?.artist,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    };

    const byArtist = (a, b, dir) => {
      const aa = artistLabel(a.id);
      const ba = artistLabel(b.id);
      if (!aa && !ba) return label(a.id).localeCompare(label(b.id));
      if (!aa) return 1;
      if (!ba) return -1;
      return dir * aa.localeCompare(ba) || label(a.id).localeCompare(label(b.id));
    };

    const sorters = {
      'name-asc': (a, b) => label(a.id).localeCompare(label(b.id)),
      'name-desc': (a, b) => label(b.id).localeCompare(label(a.id)),
      'artist-asc': (a, b) => byArtist(a, b, 1),
      'artist-desc': (a, b) => byArtist(a, b, -1),
    };

    return entries.filter(matches).sort(sorters[sort] || sorters['name-asc']);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, details, search, sort]);

  const totalCards = Object.keys(data).length;
  const noResults = !isLoading && totalCards > 0 && visibleEntries.length === 0;

  return (
    <Grid container id="cards">
      <Header title={t('cards.overview.cards')} />

      {totalCards > 0 && (
        <Grid
          container
          spacing={1}
          alignItems="center"
          sx={{ px: 1, mb: 1 }}
        >
          <Grid item xs={12} sm={8}>
            <TextField
              fullWidth
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('cards.overview.search-placeholder')}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="cards-sort-label">
                {t('cards.overview.sort-label')}
              </InputLabel>
              <Select
                labelId="cards-sort-label"
                label={t('cards.overview.sort-label')}
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                {SORT_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {t(`cards.overview.sort.${option}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      )}

      <Grid
        container
        spacing={1}
        sx={{
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {isLoading && <CircularProgress />}
        {!isLoading && noResults && (
          <Typography>{t('cards.overview.no-results')}</Typography>
        )}
        {!isLoading && !noResults && (
          <CardsList entries={visibleEntries} details={details} />
        )}
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
