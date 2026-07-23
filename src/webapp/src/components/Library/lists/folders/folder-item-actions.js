import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Menu,
  TextField,
} from '@mui/material';

import MoreVertIcon from '@mui/icons-material/MoreVert';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import DeleteIcon from '@mui/icons-material/Delete';

import request from '../../../../utils/request';
import { emit } from '../../../../context/toast/events';
import { ROOT_DIR } from '../../../../config';

// Per-item overflow menu offering Rename / Move / Delete for a library file or
// folder. Menu interactions stop propagation so they never trigger playback.
const FolderItemActions = ({ folder, onChanged }) => {
  const { t } = useTranslation();
  const { type, name, relpath } = folder;

  const [anchorEl, setAnchorEl] = useState(null);
  const [dialog, setDialog] = useState(null); // 'rename' | 'move' | 'delete'
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState(name);
  const [destFolder, setDestFolder] = useState(ROOT_DIR);
  const [dirs, setDirs] = useState([]);

  const stop = (event) => event.stopPropagation();

  const openMenu = (event) => {
    stop(event);
    setAnchorEl(event.currentTarget);
  };

  const closeMenu = (event) => {
    if (event) stop(event);
    setAnchorEl(null);
  };

  const openDialog = (which) => (event) => {
    stop(event);
    setAnchorEl(null);
    if (which === 'rename') setNewName(name);
    if (which === 'move') loadDirs();
    setDialog(which);
  };

  const closeDialog = () => {
    if (busy) return;
    setDialog(null);
  };

  const loadDirs = async () => {
    // Filesystem-based directory list (works on Mopidy, unlike MPD listall).
    const { result } = await request('listDirectories');
    // Drop the item's own folder and anything inside it (cannot move into itself).
    const prefix = `${relpath}/`;
    const list = Array.isArray(result)
      ? result.filter((d) => d && d !== relpath && !d.startsWith(prefix))
      : [];
    setDirs(list);
  };

  const run = async (command, kwargs, successKey) => {
    setBusy(true);
    const { error } = await request(command, kwargs);
    setBusy(false);
    if (!error) {
      emit('success', t(successKey));
      setDialog(null);
      onChanged();
    }
  };

  const handleRename = () =>
    run('renamePath', { rel_path: relpath, new_name: newName.trim() }, 'library.actions.renamed');

  const handleMove = () =>
    run('movePath', { rel_path: relpath, dest_folder: destFolder }, 'library.actions.moved');

  const handleDelete = () =>
    run('deletePath', { rel_path: relpath }, 'library.actions.deleted');

  const dirLabel = (d) => (d === ROOT_DIR ? t('library.actions.root-folder') : d);

  return (
    <>
      <IconButton
        edge="end"
        aria-label={t('library.actions.menu')}
        onClick={openMenu}
      >
        <MoreVertIcon />
      </IconButton>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
        <MenuItem onClick={openDialog('rename')}>
          <DriveFileRenameOutlineIcon fontSize="small" sx={{ mr: 1 }} />
          {t('library.actions.rename')}
        </MenuItem>
        <MenuItem onClick={openDialog('move')}>
          <DriveFileMoveIcon fontSize="small" sx={{ mr: 1 }} />
          {t('library.actions.move')}
        </MenuItem>
        <MenuItem onClick={openDialog('delete')}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          {t('library.actions.delete')}
        </MenuItem>
      </Menu>

      {/* Rename */}
      <Dialog open={dialog === 'rename'} onClose={closeDialog} onClick={stop} fullWidth>
        <DialogTitle>{t('library.actions.rename')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={busy}>{t('general.buttons.cancel')}</Button>
          <Button
            onClick={handleRename}
            disabled={busy || !newName.trim() || newName.trim() === name}
            startIcon={busy ? <CircularProgress size={16} /> : null}
          >
            {t('general.buttons.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move */}
      <Dialog open={dialog === 'move'} onClose={closeDialog} onClick={stop} fullWidth>
        <DialogTitle>{t('library.actions.move-title', { name })}</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            margin="dense"
            label={t('library.actions.destination')}
            value={destFolder}
            onChange={(e) => setDestFolder(e.target.value)}
          >
            <MenuItem value={ROOT_DIR}>{t('library.actions.root-folder')}</MenuItem>
            {dirs.map((d) => (
              <MenuItem key={d} value={d}>{dirLabel(d)}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={busy}>{t('general.buttons.cancel')}</Button>
          <Button
            onClick={handleMove}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={16} /> : null}
          >
            {t('library.actions.move')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete */}
      <Dialog open={dialog === 'delete'} onClose={closeDialog} onClick={stop} fullWidth>
        <DialogTitle>{t('library.actions.delete')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {type === 'directory'
              ? t('library.actions.delete-folder-confirm', { name })
              : t('library.actions.delete-file-confirm', { name })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={busy}>{t('general.buttons.cancel')}</Button>
          <Button
            onClick={handleDelete}
            color="error"
            disabled={busy}
            startIcon={busy ? <CircularProgress size={16} /> : null}
          >
            {t('library.actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FolderItemActions;
