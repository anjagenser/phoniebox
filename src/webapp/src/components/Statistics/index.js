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
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';

import BookmarkIcon from '@mui/icons-material/Bookmark';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import RefreshIcon from '@mui/icons-material/Refresh';

import Header from '../Header';
import request from '../../utils/request';
import { resolveCardDisplay } from '../Cards/display';

const LIMIT = 10;
const HISTORY_LIMIT = 3;

const basename = (path) => (path ? path.split('/').pop() : '');

const formatPeriod = (period, language) => {
  const [year, month] = period.split('-');
  if (!month) return year;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(language, { month: 'long', year: 'numeric' });
};

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

const HistoryRank = ({ rank, primary, secondary, count }) => (
  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
    <Typography variant="body2" color="text.secondary" sx={{ width: 16 }}>
      {`${rank}.`}
    </Typography>
    <Typography variant="body2" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
      {primary}
      {secondary ? (
        <Typography
          component="span"
          variant="caption"
          color="text.secondary"
          sx={{ ml: 0.5 }}
        >
          {secondary}
        </Typography>
      ) : null}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
      {count}
    </Typography>
  </Box>
);

const HistoryPeriod = ({ cards, songs, cardLabel }) => {
  const { t } = useTranslation();

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            {t('statistics.top-cards')}
          </Typography>
          {cards.length ? (
            cards.map(({ card_id: cardId, count }, index) => (
              <HistoryRank
                key={cardId}
                rank={index + 1}
                primary={cardLabel(cardId)}
                count={count}
              />
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t('statistics.no-cards')}
            </Typography>
          )}
        </Grid>
        <Grid item xs={12} sm={6} sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            {t('statistics.top-songs')}
          </Typography>
          {songs.length ? (
            songs.map(({ file, title: songTitle, artist, count }, index) => (
              <HistoryRank
                key={file}
                rank={index + 1}
                primary={songTitle || basename(file)}
                secondary={artist || ''}
                count={count}
              />
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t('statistics.no-songs')}
            </Typography>
          )}
        </Grid>
      </Grid>
    </Paper>
  );
};

const Statistics = () => {
  const { t, i18n } = useTranslation();

  const [stats, setStats] = useState(null);
  const [cardDetails, setCardDetails] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [historyTab, setHistoryTab] = useState('months');
  const [selectedPeriod, setSelectedPeriod] = useState({ months: null, years: null });

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const { result, error: statsError } = await request('getStatistics', {
      limit: LIMIT,
      history_limit: HISTORY_LIMIT,
    });

    if (statsError) {
      setError(statsError);
      setIsLoading(false);
      return;
    }

    setStats(result);

    const { result: cards } = await request('cardsList');
    const cardsMap = cards || {};
    const details = {};
    const history = result.history || {};
    const cardIds = new Set(
      [
        ...(result.cards || []),
        ...(history.months || []).flatMap(({ cards: periodCards }) => periodCards || []),
        ...(history.years || []).flatMap(({ cards: periodCards }) => periodCards || []),
      ].map(({ card_id: cardId }) => cardId)
    );
    await Promise.all(
      [...cardIds].map(async (cardId) => {
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
  const history = (stats && stats.history) || {};
  const periods = (historyTab === 'years' ? history.years : history.months) || [];
  // fall back to the newest period whenever the pick is gone (tab switch, reload, reset)
  const activeIndex = Math.max(
    0,
    periods.findIndex(({ period }) => period === selectedPeriod[historyTab])
  );
  const activePeriod = periods[activeIndex];

  const pickPeriod = (period) =>
    setSelectedPeriod((current) => ({ ...current, [historyTab]: period }));
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
              {t('statistics.top-cards-limited', { limit: LIMIT })}
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
              {t('statistics.top-songs-limited', { limit: LIMIT })}
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

          <Grid item xs={12} sx={{ px: 1, mt: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              {t('statistics.history.title', { limit: HISTORY_LIMIT })}
            </Typography>
            <Tabs
              value={historyTab}
              onChange={(event, value) => setHistoryTab(value)}
              sx={{ mb: 1 }}
            >
              <Tab value="months" label={t('statistics.history.per-month')} />
              <Tab value="years" label={t('statistics.history.per-year')} />
            </Tabs>
            {activePeriod ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <IconButton
                    aria-label={t('statistics.history.older')}
                    onClick={() => pickPeriod(periods[activeIndex + 1].period)}
                    disabled={activeIndex >= periods.length - 1}
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                  <TextField
                    select
                    size="small"
                    label={t(
                      historyTab === 'years'
                        ? 'statistics.history.select-year'
                        : 'statistics.history.select-month'
                    )}
                    value={activePeriod.period}
                    onChange={(event) => pickPeriod(event.target.value)}
                    sx={{ minWidth: 180 }}
                  >
                    {periods.map(({ period }) => (
                      <MenuItem key={period} value={period}>
                        {formatPeriod(period, i18n.language)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <IconButton
                    aria-label={t('statistics.history.newer')}
                    onClick={() => pickPeriod(periods[activeIndex - 1].period)}
                    disabled={activeIndex <= 0}
                  >
                    <ChevronRightIcon />
                  </IconButton>
                </Box>
                <HistoryPeriod
                  cards={activePeriod.cards || []}
                  songs={activePeriod.songs || []}
                  cardLabel={cardLabel}
                />
              </>
            ) : (
              <Typography color="text.secondary">
                {t('statistics.history.empty')}
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
