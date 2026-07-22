import React from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

// Confirmation dialog shown before a card assignment is saved when it would
// either overwrite an existing action (Feature 4) or duplicate a value that is
// already assigned to another card (Feature 5).
const CardsAssignWarningDialog = ({ open, warnings = [], onConfirm, onCancel }) => {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="assign-warning-dialog-title"
      aria-describedby="assign-warning-dialog-description"
    >
      <DialogTitle id="assign-warning-dialog-title">
        {t('cards.dialogs.assign-warning.title')}
      </DialogTitle>
      <DialogContent id="assign-warning-dialog-description">
        {warnings.map((warning, index) => (
          <DialogContentText key={index} sx={{ marginBottom: '12px' }}>
            {warning.type === 'reassign'
              ? t('cards.dialogs.assign-warning.reassign')
              : t('cards.dialogs.assign-warning.duplicate', {
                  cardIds: (warning.cardIds || []).join(', '),
                  count: (warning.cardIds || []).length,
                })}
          </DialogContentText>
        ))}
        <DialogContentText>
          {t('cards.dialogs.assign-warning.question')}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="primary" autoFocus>
          {t('general.buttons.cancel')}
        </Button>
        <Button onClick={onConfirm} color="secondary">
          {t('cards.dialogs.assign-warning.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CardsAssignWarningDialog;
