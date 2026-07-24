import { useCallback, useEffect, useRef,  useState } from 'react';

import { toHHMMSS } from '../../utils/utils';

const Countdown = ({ onEnd, seconds, stringEnded = undefined }) => {
  // Guard against setState on an unmounted component (React #14227).
  const isMounted = useRef(null);
  const [time, setTime] = useState(seconds);

  const onEndCallback = useCallback(() => onEnd(), [onEnd]);

  useEffect(() => {
    isMounted.current = true;

    if (time === 0) return onEndCallback();
    setTimeout(() => {
      if (isMounted.current) setTime(time - 1)
    }, 1000);

    return () => {
      isMounted.current = false;
    }
  }, [onEndCallback, time]);

  if (time) return toHHMMSS(Math.round(time));
  if (stringEnded) return stringEnded;
  return toHHMMSS(0);
}

export default Countdown;
