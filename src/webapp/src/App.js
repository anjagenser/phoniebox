import React, { Suspense } from 'react';

import Grid from '@mui/material/Grid';

import AppSettingsProvider from './context/appsettings';
import PubSubProvider from './context/pubsub';
import PlayerProvider from './context/player';
import ToastProvider from './context/toast';
import BackendNotifications from './context/toast/notifications';
import Router from './router';

function App() {
  return (
    <PubSubProvider>
      <PlayerProvider>
        <AppSettingsProvider>
          <ToastProvider>
            <BackendNotifications />
            <Grid
              alignItems="center"
              container
              direction="row"
              id="routes"
              justifyContent="center"
            >
              <Router />
            </Grid>
          </ToastProvider>
        </AppSettingsProvider>
      </PlayerProvider>
    </PubSubProvider>
  );
}

export default function WrappedApp() {
  return (
    <Suspense fallback="Loading ...">
      <App />
    </Suspense>
  );
}
