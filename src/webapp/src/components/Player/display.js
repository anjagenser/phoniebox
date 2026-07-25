import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';

import PlayerContext from '../../context/player/context';

import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import { songDisplayName, songFolderFromUri } from '../../utils/utils';

const Display = () => {
  const { t } = useTranslation();
  const { state: { playerstatus } } = useContext(PlayerContext);

  const dontBreak = {
    whiteSpace: 'nowrap',
    width: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const hasSong = !!playerstatus?.songid;
  const title = songDisplayName(playerstatus?.title, playerstatus?.file)
    || t('player.display.unknown-title');
  const details = [
    playerstatus?.artist,
    playerstatus?.album || songFolderFromUri(playerstatus?.file),
  ].filter(Boolean).join(' • ');

  return (
    <Grid container>
      <Typography sx={dontBreak} component="h5" variant="h5">
        {hasSong ? title : t('player.display.no-song-in-queue')}
      </Typography>
      <Typography sx={dontBreak} variant="subtitle1" color="textSecondary">
        {hasSong && (details || t('player.display.unknown-artist'))}
      </Typography>
    </Grid>
  );
};

export default Display;
