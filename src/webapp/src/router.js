import React from 'react'
import { Route, HashRouter, Routes, useLocation } from 'react-router-dom'

import Cards from './components/Cards';
import Labels from './components/Labels';
import Library from './components/Library';
import Navigation from './components/Navigation';
import Player from './components/Player'
import MiniPlayer, { MINI_PLAYER_HEIGHT, NAV_HEIGHT, SAFE_AREA_BOTTOM } from './components/Player/mini-player';
import Settings from './components/Settings'
import Statistics from './components/Statistics'

import Grid from '@mui/material/Grid';

const AppLayout = () => {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <>
      <Grid
        item xs={12}
        md={6}
        sx={{
          // Cap this pane to the viewport and scroll inside it; on Gecko mobile a scrolling body pushes the fixed bottom nav off-screen.
          height: '100vh',
          '@supports (height: 100dvh)': { height: '100dvh' },
          overflowY: 'auto',
          overflowX: 'hidden',
          maxWidth: '100%',
          paddingBottom: isHome
            ? `calc(${NAV_HEIGHT}px + ${SAFE_AREA_BOTTOM})`
            : `calc(${NAV_HEIGHT + MINI_PLAYER_HEIGHT}px + ${SAFE_AREA_BOTTOM})`,
        }}
      >
        <Routes>
          <Route
            index
            element={<Player/>}
            exact
          />
          <Route
            path="library/*"
            element={<Library/>}
          />
          <Route
            path="cards/*"
            element={<Cards/>}
          />
          <Route
            path="labels/*"
            element={<Labels/>}
          />
          <Route
            path="settings/*"
            element={<Settings/>}
            exact
          />
          <Route
            path="statistics/*"
            element={<Statistics/>}
          />
        </Routes>
      </Grid>
      {!isHome && <MiniPlayer />}
      <Navigation />
    </>
  );
};

const Router = () => (
  <HashRouter>
    <AppLayout />
  </HashRouter>
);

export default Router;
