import React from 'react'
import { Route, HashRouter, Routes, useLocation } from 'react-router-dom'

import Cards from './components/Cards';
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
          // Scroll the page content INSIDE this pane rather than letting the
          // document body scroll. On Gecko-based mobile browsers (e.g. iodé),
          // once the folder list makes the body tall enough to scroll, the
          // fixed bottom navigation is repositioned relative to the grown
          // document and pushed off-screen (and scrolling does not recover it).
          // Capping this pane to the viewport height keeps the body from
          // scrolling, so the fixed bars stay anchored to the viewport.
          height: '100vh',
          '@supports (height: 100dvh)': { height: '100dvh' },
          overflowY: 'auto',
          // Contain content width and never scroll sideways within the pane.
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
