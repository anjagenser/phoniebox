import React, { useEffect, useState } from 'react';

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

  const context = {
    setState,
    state,
  };

  return(
      <PlayerContext.Provider value={context}>
        { children }
      </PlayerContext.Provider>
    )
};

export default PlayerProvider;
