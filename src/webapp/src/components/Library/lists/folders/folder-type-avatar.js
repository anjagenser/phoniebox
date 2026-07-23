import React from 'react';

import {
  Avatar,
  ListItemAvatar,
} from '@mui/material';

import FolderIcon from '@mui/icons-material/Folder';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import RadioIcon from '@mui/icons-material/Radio';

// When a folder has a cover (a cover.* image or embedded art on its first
// track), render it as the avatar image; otherwise fall back to the type icon.
const FolderTypeAvatar = ({ type, coverImage }) => (
  <ListItemAvatar>
    <Avatar src={coverImage || undefined} variant={coverImage ? 'rounded' : 'circular'}>
      {type === 'directory' && <FolderIcon />}
      {type === 'file' && <MusicNoteIcon />}
      {type === 'podcast' && <PodcastsIcon />}
      {type === 'stream' && <RadioIcon />}
    </Avatar>
  </ListItemAvatar>
);

export default FolderTypeAvatar;
