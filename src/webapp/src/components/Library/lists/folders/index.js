import React, { useCallback, useContext, useEffect, useState } from "react";
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";

import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';

import AppSettingsContext from '../../../../context/appsettings/context';
import request from '../../../../utils/request';
import { emit } from '../../../../context/toast/events';
import FolderList from "./folder-list";

import { ROOT_DIR } from '../../../../config';

const cachePath = (result) =>
  result && result !== 'CACHE_PENDING' ? `/cover-cache/${result}` : null;

const Folders = ({
  musicFilter,
  isSelecting,
  registerMusicToCard,
  isAssigned,
  showAll = true,
}) => {
  const { t } = useTranslation();
  const { dir = ROOT_DIR } = useParams();
  const decodedDir = decodeURIComponent(dir);

  const { settings } = useContext(AppSettingsContext);
  const showCovers = settings?.show_covers;

  const [folders, setFolders] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [folderCover, setFolderCover] = useState(null);
  const [covers, setCovers] = useState({});

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchFolderList = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { result, error } = await request('folderList', { folder: decodedDir });
    setIsLoading(false);

    if (result) setFolders(result);
    if (error) setError(error);
  }, [decodedDir]);

  useEffect(() => { fetchFolderList(); }, [fetchFolderList]);

  // Fetch all sub-folder covers in a single batched call (one RPC instead of one
  // per row, which used to flood the RPC server and time out the folder listing).
  useEffect(() => {
    let active = true;
    setCovers({});
    if (!showCovers) return;
    request('getFolderCovers', { folder: decodedDir }).then(({ result }) => {
      if (!active || !result) return;
      const mapped = {};
      Object.entries(result).forEach(([rel, value]) => {
        mapped[rel] = cachePath(value);
      });
      setCovers(mapped);
    });
    return () => { active = false; };
  }, [decodedDir, showCovers, folders]);

  // Cover of the folder currently being browsed (shown as a header thumbnail).
  useEffect(() => {
    let active = true;
    setFolderCover(null);
    if (decodedDir !== ROOT_DIR && showCovers) {
      request('getFolderCoverArt', { folder: decodedDir }).then(({ result }) => {
        if (active) setFolderCover(cachePath(result));
      });
    }
    return () => { active = false; };
  }, [decodedDir, showCovers, folders]);

  const search = ({ name }) => {
    if (musicFilter === '') return true;
    return name.toLowerCase().includes(musicFilter.toLowerCase());
  };

  // When picking music for a card, optionally hide items already assigned.
  const assignedFilter = (folder) => {
    if (!isSelecting || showAll || !isAssigned) return true;
    return !isAssigned(folder);
  };

  const handleCreateFolder = async () => {
    setBusy(true);
    const { error } = await request('createFolder', {
      parent: decodedDir,
      name: newFolderName.trim(),
    });
    setBusy(false);
    if (!error) {
      emit('success', t('library.actions.folder-created'));
      setNewFolderOpen(false);
      setNewFolderName('');
      fetchFolderList();
    }
  };

  const filteredFolders = folders.filter(search).filter(assignedFilter);

  const folderName = decodedDir === ROOT_DIR
    ? null
    : decodedDir.split('/').filter(Boolean).pop();

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header: current folder cover/name + New folder action */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1, gap: 1 }}>
        {folderName && (
          <>
            {folderCover && (
              <Avatar src={folderCover} variant="rounded" sx={{ width: 48, height: 48 }} />
            )}
            <Typography variant="subtitle1" noWrap sx={{ flex: 1, minWidth: 0 }}>
              {folderName}
            </Typography>
          </>
        )}
        {!isSelecting && (
          <Button
            size="small"
            startIcon={<CreateNewFolderIcon />}
            onClick={() => setNewFolderOpen(true)}
            sx={{ ml: 'auto' }}
          >
            {t('library.actions.new-folder')}
          </Button>
        )}
      </Box>

      {isLoading && <CircularProgress />}
      {!isLoading && error && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, p: 2 }}>
          <Typography>{t('library.loading-error')}</Typography>
          <Button variant="outlined" onClick={fetchFolderList}>
            {t('library.actions.retry')}
          </Button>
        </Box>
      )}
      {!isLoading && !error && musicFilter && !filteredFolders.length && (
        <Typography>{t('library.folders.no-music')}</Typography>
      )}
      {!isLoading && !error && (!musicFilter || filteredFolders.length > 0) && (
        <FolderList
          dir={dir}
          folders={filteredFolders}
          isSelecting={isSelecting}
          registerMusicToCard={registerMusicToCard}
          onChanged={fetchFolderList}
        />
      )}

      {/* New folder dialog */}
      <Dialog open={newFolderOpen} onClose={() => !busy && setNewFolderOpen(false)} fullWidth>
        <DialogTitle>{t('library.actions.new-folder')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={t('library.actions.folder-name')}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderOpen(false)} disabled={busy}>
            {t('general.buttons.cancel')}
          </Button>
          <Button
            onClick={handleCreateFolder}
            disabled={busy || !newFolderName.trim()}
            startIcon={busy ? <CircularProgress size={16} /> : null}
          >
            {t('general.buttons.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Folders;
