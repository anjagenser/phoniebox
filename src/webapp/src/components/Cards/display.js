import request from '../../utils/request';

const cachePath = (result) =>
  result && result !== 'CACHE_PENDING' ? `/cover-cache/${result}` : null;

// Resolve the display name and cover image for a card's action, so the overview
// can render a readable, searchable list. Returns { name, image } (either may be
// null). Never throws.
export const resolveCardDisplay = async (card) => {
  const command = card.from_alias;
  const args = (card.action && card.action.args) || [];

  try {
    if (command === 'play_uri' && args[0]) {
      const { result } = await request('getUriDetails', { uri: args[0] });
      if (result) {
        // image is a locally-cached cover filename (served from /cover-cache),
        // CACHE_PENDING while it downloads, or null/'' when there is none.
        return { name: result.name || null, image: cachePath(result.image) };
      }
    } else if (command === 'play_album' && args[0] && args[1]) {
      const { result } = await request('getAlbumCoverArt', {
        albumartist: args[0],
        album: args[1],
      });
      return { name: null, image: cachePath(result) };
    } else if (command === 'play_single' && args[0]) {
      const { result } = await request('getSingleCoverArt', { song_url: args[0] });
      return { name: null, image: cachePath(result) };
    } else if ((command === 'play_folder' || command === 'play_card') && args[0]) {
      const folder = args[0];
      const { result } = await request('getFolderCoverArt', { folder });
      // Use the folder's own name as the readable label.
      const name = folder.split('/').filter(Boolean).pop() || folder;
      return { name, image: cachePath(result) };
    }
  } catch (e) {
    // Resolution is best-effort; fall through to an empty result.
  }

  return { name: null, image: null };
};

export default resolveCardDisplay;
