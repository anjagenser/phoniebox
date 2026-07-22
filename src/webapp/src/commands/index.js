const commands = {
  getSingleCoverArt: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'get_single_coverart',
  },
  getAlbumCoverArt: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'get_album_coverart',
  },
  directoryTreeOfAudiofolder: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'list_all_dirs',
  },
  albumList: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'list_albums',
  },
  songList: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'list_songs_by_artist_and_album',
  },
  getSongByUrl: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'get_song_by_url',
    argKeys: ['song_url']
  },
  getUriName: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'get_uri_name',
    argKeys: ['uri'],
  },
  getUriDetails: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'get_uri_details',
    argKeys: ['uri'],
  },
  folderList: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'get_folder_content',
  },
  cardsList: {
    _package: 'cards',
    plugin: 'list_cards',
  },
  registerCard: {
    _package: 'cards',
    plugin: 'register_card',
  },
  deleteCard: {
    _package: 'cards',
    plugin: 'delete_card',
  },
  exportCards: {
    _package: 'cards',
    plugin: 'export_card_database',
  },
  importCards: {
    _package: 'cards',
    plugin: 'import_card_database',
    argKeys: ['cards', 'merge'],
  },
  playerstatus: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'playerstatus'
  },

  // Player Actions
  play: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'play',
  },
  play_single: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'play_single',
    argKeys: ['song_url']
  },
  play_folder: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'play_folder',
    argKeys: ['folder']
  },
  play_album: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'play_album',
    argKeys: ['albumartist', 'album']
  },
  play_uri: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'play_uri',
    argKeys: ['uri'],
  },
  get_folder_config: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'get_folder_config',
    argKeys: ['folder'],
  },
  set_folder_config: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'set_folder_config',
    argKeys: ['folder', 'resume', 'shuffle', 'loop', 'single'],
  },
  pause: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'pause',
  },
  prev_song: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'prev',
  },
  next_song: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'next',
  },
  toggle: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'toggle',
  },
  shuffle: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'shuffle',
    argKeys: ['option'],
  },
  repeat: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'repeat',
    argKeys: ['option'],
  },
  seek: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'seek',
  },

  // Volume
  setVolume: {
    _package: 'volume',
    plugin: 'ctrl',
    method: 'set_volume',
    argKeys: ['volume'],
  },
  getVolume: {
    _package: 'volume',
    plugin: 'ctrl',
    method: 'get_volume',
  },
  getMaxVolume: {
    _package: 'volume',
    plugin: 'ctrl',
    method: 'get_soft_max_volume',
  },
  setMaxVolume: {
    _package: 'volume',
    plugin: 'ctrl',
    method: 'set_soft_max_volume',
  },
  change_volume: {
    _package: 'volume',
    plugin: 'ctrl',
    method: 'change_volume',
    argKeys: ['step'],
  },
  toggleMuteVolume: {
    _package: 'volume',
    plugin: 'ctrl',
    method: 'mute',
  },
  getAudioOutputs: {
    _package: 'volume',
    plugin: 'ctrl',
    method: 'get_outputs',
  },
  setAudioOutput: {
    _package: 'volume',
    plugin: 'ctrl',
    method: 'set_output',
    argKeys: ['sink_index'],
  },
  toggle_output: {
    _package: 'volume',
    plugin: 'ctrl',
    method: 'toggle_output',
  },

  // Timers
  'timer_fade_volume.cancel': {
    _package: 'timers',
    plugin: 'timer_fade_volume',
    method: 'cancel',
  },
  'timer_fade_volume.get_state': {
    _package: 'timers',
    plugin: 'timer_fade_volume',
    method: 'get_state',
  },
  'timer_fade_volume': {
    _package: 'timers',
    plugin: 'timer_fade_volume',
    method: 'start',
    argKeys: ['wait_seconds'],
  },
  'timer_shutdown.cancel': {
    _package: 'timers',
    plugin: 'timer_shutdown',
    method: 'cancel',
  },
  'timer_shutdown.get_state': {
    _package: 'timers',
    plugin: 'timer_shutdown',
    method: 'get_state',
  },
  'timer_shutdown': {
    _package: 'timers',
    plugin: 'timer_shutdown',
    method: 'start',
    argKeys: ['wait_seconds'],
  },
  'timer_stop_player.cancel': {
    _package: 'timers',
    plugin: 'timer_stop_player',
    method: 'cancel',
  },
  'timer_stop_player.get_state': {
    _package: 'timers',
    plugin: 'timer_stop_player',
    method: 'get_state',
  },
  'timer_stop_player': {
    _package: 'timers',
    plugin: 'timer_stop_player',
    method: 'start',
    argKeys: ['wait_seconds'],
  },


  'timer_idle_shutdown.cancel': {
    _package: 'timers',
    plugin: 'timer_idle_shutdown',
    method: 'cancel',
  },
  'timer_idle_shutdown.get_state': {
    _package: 'timers',
    plugin: 'timer_idle_shutdown',
    method: 'get_state',
  },
  'timer_idle_shutdown': {
    _package: 'timers',
    plugin: 'timer_idle_shutdown',
    method: 'start',
    argKeys: ['wait_seconds'],
  },

  // Quiet Hours
  getQuietHours: {
    _package: 'timers',
    plugin: 'quiet_hours',
    method: 'get_config',
  },
  setQuietHours: {
    _package: 'timers',
    plugin: 'quiet_hours',
    method: 'set_config',
    argKeys: ['enabled', 'start', 'end', 'fade_minutes'],
  },



  // Host
  getAutohotspotStatus: {
    _package: 'host',
    plugin: 'get_autohotspot_status',
  },
  startAutohotspot: {
    _package: 'host',
    plugin: 'start_autohotspot',
  },
  stopAutohotspot: {
    _package: 'host',
    plugin: 'stop_autohotspot',
  },
  getIpAddress: {
    _package: 'host',
    plugin: 'get_ip_address',
  },

  // Bluetooth
  bluetoothAvailable: {
    _package: 'host',
    plugin: 'bluetooth_available',
  },
  bluetoothDevices: {
    _package: 'host',
    plugin: 'bluetooth_devices',
  },
  bluetoothScan: {
    _package: 'host',
    plugin: 'bluetooth_scan',
    argKeys: ['timeout'],
  },
  bluetoothPair: {
    _package: 'host',
    plugin: 'bluetooth_pair',
    argKeys: ['mac'],
  },
  bluetoothConnect: {
    _package: 'host',
    plugin: 'bluetooth_connect',
    argKeys: ['mac'],
  },
  bluetoothDisconnect: {
    _package: 'host',
    plugin: 'bluetooth_disconnect',
    argKeys: ['mac'],
  },
  bluetoothRemove: {
    _package: 'host',
    plugin: 'bluetooth_remove',
    argKeys: ['mac'],
  },
  getDiskUsage: {
    _package: 'host',
    plugin: 'get_disk_usage',
  },
  reboot: {
    _package: 'host',
    plugin: 'reboot',
  },
  shutdown: {
    _package: 'host',
    plugin: 'shutdown',
  },
  say_my_ip: {
    _package: 'host',
    plugin: 'say_my_ip',
    argKeys: ['option'],
  },

  // Misc
  getAppSettings: {
    _package: 'misc',
    plugin: 'get_app_settings'
  },

  setAppSettings: {
    _package: 'misc',
    plugin: 'set_app_settings',
    argKeys: ['settings'],
  },

  getBoxName: {
    _package: 'misc',
    plugin: 'get_box_name',
  },

  getLogDebug: {
    _package: 'misc',
    plugin: 'get_log_debug',
  },

  getLogError: {
    _package: 'misc',
    plugin: 'get_log_error',
  },

  setBoxName: {
    _package: 'misc',
    plugin: 'set_box_name',
    argKeys: ['name'],
  },

  getSecondSwipeOption: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'get_second_swipe_option',
  },

  setSecondSwipeOption: {
    _package: 'player',
    plugin: 'ctrl',
    method: 'set_second_swipe_option',
    argKeys: ['alias'],
  },

  // Synchronisation
  'sync_rfidcards_all': {
    _package: 'sync_rfidcards',
    plugin: 'ctrl',
    method: 'sync_all'
  },
  'sync_rfidcards_change_on_rfid_scan': {
    _package: 'sync_rfidcards',
    plugin: 'ctrl',
    method: 'sync_change_on_rfid_scan',
    argKeys: ['option']
  },
};

export default commands;
