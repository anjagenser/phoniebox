import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  Box,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
} from '@mui/material';

import AlbumIcon from '@mui/icons-material/Album';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import FolderIcon from '@mui/icons-material/Folder';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import SettingsIcon from '@mui/icons-material/Settings';
import SyncIcon from '@mui/icons-material/Sync';
import TimerIcon from '@mui/icons-material/Timer';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';

import { findActionByCommand } from './utils';
import CardContentDialog from './dialogs/content';

const iconForCommand = (command) => {
  switch (command) {
    case 'play_uri':
    case 'play_single':
      return <MusicNoteIcon />;
    case 'play_album':
      return <AlbumIcon />;
    case 'play_folder':
      return <FolderIcon />;
    default:
      break;
  }
  switch (findActionByCommand(command)) {
    case 'host':
      return <SettingsIcon />;
    case 'timers':
      return <TimerIcon />;
    case 'audio':
      return <VolumeUpIcon />;
    case 'synchronisation':
      return <SyncIcon />;
    default:
      return <BookmarkIcon />;
  }
};

const isSpotify = (uri) => typeof uri === 'string' && /spotify/i.test(uri);

const sourceChipProps = (srcKey) => {
  switch (srcKey) {
    case 'spotify':
      return { variant: 'filled', sx: { bgcolor: '#1DB954', color: '#000', fontWeight: 600 } };
    case 'folder':
      return { variant: 'filled', color: 'warning' };
    case 'album':
      return { variant: 'filled', color: 'secondary' };
    case 'track':
      return { variant: 'filled', color: 'info' };
    case 'stream':
      return { variant: 'filled', color: 'primary' };
    case 'link':
    default:
      return { variant: 'outlined' };
  }
};

const sourceLabelKey = (command, uri) => {
  switch (command) {
    case 'play_uri':
      if (isSpotify(uri)) return 'spotify';
      if (typeof uri === 'string' && /^https?:/i.test(uri)) return 'stream';
      return 'link';
    case 'play_folder':
    case 'play_card':
      return 'folder';
    case 'play_album':
      return 'album';
    case 'play_single':
      return 'track';
    default:
      return null;
  }
};

const CardListItem = ({ cardId, card, detail = {}, onSelect }) => {
  const { t } = useTranslation();
  const command = card.from_alias;
  const args = (card.action && card.action.args) || [];
  const uri = args[0];

  const fallbackDescription = command
    ? [command, ...args].filter(Boolean).join(', ')
    : card.func;
  const primary = detail.name || fallbackDescription;
  const srcKey = sourceLabelKey(command, uri);
  const artist = detail.artist;

  return (
    <ListItem button onClick={() => onSelect({ cardId, card, detail })}>
      <ListItemAvatar>
        <Avatar variant="rounded" src={detail.image || undefined}>
          {iconForCommand(command)}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={primary}
        primaryTypographyProps={{ noWrap: true }}
        secondaryTypographyProps={{ component: 'div' }}
        secondary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25, minWidth: 0, flexWrap: 'wrap' }}>
            {srcKey && (
              <Chip size="small" {...sourceChipProps(srcKey)} label={t(`cards.source.${srcKey}`)} />
            )}
            {artist && (
              <Typography component="span" variant="caption" color="text.primary" noWrap>
                {artist}
              </Typography>
            )}
            <Typography
              component="span"
              variant="caption"
              color="text.disabled"
              noWrap
              sx={{ ml: 'auto', fontSize: '0.65rem', opacity: 0.7 }}
            >
              {cardId}
            </Typography>
          </Box>
        }
      />
    </ListItem>
  );
};

const CardsList = ({ entries = [], details = {} }) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(null);

  if (entries.length === 0) {
    return <Typography>{t('cards.list.no-cards-registered')}</Typography>;
  }

  return (
    <>
      <List sx={{ width: '100%' }}>
        {entries.map(({ id, card }) => (
          <CardListItem
            key={id}
            cardId={id}
            card={card}
            detail={details[id]}
            onSelect={setSelected}
          />
        ))}
      </List>
      <CardContentDialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        cardId={selected?.cardId}
        card={selected?.card}
        detail={selected?.detail}
      />
    </>
  );
};

export default React.memo(CardsList);
