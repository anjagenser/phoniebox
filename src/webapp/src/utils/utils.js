const progressToTime = (duration, progress) => duration * progress / 100;
const timeToProgress = (duration, elapsed) => elapsed * 100 / duration;

const toHHMMSS = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  return [
    h,
    m > 9 ? m : (h ? '0' + m : m || '0'),
    s > 9 ? s : '0' + (isNaN(s) ? '0' : s)
  ].filter(Boolean).join(':');
}

const decodeUri = (value) => {
  try {
    return decodeURIComponent(value);
  }
  catch (error) {
    return value;
  }
};

// 'local:track:My%20Folder/My%20Song.mp3' -> 'My Folder/My Song.mp3'
const uriToPath = (uri) => decodeUri(uri || '')
  .replace(/^file:\/\//, '')
  .replace(/^[a-z0-9+.-]+:(track|directory|album|artist|playlist):/i, '');

const AUDIO_EXTENSION = /\.(mp3|m4a|m4b|mp4|aac|flac|ogg|oga|opus|wav|wma|aif|aiff)$/i;

// Mopidy reports untagged local files with the file name as title, extension included
const stripAudioExtension = (name) => (name || '').replace(AUDIO_EXTENSION, '');

// Readable song name from a file or uri. Empty for uris that carry no file name
// (e.g. 'spotify:track:<id>'), so callers can fall back to a generic label.
const songNameFromUri = (uri) => {
  const path = uriToPath(uri);
  const name = path.split('/').pop();
  if (!name || !(path.includes('/') || AUDIO_EXTENSION.test(name))) return '';
  return stripAudioExtension(name);
};

// Song name to show for a player status or library entry
const songDisplayName = (title, uri) => stripAudioExtension(title) || songNameFromUri(uri);

// Folder a song lives in, used where no album tag is available
const songFolderFromUri = (uri) => {
  const parts = uriToPath(uri).split('/');
  return parts.length > 1 ? parts[parts.length - 2] : '';
};

const pluginIsLoaded = (pluginList = {}, _package) => {
  return Object.keys(pluginList).includes(_package)
}

const flatByAlbum = (albumList, { albumartist, album }) => {
  const list = Array.isArray(album)
    ? album.map(name => ({ albumartist, album: name }))
    : [{ albumartist, album }];

  return [...albumList, ...list];
};


export {
  flatByAlbum,
  pluginIsLoaded,
  progressToTime,
  songDisplayName,
  songFolderFromUri,
  songNameFromUri,
  timeToProgress,
  toHHMMSS,
  uriToPath,
}
