import React, { forwardRef, useEffect, useState } from 'react';
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

import request from '../../utils/request';
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

const cachePath = (result) =>
  result && result !== 'CACHE_PENDING' ? `/cover-cache/${result}` : null;

const CardListItem = ({ cardId, card }) => {
  const command = card.from_alias;
  const args = (card.action && card.action.args) || [];

  const [coverImage, setCoverImage] = useState(null);
  const [uriName, setUriName] = useState(null);

  // Resolve a cover image (and, for URIs, a readable name) so the cards tab is
  // scannable. Each action type has its own way to look up cover art.
  useEffect(() => {
    let active = true;

    const load = async () => {
      if (command === 'play_uri' && args[0]) {
        const { result } = await request('getUriDetails', { uri: args[0] });
        if (active && result) {
          setUriName(result.name || null);
          setCoverImage(result.image || null);
        }
      } else if (command === 'play_album' && args[0] && args[1]) {
        const { result } = await request('getAlbumCoverArt', {
          albumartist: args[0],
          album: args[1],
        });
        if (active) setCoverImage(cachePath(result));
      } else if (command === 'play_single' && args[0]) {
        const { result } = await request('getSingleCoverArt', { song_url: args[0] });
        if (active) setCoverImage(cachePath(result));
      }
    };

    load();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command, args[0], args[1]]);

  const fallbackDescription = command
    ? reject(isNil, [command, card.action.args]).join(', ')
    : card.func;

  const secondary = uriName || fallbackDescription;

  return (
    <ListItem
      button
      component={EditCardLink}
      data={{ id: cardId, ...card }}
    >
      <ListItemAvatar>
        <Avatar variant="rounded" src={coverImage || undefined}>
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

const CardsList = ({ cardsList }) => {
  const { t } = useTranslation();

  return (
    cardsList && Object.keys(cardsList).length > 0
      ? <List sx={{ width: '100%' }}>
          {Object.keys(cardsList).map((cardId) =>
            <CardListItem
              key={cardId}
              cardId={cardId}
              card={cardsList[cardId]}
            />
          )}
        </List>
      : <Typography>{t('cards.list.no-cards-registered')}</Typography>
  );
}

export default React.memo(CardsList);
