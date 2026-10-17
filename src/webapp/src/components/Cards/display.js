import request from '../../utils/request';

const cachePath = (result) =>
  result && result !== 'CACHE_PENDING' ? `/cover-cache/${result}` : null;

const EMPTY = { name: null, artist: null, image: null };

// One request for all cards: per-card requests queued behind each other on the socket.
export const resolveCardsDisplay = async (cards) => {
  if (!cards || !Object.keys(cards).length) return {};
  const { result } = await request('getCardsDisplay', { cards });
  const resolved = {};
  Object.keys(cards).forEach((id) => {
    const entry = (result && result[id]) || {};
    resolved[id] = entry.image === undefined
      ? { ...EMPTY }
      : { name: entry.name || null, artist: entry.artist || null, image: cachePath(entry.image) };
  });
  return resolved;
};

export default resolveCardsDisplay;
