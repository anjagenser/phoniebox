import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import {
  Box,
  Button,
  CardActions,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

import CardsAssignWarningDialog from '../dialogs/assign-warning';
import CardsDeleteDialog from '../dialogs/delete';
import request from '../../../utils/request';
import { emit } from '../../../context/toast/events';
import {
  buildCommandKwargs,
  getActionAndCommand,
  getArgsValues,
  getAssignmentWarnings,
} from '../utils';

// Music commands that can be previewed ("play now") from the editor. Other
// actions (shutdown, timers, ...) are intentionally excluded to avoid triggering
// side effects while editing a card.
const PLAYABLE_COMMANDS = ['play_uri', 'play_folder', 'play_album', 'play_single'];

const ActionsControls = ({
  actionData,
  cardId,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { '*': path } = useParams();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);

  const registerCard = async () => {
    const args = getArgsValues(actionData);
    const { command: cmd_alias } = getActionAndCommand(actionData);

    const kwargs = {
      card_id: cardId.toString(),
      cmd_alias,
      overwrite: true,
      ...(args.length && { args }),
    };

    const { error } = await request('registerCard', kwargs);

    if (error) {
      return console.error(error);
    }

    emit('success', t('cards.toasts.saved'));
    navigate('../');
  };

  // Before saving, check whether this assignment overwrites the card's current
  // action or reuses a value already assigned elsewhere. If so, ask the user to
  // confirm; otherwise save straight away.
  const handleRegisterCard = async () => {
    const args = getArgsValues(actionData);
    const { command } = getActionAndCommand(actionData);

    const { result } = await request('cardsList');
    const foundWarnings = getAssignmentWarnings({
      cardId,
      cardsList: result || {},
      command,
      args,
    });

    if (foundWarnings.length) {
      setWarnings(foundWarnings);
      setWarningDialogOpen(true);
      return;
    }

    await registerCard();
  };

  const handleConfirmWarning = async () => {
    setWarningDialogOpen(false);
    await registerCard();
  };

  const { command: currentCommand } = getActionAndCommand(actionData);
  const currentArgs = getArgsValues(actionData);
  const canTest =
    PLAYABLE_COMMANDS.includes(currentCommand) &&
    currentArgs.length > 0 &&
    currentArgs.every((value) => value !== undefined && value !== null && value !== '');

  const handleTest = async () => {
    const kwargs = buildCommandKwargs(currentCommand, currentArgs);
    const { error } = await request(currentCommand, kwargs);
    if (!error) {
      emit('info', t('cards.controls.test-playing'));
    }
  };

  const handleDeleteCard = async () => {
    const { error } = await request('deleteCard', { card_id: cardId });

    // TODO: Better Error handling in frontend
    if (error) {
      return console.error(error);
    }

    emit('success', t('cards.toasts.deleted'));
    navigate('/cards');
  };

  return (
    <>
      <CardActions
        sx={{
          marginTop: '40px',
          justifyContent: path === 'register' ? 'flex-end' : 'space-between'
        }}
      >
        {path !== 'register' &&
          <Button
            color="secondary"
            size="small"
            onClick={() => setDeleteDialogOpen(true)}
          >
            {t('general.buttons.delete')}
          </Button>
        }
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canTest &&
            <Button
              color="primary"
              size="small"
              startIcon={<PlayArrowIcon />}
              onClick={handleTest}
            >
              {t('cards.controls.test')}
            </Button>
          }
          <Button
            color="primary"
            variant="contained"
            onClick={() => handleRegisterCard(cardId)}
            size="small"
          >
            {t('general.buttons.save')}
          </Button>
        </Box>
      </CardActions>
      <CardsDeleteDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        doDelete={handleDeleteCard}
        cardId={cardId}
      />
      <CardsAssignWarningDialog
        open={warningDialogOpen}
        warnings={warnings}
        onConfirm={handleConfirmWarning}
        onCancel={() => setWarningDialogOpen(false)}
      />
    </>
  );
};

export default ActionsControls;
