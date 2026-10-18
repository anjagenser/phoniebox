import React, { useEffect, useMemo, useState } from 'react';

import PlayerContext from './context';
import { initSockets } from '../../sockets';

const PlayerProvider = ({ children }) => {
  const [state, setState] = useState({});

  useEffect(() => {
    initSockets({
      events: ['playerstatus'],
      setState,
    });
  }, []);

  const context = useMemo(() => ({ setState, state }), [state]);

  return(
      <PlayerContext.Provider value={context}>
        { children }
      </PlayerContext.Provider>
    )
};

export default PlayerProvider;
