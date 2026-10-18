import React, { useEffect, useMemo, useState } from 'react';
import { without } from 'ramda';

import PubSubContext from './context';
import { initSockets } from '../../sockets';
import { SUBSCRIPTIONS } from '../../config';

const PubSubProvider = ({ children }) => {
  const [state, setState] = useState({});

  useEffect(() => {
    initSockets({
      events: without(['playerstatus'], SUBSCRIPTIONS),
      setState,
    });
  }, []);

  const context = useMemo(() => ({ setState, state }), [state]);

  return(
      <PubSubContext.Provider value={context}>
        { children }
      </PubSubContext.Provider>
    )
};

export default PubSubProvider;
