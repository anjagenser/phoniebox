import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Typography
} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';

import Header from '../Header';
import ActionsControls from './controls/actions-controls';
import ControlsSelector from './controls/controls-selector';
import { getActionAndCommand } from './utils';

const InfoNoCardSwiped = () => {
  const { t } = useTranslation();

  return (
    <Typography>
      {`⚠️ ${t('cards.form.no-card-swiped')}`}
    </Typography>
  );
};

const CardsForm = ({
  title,
  cardId,
  actionData,
  setActionData,
  // Only on registration: editing an existing card always starts with an action
  allowQuickActions = false,
}) => {
  const { t } = useTranslation();
  const [showAllActions, setShowAllActions] = useState(false);
  const { action } = getActionAndCommand(actionData);

  return (
    <>
      <Header title={title} backLink="/cards" />
      <Grid container>
        <Grid item xs={12}>
          <Card elevation={0}>
            <CardHeader
              avatar={
                <Avatar aria-label={t('cards.form.no-card-swiped')}>
                  <BookmarkIcon />
                </Avatar>
              }
              title={
                cardId
                  ? cardId
                  : t('cards.form.no-card-id')
              }
            />
            <CardContent>
              {cardId &&
                <>
                  <Grid container direction="row" alignItems="center">
                    <ControlsSelector
                      actionData={actionData}
                      setActionData={setActionData}
                      cardId={cardId}
                      showAllActions={showAllActions || !allowQuickActions}
                      onShowAllActions={() => setShowAllActions(true)}
                    />
                  </Grid>
                  {action &&
                    <ActionsControls
                      actionData={actionData}
                      cardId={cardId}
                    />
                  }
                </>
              }
              {!cardId && <InfoNoCardSwiped />}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
};



export default CardsForm;
