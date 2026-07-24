import React from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

const CardsDeleteDialog = ({ open, onClose, doDelete, deleting, cardId }) => {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        {t('cards.dialogs.delete.title', { cardId })}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          {t('cards.dialogs.delete.description')}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" autoFocus disabled={deleting}>
          {t('general.buttons.cancel')}
        </Button>
        <Button
          onClick={doDelete}
          color="secondary"
          disabled={deleting}
          startIcon={deleting ? <CircularProgress size={16} /> : null}
        >
          {t('general.buttons.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CardsDeleteDialog;
