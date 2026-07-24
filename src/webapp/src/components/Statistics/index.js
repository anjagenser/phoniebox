import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
} from '@mui/material';

import BookmarkIcon from '@mui/icons-material/Bookmark';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import RefreshIcon from '@mui/icons-material/Refresh';

import Header from '../Header';
import request from '../../utils/request';
import { resolveCardDisplay } from '../Cards/display';

const LIMIT = 20;

const basename = (path) => (path ? path.split('/').pop() : '');

const StatRow = ({ avatar, primary, secondary, count, max }) => {
  const percent = max > 0 ? Math.round((count / max) * 100) : 0;

  return (
    <ListItem alignItems="flex-start" sx={{ display: 'block', px: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <ListItemAvatar>{avatar}</ListItemAvatar>
        <ListItemText
          primary={primary}
          secondary={secondary}
          primaryTypographyProps={{ noWrap: true }}
          secondaryTypographyProps={{ noWrap: true }}
          sx={{ minWidth: 0, mr: 1 }}
        />
        <Typography variant="h6" sx={{ ml: 'auto', pl: 1 }}>
          {count}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percent}
        sx={{ mt: 0.5, height: 8, borderRadius: 4 }}
      />
    </ListItem>
  );
};

const Statistics = () => {
  const { t } = useTranslation();

  const [stats, setStats] = useState(null);
  const [cardDetails, setCardDetails] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const { result, error: statsError } = await request('getStatistics', { limit: LIMIT });

    if (statsError) {
      setError(statsError);
      setIsLoading(false);
      return;
    }

    setStats(result);

    const { result: cards } = await request('cardsList');
    const cardsMap = cards || {};
    const details = {};
    await Promise.all(
      (result.cards || []).map(async ({ card_id: cardId }) => {
        const card = cardsMap[cardId];
        const resolved = card
          ? await resolveCardDisplay(card)
          : { name: null, image: null };
        details[cardId] = { ...resolved, fromAlias: card && card.from_alias };
      })
    );
    setCardDetails(details);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const doReset = async () => {
    setResetOpen(false);
    await request('resetStatistics');
    load();
  };

  const cards = (stats && stats.cards) || [];
  const songs = (stats && stats.songs) || [];
  const maxCard = cards.length ? cards[0].count : 0;
  const maxSong = songs.length ? songs[0].count : 0;
  const isEmpty = !isLoading && !error && cards.length === 0 && songs.length === 0;

  const cardLabel = (cardId) => {
    const detail = cardDetails[cardId] || {};
    return detail.name || detail.fromAlias || cardId;
  };

  return (
    <Grid container id="statistics">
      <Header title={t('statistics.title')} />

      <Grid
        container
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 1, mb: 1 }}
      >
        <Typography variant="body2" color="text.secondary">
          {stats
            ? t('statistics.summary', {
                swipes: stats.total_swipes,
                plays: stats.total_plays,
              })
            : ''}
        </Typography>
        <Box>
          <IconButton
            aria-label={t('statistics.refresh')}
            onClick={load}
            disabled={isLoading}
          >
            <RefreshIcon />
          </IconButton>
          <IconButton
            aria-label={t('statistics.reset')}
            onClick={() => setResetOpen(true)}
            disabled={isLoading || isEmpty}
          >
            <DeleteSweepIcon />
          </IconButton>
        </Box>
      </Grid>

      {isLoading && (
        <Grid container justifyContent="center" sx={{ mt: 4 }}>
          <CircularProgress />
        </Grid>
      )}

      {error && !isLoading && (
        <Typography sx={{ px: 1 }}>{t('statistics.loading-error')}</Typography>
      )}

      {isEmpty && (
        <Typography sx={{ px: 1 }}>{t('statistics.empty')}</Typography>
      )}

      {!isLoading && !error && !isEmpty && (
        <Grid container>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" sx={{ px: 1, mt: 1, fontWeight: 'bold' }}>
              {t('statistics.top-cards')}
            </Typography>
            {cards.length ? (
              <List sx={{ width: '100%' }}>
                {cards.map(({ card_id: cardId, count }) => (
                  <StatRow
                    key={cardId}
                    count={count}
                    max={maxCard}
                    primary={cardLabel(cardId)}
                    secondary={cardId}
                    avatar={
                      <Avatar
                        variant="rounded"
                        src={(cardDetails[cardId] || {}).image || undefined}
                      >
                        <BookmarkIcon />
                      </Avatar>
                    }
                  />
                ))}
              </List>
            ) : (
              <Typography sx={{ px: 1 }} color="text.secondary">
                {t('statistics.no-cards')}
              </Typography>
            )}
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" sx={{ px: 1, mt: 1, fontWeight: 'bold' }}>
              {t('statistics.top-songs')}
            </Typography>
            {songs.length ? (
              <List sx={{ width: '100%' }}>
                {songs.map(({ file, title, artist, count }) => (
                  <StatRow
                    key={file}
                    count={count}
                    max={maxSong}
                    primary={title || basename(file)}
                    secondary={artist || ''}
                    avatar={
                      <Avatar variant="rounded">
                        <MusicNoteIcon />
                      </Avatar>
                    }
                  />
                ))}
              </List>
            ) : (
              <Typography sx={{ px: 1 }} color="text.secondary">
                {t('statistics.no-songs')}
              </Typography>
            )}
          </Grid>
        </Grid>
      )}

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)}>
        <DialogTitle>{t('statistics.reset-dialog.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('statistics.reset-dialog.description')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)} color="primary" autoFocus>
            {t('general.buttons.cancel')}
          </Button>
          <Button onClick={doReset} color="secondary">
            {t('statistics.reset')}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
};

export default Statistics;
