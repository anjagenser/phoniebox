import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';

import request from '../../../utils/request';

const LOG_MAX_CHARS = 50000;

const LogPane = ({ command }) => {
  const { t } = useTranslation();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = async () => {
    setLoading(true);
    const { result } = await request(command);
    setLoading(false);
    if (result !== undefined) {
      const text = String(result);
      setContent(text.length > LOG_MAX_CHARS
        ? `[truncated — showing last ${LOG_MAX_CHARS} chars]\n…${text.slice(-LOG_MAX_CHARS)}`
        : text);
    }
  };

  if (content === null) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={fetch}
          disabled={loading}
        >
          {t('settings.status.logs.load')}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        component="pre"
        sx={{
          fontFamily: 'monospace',
          fontSize: '0.7rem',
          overflowX: 'auto',
          overflowY: 'auto',
          maxHeight: '300px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          backgroundColor: 'action.hover',
          borderRadius: 1,
          p: 1,
          m: 0,
        }}
      >
        {content}
      </Box>
      <Button
        size="small"
        startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
        onClick={fetch}
        disabled={loading}
        sx={{ mt: 0.5 }}
      >
        {t('settings.status.logs.refresh')}
      </Button>
    </Box>
  );
};

const StatusLogs = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);

  return (
    <>
      <Divider />
      <ListItem
        disableGutters
        secondaryAction={
          <Button
            size="small"
            endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? t('settings.status.logs.hide') : t('settings.status.logs.show')}
          </Button>
        }
      >
        <ListItemText
          primary={t('settings.status.logs.title')}
          secondary={t('settings.status.logs.subtitle')}
        />
      </ListItem>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ pb: 1 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="fullWidth"
            textColor="primary"
            indicatorColor="primary"
            sx={{ mb: 1 }}
          >
            <Tab label={t('settings.status.logs.tab-error')} />
            <Tab label={t('settings.status.logs.tab-debug')} />
          </Tabs>
          {tab === 0 && <LogPane command="getLogError" />}
          {tab === 1 && <LogPane command="getLogDebug" />}
        </Box>
      </Collapse>
    </>
  );
};

export default StatusLogs;
