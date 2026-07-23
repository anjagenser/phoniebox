import React from "react";
import { useTranslation } from 'react-i18next';

import {
  Button,
  FormControlLabel,
  Grid,
  Switch,
  Typography,
} from "@mui/material";

import { useTheme } from '@mui/material/styles';
import { Link } from "react-router-dom";

const SelectorHeader = ({ showAll, setShowAll }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Grid container sx={{
      backgroundColor: theme.palette.primary.main,
      padding: '10px',
      position: 'sticky',
      top: '0',
      zIndex: '1000',
    }}>
      <Grid
        item
        xs={12}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography>
          {t('library.selector-header.title')}
        </Typography>
        <Button
          component={Link}
          to={'/cards/register'}
          color="secondary"
          size="small"
          variant="contained"
        >
          {t('general.buttons.cancel')}
        </Button>
      </Grid>
      <Grid item xs={12}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={!!showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              color="secondary"
            />
          }
          label={t('library.selector-header.show-all')}
        />
      </Grid>
    </Grid>
  );
}

export default SelectorHeader;
