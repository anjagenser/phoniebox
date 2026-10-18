import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  Typography,
} from '@mui/material';

import request from '../../utils/request';
import { emit } from '../../context/toast/events';

// A settings card with a description and one button that runs a single command.
const ActionCard = ({ command, textKey, buttonKey, doneKey, icon }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    const { error } = await request(command);
    setBusy(false);
    if (!error) {
      emit('success', t(`${textKey}.${doneKey}`));
    }
  };

  return (
    <Card>
      <CardHeader title={t(`${textKey}.title`)} />
      <Divider />
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(`${textKey}.description`)}
        </Typography>
        <Button
          variant="outlined"
          startIcon={busy ? <CircularProgress size={16} /> : icon}
          onClick={handleClick}
          disabled={busy}
        >
          {t(`${textKey}.${buttonKey}`)}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ActionCard;
