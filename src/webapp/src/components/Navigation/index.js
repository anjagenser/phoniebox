import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import BarChartIcon from '@mui/icons-material/BarChart';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import HomeIcon from '@mui/icons-material/Home';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import SettingsIcon from '@mui/icons-material/Settings';

import { NAV_HEIGHT, SAFE_AREA_BOTTOM } from '../Player/mini-player';

export default function Navigation() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [value, setValue] = React.useState(0);

  // TODO: This needs to be done smarter!
  useEffect(() => {
    if (pathname.startsWith('/library')) return setValue(1);
    if (pathname.startsWith('/cards')) return setValue(2);
    if (pathname.startsWith('/statistics')) return setValue(3);
    if (pathname.startsWith('/settings')) return setValue(4);
    return setValue(0);
  }, [pathname]);

  return (
    <BottomNavigation
      value={value}
      onChange={(event, newValue) => {
        setValue(newValue);
      }}
      showLabels
      sx={{
        width: '100%',
        position: 'fixed',
        bottom: '0px',
        height: `${NAV_HEIGHT}px`,
        // Pad the device safe area below the actions so the bar is not hidden
        // behind the mobile home indicator / browser chrome.
        boxSizing: 'content-box',
        paddingBottom: SAFE_AREA_BOTTOM,
      }}
    >
      <BottomNavigationAction
        component={Link}
        to="/"
        label={t('navigation.start')}
        icon={<HomeIcon />}
      />
      <BottomNavigationAction
        component={Link}
        to="/library"
        label={t('navigation.library')}
        icon={<MusicNoteIcon />}
      />
      <BottomNavigationAction
        component={Link}
        to="/cards"
        label={t('navigation.cards')}
        icon={<BookmarksIcon />}
      />
      <BottomNavigationAction
        component={Link}
        to="/statistics"
        label={t('navigation.statistics')}
        icon={<BarChartIcon />}
      />
      <BottomNavigationAction
        component={Link}
        to="/settings"
        label={t('navigation.settings')}
        icon={<SettingsIcon />}
      />
    </BottomNavigation>
  );
}
