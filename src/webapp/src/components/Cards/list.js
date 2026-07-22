import React, { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { isNil, reject } from 'ramda';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography
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

const EditCardLink = forwardRef((props, ref) => {
  const { data } = props;
  const location = {
    pathname: `/cards/${data.id}/edit`,
    state: data,
  };

  return <Link ref={ref} to={location} {...props} />
});

// Icon shown when no cover art is available, chosen by the card's action.
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

const CardListItem = ({ cardId, card, detail = {} }) => {
  const command = card.from_alias;

  const fallbackDescription = command
    ? reject(isNil, [command, card.action.args]).join(', ')
    : card.func;

  const secondary = detail.name || fallbackDescription;

  return (
    <ListItem
      button
      component={EditCardLink}
      data={{ id: cardId, ...card }}
    >
      <ListItemAvatar>
        <Avatar variant="rounded" src={detail.image || undefined}>
          {iconForCommand(command)}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={cardId}
        secondary={secondary}
      />
    </ListItem>
  );
};

const CardsList = ({ entries = [], details = {} }) => {
  const { t } = useTranslation();

  return (
    entries.length > 0
      ? <List sx={{ width: '100%' }}>
          {entries.map(({ id, card }) =>
            <CardListItem
              key={id}
              cardId={id}
              card={card}
              detail={details[id]}
            />
          )}
        </List>
      : <Typography>{t('cards.list.no-cards-registered')}</Typography>
  );
}

export default React.memo(CardsList);
