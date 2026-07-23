import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Box,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';

import NavigateNextIcon from '@mui/icons-material/NavigateNext';

import AppSettingsContext from '../../../../context/appsettings/context';
import request from '../../../../utils/request';
import FolderLink from './folder-link';
import FolderTypeAvatar from './folder-type-avatar';
import FolderItemActions from './folder-item-actions';

const cachePath = (result) =>
  result && result !== 'CACHE_PENDING' ? `/cover-cache/${result}` : null;

const FolderListItem = ({
  folder,
  isSelecting,
  registerMusicToCard,
  onChanged,
}) => {
  const { t } = useTranslation();
  const { type, name, relpath } = folder;

  const { settings } = useContext(AppSettingsContext);
  const showCovers = settings?.show_covers;

  const [coverImage, setCoverImage] = useState(null);

  useEffect(() => {
    let active = true;
    if (type === 'directory' && showCovers) {
      request('getFolderCoverArt', { folder: relpath }).then(({ result }) => {
        if (active) setCoverImage(cachePath(result));
      });
    }
    return () => { active = false; };
  }, [type, relpath, showCovers]);

  const playItem = () => {
    switch(type) {
      case 'directory': return request('play_folder', { folder: relpath, recursive: true });
      case 'file': return request('play_single', { song_url: relpath });
      // TODO: Add missing Podcast
      // TODO: Add missing Stream
      default: return;
    }
  }

  const registerItemToCard = () => {
    switch(type) {
      case 'directory': return registerMusicToCard('play_folder', { folder: relpath, recursive: true });
      case 'file': return registerMusicToCard('play_single', { song_url: relpath });
      // TODO: Add missing Podcast
      // TODO: Add missing Stream
      default: return;
    }
  }

  return (
    <ListItem
      disablePadding
      secondaryAction={
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {!isSelecting && (
            <FolderItemActions folder={folder} onChanged={onChanged} />
          )}
          {type === 'directory' && (
            <IconButton
              component={FolderLink}
              data={{ dir: relpath }}
              edge="end"
              aria-label={t('library.folders.show-folder-content')}
            >
              <NavigateNextIcon />
            </IconButton>
          )}
        </Box>
      }
    >
      <ListItemButton onClick={() => (isSelecting ? registerItemToCard() : playItem())}>
        <FolderTypeAvatar type={type} coverImage={coverImage} />
        <ListItemText primary={name} />
      </ListItemButton>
    </ListItem>
  );
}

export default FolderListItem;
