import React, { useCallback, useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

import { subscribe } from './events';

const AUTO_HIDE_MS = 5000;
const MAX_QUEUED = 5;

const ToastProvider = ({ children }) => {
  const [queue, setQueue] = useState([]);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    return subscribe(({ severity, message }) => {
      setQueue((prev) => {
        if (prev.length >= MAX_QUEUED) return prev;
        return [...prev, { severity, message, key: Date.now() + Math.random() }];
      });
    });
  }, []);

  useEffect(() => {
    if (!open && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue((prev) => prev.slice(1));
      setOpen(true);
    }
  }, [open, queue]);

  const handleClose = useCallback((_, reason) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  }, []);

  return (
    <>
      {children}
      <Snackbar
        key={current?.key}
        open={open}
        autoHideDuration={AUTO_HIDE_MS}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={handleClose}
          severity={current?.severity || 'error'}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {current?.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ToastProvider;
