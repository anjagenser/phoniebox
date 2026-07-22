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

import BookmarkIcon from '@mui/icons-material/Bookmark';
import MusicNoteIcon from '@mui/icons-material/MusicNote';

import request from '../../utils/request';

const EditCardLink = forwardRef((props, ref) => {
  const { data } = props;
  const location = {
    pathname: `/cards/${data.id}/edit`,
    state: data,
  };

  return <Link ref={ref} to={location} {...props} />
});

const CardListItem = ({ cardId, card }) => {
  const isUri = card.from_alias === 'play_uri';
  const uri = isUri && card.action && card.action.args
    ? card.action.args[0]
    : null;

  const [uriName, setUriName] = useState(null);

  // For Spotify / stream cards, resolve the playlist/album/track name so the
  // list shows something readable instead of only the raw URI.
  useEffect(() => {
    let active = true;

    if (uri) {
      (async () => {
        const { result } = await request('getUriName', { uri });
        if (active && result) setUriName(result);
      })();
    }

    return () => { active = false; };
  }, [uri]);

  const fallbackDescription = card.from_alias
    ? reject(isNil, [card.from_alias, card.action.args]).join(', ')
    : card.func;

  const secondary = uriName || fallbackDescription;

  return (
    <ListItem
      button
      component={EditCardLink}
      data={{ id: cardId, ...card }}
    >
      <ListItemAvatar>
        <Avatar>
          {isUri ? <MusicNoteIcon /> : <BookmarkIcon />}
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
