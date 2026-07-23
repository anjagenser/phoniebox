import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';

import AlbumIcon from '@mui/icons-material/Album';
import EditIcon from '@mui/icons-material/Edit';

import request from '../../../utils/request';

// Commands whose first argument is a Spotify/stream URI (contents resolved via
// Mopidy) vs. a local music folder (contents listed from the file system).
const URI_COMMANDS = ['play_uri'];
const FOLDER_COMMANDS = ['play_folder', 'play_card'];

const AUDIO_EXT = /\.(mp3|m4a|flac|ogg|oga|opus|wav|aac|wma)$/i;
const stripExt = (name) => (typeof name === 'string' ? name.replace(AUDIO_EXT, '') : name);

const CardContentDialog = ({ open, onClose, cardId, card = {}, detail = {} }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [tracks, setTracks] = useState(null);
  const [loading, setLoading] = useState(false);

  const command = card.from_alias;
  const arg0 = card.action && card.action.args && card.action.args[0];
  const kind = URI_COMMANDS.includes(command) && arg0 ? 'uri'
    : FOLDER_COMMANDS.includes(command) && arg0 ? 'folder'
      : null;

  useEffect(() => {
    if (!open || !kind) {
      setTracks(null);
      return undefined;
    }
    let active = true;
    setLoading(true);
    (async () => {
      let list = [];
      if (kind === 'uri') {
        const { result } = await request('getUriTracks', { uri: arg0 });
        list = Array.isArray(result) ? result : [];
      } else if (kind === 'folder') {
        // List the music files in the folder (depth 1); skip sub-directories.
        const { result } = await request('folderList', { folder: arg0 });
        list = Array.isArray(result)
          ? result
              .filter((entry) => ['file', 'stream', 'podcast'].includes(entry.type))
              .map((entry) => ({ name: stripExt(entry.name), artist: null }))
          : [];
      }
      if (!active) return;
      setTracks(list);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [open, kind, arg0]);

  const name = detail.name || command || cardId;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar variant="rounded" src={detail.image || undefined} sx={{ width: 56, height: 56 }}>
          <AlbumIcon />
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap>{name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t('cards.content.card-id', { cardId })}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {!kind && (
          <Typography variant="body2" color="text.secondary">
            {t('cards.content.no-tracklist')}
          </Typography>
        )}

        {kind && loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {kind && !loading && tracks && tracks.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t('cards.content.empty')}
          </Typography>
        )}

        {kind && !loading && tracks && tracks.length > 0 && (
          <List dense disablePadding>
            {tracks.map((track, index) => (
              <ListItem key={index} disableGutters>
                <ListItemText
                  primary={`${index + 1}. ${track.name || t('cards.content.unknown-track')}`}
                  secondary={track.artist || undefined}
                  primaryTypographyProps={{ noWrap: true }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button startIcon={<EditIcon />} onClick={() => navigate(`/cards/${cardId}/edit`)}>
          {t('cards.content.edit')}
        </Button>
        <Button onClick={onClose} autoFocus>
          {t('cards.content.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CardContentDialog;
