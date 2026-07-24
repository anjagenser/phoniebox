import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  Badge,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import SearchIcon from '@mui/icons-material/Search';
import UploadIcon from '@mui/icons-material/Upload';

import request from '../../utils/request';
import { resolveCardDisplay } from '../Cards/display';

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

// Card list with cover thumbnails and an "add" button per card, plus an
// "upload image" action for labels that are not backed by a card. Reuses the
// existing card list RPC and the shared cover/name resolver.
const CardPicker = ({ counts = {}, onAddCard, onAddImages }) => {
  const { t } = useTranslation();
  const fileInput = useRef(null);

  const [data, setData] = useState({});
  const [details, setDetails] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      const { result, error: err } = await request('cardsList');
      if (!active) return;
      setIsLoading(false);
      if (result) setData(result);
      if (err) setError(err);
    })();
    return () => { active = false; };
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

  const label = (id) => details[id]?.name || data[id]?.from_alias || id;

  const entries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return Object.keys(data)
      .map((id) => ({ id, card: data[id] }))
      .filter(({ id, card }) => {
        if (!query) return true;
        const haystack = [
          id,
          card.from_alias,
          ...((card.action && card.action.args) || []),
          details[id]?.name,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => label(a.id).localeCompare(label(b.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, details, search]);

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const images = await Promise.all(
      files.map(async (file) => ({
        image: await readFileAsDataUrl(file),
        caption: file.name.replace(/\.[^.]+$/, ''),
        cardId: null,
      })),
    );
    onAddImages(images);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFiles}
      />
      <Button
        variant="outlined"
        startIcon={<UploadIcon />}
        onClick={() => fileInput.current && fileInput.current.click()}
        sx={{ mb: 1 }}
      >
        {t('labels.picker.upload')}
      </Button>

      <TextField
        fullWidth
        size="small"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('labels.picker.search')}
        sx={{ mb: 1 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Typography color="text.secondary">
          {t('labels.picker.loading-error')}
        </Typography>
      )}

      {!isLoading && !error && entries.length === 0 && (
        <Typography color="text.secondary">
          {t('labels.picker.no-cards')}
        </Typography>
      )}

      <List sx={{ width: '100%' }}>
        {entries.map(({ id, card }) => {
          const detail = details[id] || {};
          const count = counts[id] || 0;
          return (
            <ListItem
              key={id}
              secondaryAction={(
                <IconButton
                  edge="end"
                  color="primary"
                  aria-label={t('labels.picker.add')}
                  title={t('labels.picker.add')}
                  onClick={() => onAddCard({
                    image: detail.image || null,
                    caption: detail.name || id,
                    cardId: id,
                  })}
                >
                  <Badge badgeContent={count} color="primary">
                    <AddIcon />
                  </Badge>
                </IconButton>
              )}
            >
              <ListItemAvatar>
                <Avatar variant="rounded" src={detail.image || undefined}>
                  <BookmarkIcon />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={detail.name || card.from_alias || id}
                primaryTypographyProps={{ noWrap: true }}
                secondary={id}
                secondaryTypographyProps={{ noWrap: true }}
              />
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

export default CardPicker;
