import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Fab from '@mui/material/Fab';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';

import UploadFileIcon from '@mui/icons-material/UploadFile';

const HOST = (window.location.hostname === 'localhost')
  ? '0.0.0.0'
  : window.location.hostname;

const UPLOAD_URL = `http://${HOST}:8080/upload`;

const Upload = () => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [destination, setDestination] = useState('');
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const handleOpen = () => {
    setFiles([]);
    setDestination('');
    setOpen(true);
  };

  const handleClose = () => {
    if (!uploading) {
      setOpen(false);
    }
  };

  const handleFileChange = (event) => {
    setFiles(Array.from(event.target.files));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    if (destination.trim()) {
      formData.append('folder', destination.trim());
    }

    try {
      const response = await fetch(UPLOAD_URL, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setSnackbar({
          open: true,
          message: t('library.upload.success', { count: files.length }),
          severity: 'success',
        });
        setOpen(false);
      } else {
        const text = await response.text();
        setSnackbar({
          open: true,
          message: t('library.upload.error', { message: text || response.statusText }),
          severity: 'error',
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: t('library.upload.error', { message: error.message }),
        severity: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <>
      <Tooltip title={t('library.upload.button-label')}>
        <Fab
          color="primary"
          aria-label={t('library.upload.button-label')}
          onClick={handleOpen}
          sx={{ position: 'fixed', bottom: 24, right: 24 }}
        >
          <UploadFileIcon />
        </Fab>
      </Tooltip>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>{t('library.upload.dialog-title')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '16px !important' }}>
          <Button
            variant="outlined"
            component="label"
            startIcon={<UploadFileIcon />}
          >
            {t('library.upload.select-files')}
            {files.length > 0 && ` (${files.length})`}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              multiple
              hidden
              onChange={handleFileChange}
            />
          </Button>
          <TextField
            label={t('library.upload.destination-label')}
            placeholder={t('library.upload.destination-placeholder')}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            size="small"
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={uploading}>
            {t('library.upload.cancel')}
          </Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={files.length === 0 || uploading}
            startIcon={uploading ? <CircularProgress size={16} /> : null}
          >
            {t('library.upload.upload-button')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default Upload;
