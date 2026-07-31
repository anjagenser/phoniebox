import React, { useContext, useEffect, useState } from 'react';

import Grid from '@mui/material/Grid';

import Cover from './cover';
import Controls from './controls';
import Display from './display';
import SeekBar from './seekbar';
import Volume from './volume';

import AppSettingsContext from '../../context/appsettings/context';
import PlayerContext from '../../context/player/context';
import request from '../../utils/request';
import { NAV_HEIGHT, SAFE_AREA_BOTTOM } from './mini-player';

const Player = () => {
  const { state: { playerstatus } } = useContext(PlayerContext);
  const { file } = playerstatus || {};

  const [coverImage, setCoverImage] = useState(undefined);
  const [backgroundImage, setBackgroundImage] = useState('none');

  const {
    settings,
  } = useContext(AppSettingsContext);

  const { show_covers } = settings;

  useEffect(() => {
    // The cover art is extracted in a background thread, so the first lookup of a
    // yet uncached song answers CACHE_PENDING. Retry a few times before giving up.
    const PENDING_RETRIES = 3;
    const PENDING_RETRY_DELAY = 700;

    let active = true;
    let retryTimer;

    const clearCover = () => {
      setCoverImage(undefined);
      setBackgroundImage('none');
    };

    const getCoverArt = async (attempt = 0) => {
      const { result } = await request('getSingleCoverArt', { song_url: file });
      if (!active) return;

      if (result === 'CACHE_PENDING') {
        if (attempt < PENDING_RETRIES) {
          retryTimer = setTimeout(() => getCoverArt(attempt + 1), PENDING_RETRY_DELAY);
          return;
        }
        clearCover();
        return;
      }

      // A song without cover art answers with an empty result. Clear the image,
      // otherwise the cover of the previously played card stays on screen.
      if (!result) {
        clearCover();
        return;
      }

      setCoverImage(`/cover-cache/${result}`);
      setBackgroundImage([
        'linear-gradient(to bottom, rgba(18, 18, 18, 0.5), rgba(18, 18, 18, 1))',
        `url(/cover-cache/${result})`
      ].join(','));
    }

    if (file && show_covers) {
      getCoverArt();
    } else {
      clearCover();
    }

    return () => {
      active = false;
      clearTimeout(retryTimer);
    };
  }, [file, show_covers]);

  return (
    <Grid
      container
      id="player"
      sx={{
        backgroundImage,
        backgroundPosition: 'center',
      }}
    >
      <Grid
        container
        sx={{
          paddingTop: '30px',
          paddingLeft: '30px',
          paddingRight: '30px',
          // dvh minus the fixed bottom nav; a raw 100vh overflowed the pane.
          minHeight: `calc(100vh - ${NAV_HEIGHT}px - ${SAFE_AREA_BOTTOM})`,
          '@supports (height: 100dvh)': {
            minHeight: `calc(100dvh - ${NAV_HEIGHT}px - ${SAFE_AREA_BOTTOM})`,
          },
          backdropFilter: 'blur(25px)',
        }}
      >
        <Grid item xs={12} sm={5}>
          <Cover coverImage={coverImage} />
        </Grid>
        <Grid item xs={12} sm={7}>
          <Display />
          <SeekBar />
          <Controls />
          <Volume />
        </Grid>
      </Grid>
    </Grid>
  );
};

export default Player;
