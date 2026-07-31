import { useContext, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import PubSubContext from '../pubsub/context';
import { emit } from './events';

// Backend notifications carry a translation key plus interpolation params, because the
// user's language is only known here. See jukebox.publishing.notify().
const BackendNotifications = () => {
  const { t } = useTranslation();
  const { state: pubsubState } = useContext(PubSubContext);
  const notification = pubsubState.notification;

  // The publish server replays the last value per topic to every new subscriber, so the
  // id present on mount is history and must not raise a toast.
  const lastSeenId = useRef(null);

  useEffect(() => {
    if (!notification?.id) return;

    if (lastSeenId.current === null) {
      lastSeenId.current = notification.id;
      return;
    }
    if (lastSeenId.current === notification.id) return;

    lastSeenId.current = notification.id;
    emit(notification.severity || 'error', t(notification.key, notification.params));
  }, [notification, t]);

  return null;
};

export default BackendNotifications;
