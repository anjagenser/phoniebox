import React from 'react'
import { Route, HashRouter, Routes, useLocation } from 'react-router-dom'

import Cards from './components/Cards';
import Library from './components/Library';
import Navigation from './components/Navigation';
import Player from './components/Player'
import MiniPlayer, { MINI_PLAYER_HEIGHT, NAV_HEIGHT, SAFE_AREA_BOTTOM } from './components/Player/mini-player';
import Settings from './components/Settings'

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
          marginBottom: isHome
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
            path="settings/*"
            element={<Settings/>}
            exact
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
