import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, ListItem, ListItemText, Typography } from '@mui/material';
import { Countdown } from '../../general';
import SetTimerDialog from './set-timer-dialog';
import request from '../../../utils/request';

// Custom hook to manage timer state and logic
const useTimer = (type) => {
  const pluginName = `timer_${type.replace('-', '_')}`;
  const [timerState, setTimerState] = useState({
    error: null,
    enabled: false,
    isLoading: true,
    status: { enabled: false },
    waitSeconds: 0,
    running: true
  });

  const fetchTimerStatus = useCallback(async () => {
    try {
      const { result: timerStatus, error: timerStatusError } = await request(`${pluginName}.get_state`);

      if (timerStatusError) {
        throw timerStatusError;
      }

      setTimerState(prev => ({
        ...prev,
        status: timerStatus,
        enabled: timerStatus?.enabled,
        running: timerStatus.running ?? true,
        error: null,
        isLoading: false
      }));
    } catch (error) {
      setTimerState(prev => ({
        ...prev,
        enabled: false,
        error,
        isLoading: false
      }));
    }
  }, [pluginName]);

  const cancelTimer = async () => {
    try {
      await request(`${pluginName}.cancel`);
      setTimerState(prev => ({ ...prev, enabled: false }));
    } catch (error) {
      setTimerState(prev => ({ ...prev, error }));
    }
  };

  const setTimer = async (wait_seconds) => {
    try {
      await cancelTimer();
      if (wait_seconds > 0) {
        await request(pluginName, { wait_seconds });
        await fetchTimerStatus();
      }
    } catch (error) {
      setTimerState(prev => ({ ...prev, error }));
    }
  };

  const setWaitSeconds = (seconds) => {
    setTimerState(prev => ({ ...prev, waitSeconds: seconds }));
  };

  useEffect(() => {
    fetchTimerStatus();
  }, [fetchTimerStatus]);

  return {
    ...timerState,
    setTimer,
    cancelTimer,
    setWaitSeconds
  };
};

// Separate component for timer actions
const TimerActions = ({ enabled, running, status, error, isLoading, type, onSetTimer, onCancelTimer, waitSeconds, onSetWaitSeconds }) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', marginLeft: '0' }}>
      {enabled && running && (
        <Countdown
          seconds={status.remaining_seconds}
          onEnd={() => onCancelTimer()}
          stringEnded={t('settings.timers.ended')}
        />
      )}
      {enabled && !running && (
        <Typography>{t('settings.timers.paused')}</Typography>
      )}
      {error && <Typography>⚠️</Typography>}
      {!isLoading && (
        <SetTimerDialog
          type={type}
          enabled={enabled}
          setTimer={onSetTimer}
          cancelTimer={onCancelTimer}
          waitSeconds={waitSeconds}
          setWaitSeconds={onSetWaitSeconds}
        />
      )}
    </Box>
  );
};

const Timer = ({ type }) => {
  const { t } = useTranslation();
  const timer = useTimer(type);

  return (
    // Lay out text and actions with flexbox instead of an absolutely-positioned
    // secondaryAction, so on narrow (mobile) screens the actions wrap below the
    // text instead of overlapping the "Set timer" button.
    <ListItem
      disableGutters
      sx={{ flexWrap: 'wrap', gap: 1, justifyContent: 'space-between' }}
    >
      <ListItemText
        primary={t(`settings.timers.${type}.title`)}
        secondary={t(`settings.timers.${type}.label`)}
        sx={{ flex: '1 1 auto', minWidth: 0, my: 0 }}
      />
      <TimerActions
        {...timer}
        onSetTimer={timer.setTimer}
        onCancelTimer={timer.cancelTimer}
        onSetWaitSeconds={timer.setWaitSeconds}
        type={type}
      />
    </ListItem>
  );
};

export default Timer;
