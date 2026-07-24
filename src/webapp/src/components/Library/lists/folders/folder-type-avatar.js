import React from 'react';

import {
  Avatar,
  ListItemAvatar,
} from '@mui/material';

import FolderIcon from '@mui/icons-material/Folder';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import RadioIcon from '@mui/icons-material/Radio';

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
