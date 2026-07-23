import React, { useEffect, useRef, useState } from 'react';
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

import { useTheme } from '@mui/material/styles';

import UploadFileIcon from '@mui/icons-material/UploadFile';
import FolderIcon from '@mui/icons-material/Folder';

import { MINI_PLAYER_HEIGHT, NAV_HEIGHT, SAFE_AREA_BOTTOM } from '../Player/mini-player';

const HOST = (window.location.hostname === 'localhost')
  ? '0.0.0.0'
  : window.location.hostname;

const UPLOAD_URL = `http://${HOST}:8080/upload`;

const Upload = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [isFolder, setIsFolder] = useState(false);
  const [destination, setDestination] = useState('');
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // webkitdirectory / directory are non-standard attributes that React strips
  // from the rendered element, so set them on the DOM node directly to turn the
  // hidden input into a folder picker.
  useEffect(() => {
    const input = folderInputRef.current;
    if (input) {
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
    }
  }, [open]);

  const handleOpen = () => {
    setFiles([]);
    setIsFolder(false);
    setDestination('');
    setOpen(true);
  };

  const handleClose = () => {
    if (!uploading) {
      setOpen(false);
    }
  };

  // Drop OS junk / hidden entries that a folder pick would otherwise sweep in
  // (e.g. .DS_Store, Thumbs.db, resource forks under a leading dot).
  const keepFile = (file) => {
    const name = (file.webkitRelativePath || file.name);
    return !name.split('/').some((seg) => seg.startsWith('.'))
      && name.toLowerCase() !== 'thumbs.db';
  };

  const handleFileChange = (event) => {
    setIsFolder(false);
    setFiles(Array.from(event.target.files).filter(keepFile));
  };

  const handleFolderChange = (event) => {
    setIsFolder(true);
    setFiles(Array.from(event.target.files).filter(keepFile));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);

    const formData = new FormData();
    files.forEach((file) => {
      // For a folder pick, webkitRelativePath ("My Album/track01.mp3") carries
      // the structure so the backend recreates the album folder as-is.
      const name = file.webkitRelativePath || file.name;
      formData.append('files', file, name);
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
          sx={{
            position: 'fixed',
            // Sit above the fixed MiniPlayer bar (which covers the lower band on
            // every non-home page) instead of being hidden beneath it.
            bottom: `calc(${NAV_HEIGHT + MINI_PLAYER_HEIGHT}px + ${SAFE_AREA_BOTTOM} + ${theme.spacing(2)})`,
            right: theme.spacing(2),
            zIndex: theme.zIndex.drawer + 1,
          }}
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
            {!isFolder && files.length > 0 && ` (${files.length})`}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,image/*"
              multiple
              hidden
              onChange={handleFileChange}
            />
          </Button>
          <Button
            variant="outlined"
            component="label"
            startIcon={<FolderIcon />}
          >
            {t('library.upload.select-folder')}
            {isFolder && files.length > 0 && ` (${files.length})`}
            <input
              ref={folderInputRef}
              type="file"
              multiple
              hidden
              onChange={handleFolderChange}
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
          <Alert severity="info" sx={{ py: 0 }}>
            {t('library.upload.cover-hint')}
          </Alert>
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
