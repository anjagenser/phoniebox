import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import SkipPreviousRoundedIcon from '@mui/icons-material/SkipPreviousRounded';

import PlayerContext from '../../context/player/context';
import request from '../../utils/request';
import { songDisplayName, songFolderFromUri } from '../../utils/utils';

const MINI_PLAYER_HEIGHT = 56;
const NAV_HEIGHT = 65;
// Bottom safe-area inset so the fixed bar isn't hidden behind device chrome.
const SAFE_AREA_BOTTOM = 'env(safe-area-inset-bottom, 0px)';

const MiniPlayer = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state: { playerstatus } } = useContext(PlayerContext);

  const isPlaying = playerstatus?.state === 'play';
  const songIsScheduled = !!playerstatus?.songid;

  const title = songIsScheduled
    ? (songDisplayName(playerstatus?.title, playerstatus?.file)
       || t('player.display.unknown-title'))
    : t('player.display.no-song-in-queue');
  const artist = songIsScheduled
    ? (playerstatus?.artist || songFolderFromUri(playerstatus?.file))
    : '';

  return (
    <Paper
      elevation={4}
      square
      sx={{
        position: 'fixed',
        bottom: `calc(${NAV_HEIGHT}px + ${SAFE_AREA_BOTTOM})`,
        left: 0,
        right: 0,
        height: MINI_PLAYER_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        zIndex: 1200,
        px: 1,
        gap: 1,
      }}
    >
      <Box
        onClick={() => navigate('/')}
        sx={{
          flex: 1,
          minWidth: 0,
          cursor: 'pointer',
          overflow: 'hidden',
        }}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{ fontWeight: 500, lineHeight: 1.2 }}
        >
          {title}
        </Typography>
        {artist && (
          <Typography variant="caption" noWrap color="text.secondary">
            {artist}
          </Typography>
        )}
      </Box>

      <IconButton
        size="small"
        disabled={!songIsScheduled}
        onClick={() => request('prev_song')}
        aria-label={t('player.controls.prev_song')}
      >
        <SkipPreviousRoundedIcon />
      </IconButton>

      <IconButton
        size="small"
        disabled={!songIsScheduled}
        onClick={() => request(isPlaying ? 'pause' : 'play')}
        aria-label={isPlaying ? t('player.controls.pause') : t('player.controls.play')}
      >
        {isPlaying
          ? <PauseRoundedIcon sx={{ fontSize: 32 }} />
          : <PlayArrowRoundedIcon sx={{ fontSize: 32 }} />
        }
      </IconButton>

      <IconButton
        size="small"
        disabled={!songIsScheduled}
        onClick={() => request('next_song')}
        aria-label={t('player.controls.next_song')}
      >
        <SkipNextRoundedIcon />
      </IconButton>
    </Paper>
  );
};

export { MINI_PLAYER_HEIGHT, NAV_HEIGHT, SAFE_AREA_BOTTOM };
export default MiniPlayer;
