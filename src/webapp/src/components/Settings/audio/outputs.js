import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findIndex, propEq } from 'ramda';

import {
  CircularProgress,
  Grid,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';

import PubSubContext from '../../../context/pubsub/context';
import request from '../../../utils/request';

const Outputs = () => {
  const { t } = useTranslation();
  const { state: pubsubState } = useContext(PubSubContext);
  const publishedSink = pubsubState['volume.sink'];

  const [activeSink, setActiveSink] = useState(null);
  const [sinkList, setSinkList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const setOutput = (event, sink_index) => {
    setActiveSink(sink_index);

    setIsLoading(true);
    (async () => {
      await request('setAudioOutput', { sink_index: parseInt(sink_index) });
    })();
    setIsLoading(false);
  }

  useEffect(() => {
    const fetchAudioOutputs = async () =>  {
      const {
        result: { active_sink, sink_list },
        error
      } = await request('getAudioOutputs');
      setIsLoading(false);

      if (error) {
        setIsError(true);
        return console.error(error);
      }

      const activeSinkIndex = findIndex(
        propEq('pulse_sink_name', active_sink)
      )(sink_list);

      // With a single output, preselect it when the active sink can't be matched.
      const resolvedSinkIndex =
        activeSinkIndex === -1 && sink_list.length === 1 ? 0 : activeSinkIndex;

      setActiveSink(resolvedSinkIndex);
      setSinkList(sink_list);
    }

    fetchAudioOutputs();
  }, []);

  useEffect(() => {
    if (publishedSink?.active_sink && sinkList.length) {
      const index = findIndex(
        propEq('pulse_sink_name', publishedSink.active_sink)
      )(sinkList);
      if (index !== -1) setActiveSink(index);
    }
  }, [publishedSink, sinkList]);

  return (
    <Grid container direction="column">
      <Grid container direction="row" justifyContent="space-between" alignItems="center">
        <Typography>{t('settings.audio.outputs.title')}</Typography>
        {isLoading && <CircularProgress size={20} />}
        {isError && <Typography>⚠️</Typography>}
      </Grid>
      <FormControl component="fieldset">
          <RadioGroup
            aria-label={t('settings.audio.outputs.title')}
            name="audio-outputs"
            value={activeSink}
            onChange={setOutput}
          >
            {sinkList.map(({ alias }, index) =>
              <FormControlLabel
                control={<Radio />}
                label={alias}
                key={index}
                value={index}
              />
            )}
          </RadioGroup>
        </FormControl>
    </Grid>
  );
};

export default Outputs;
