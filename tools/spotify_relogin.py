#!/usr/bin/env python3
"""Re-mint the librespot credentials that Mopidy-Spotify needs for playback.

Symptom this fixes: Spotify cards play nothing while local folder cards are fine and the
WebApp still shows Spotify names and covers. The jukebox log shows the queue filling and
playback dying at once:

    mopidy.audio.gst  GStreamer error: Resource not found.

The plugin reports that as "track is not available", which is misleading: it is the
blanket message for any load failure. The real error, visible only with librespot's own
logging, is

    https://login5.spotify.com/v3/login -> FaultyRequest(INVALID_CREDENTIALS)

Spotify only mints an audio token when the stored credentials were generated with the
same client-id that asks for it. Mopidy authenticates librespot with a Web API token
from auth.mopidy.com, which belongs to a different Spotify app, so once Spotify started
enforcing that match, playback broke while the Web API kept working. Logging in once
with librespot's own client-id writes matching credentials into the cache, and Mopidy
reuses them from then on.

Usage, in two steps because the browser step happens on your machine, not the box:

    python3 tools/spotify_relogin.py url
    # open the printed URL, log in, approve. The browser then fails to reach
    # 127.0.0.1:5588 - that is expected, nothing listens there. Copy the address bar.
    python3 tools/spotify_relogin.py finish '<pasted url>'
    systemctl --user restart mopidy

The previous credentials are renamed '*.old' rather than deleted. Expect to run this
again whenever Spotify invalidates the cached credentials.
"""
import argparse
import base64
import hashlib
import json
import os
import secrets
import sys
import urllib.parse
import urllib.request

# What `librespot --enable-oauth` itself uses. The client-id has to be this one: it is
# what librespot later presents to login5, and the two must match.
CLIENT_ID = '65b708073fc0480ea92a077233ca87bd'
REDIRECT_URI = 'http://127.0.0.1:5588/login'
SCOPES = 'streaming user-read-email user-read-private playlist-read-private user-library-read'

DEFAULT_CACHE_DIR = os.path.expanduser('~/.local/share/mopidy/spotify/credentials-cache')
DEFAULT_STATE_FILE = os.path.expanduser('~/.spotify-oauth-state.json')
# Any always-available track works; it is only used to prove the new credentials stream.
PROBE_TRACK = 'spotify:track:4uLU6hMCjMI75M1A2tKUQC'


def step_url(state_file):
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(64)).decode().rstrip('=')
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
    with open(state_file, 'w') as fh:
        json.dump({'verifier': verifier}, fh)
    os.chmod(state_file, 0o600)

    query = urllib.parse.urlencode({
        'client_id': CLIENT_ID,
        'response_type': 'code',
        'redirect_uri': REDIRECT_URI,
        'scope': SCOPES,
        'code_challenge_method': 'S256',
        'code_challenge': challenge,
    })
    print('Open this URL, log in, and approve:\n')
    print(f'https://accounts.spotify.com/authorize?{query}\n')
    print('The browser will fail to reach 127.0.0.1:5588. That is expected.')
    print("Copy the full address bar and pass it to 'finish'.")


def _exchange_code(redirected_url, state_file):
    with open(state_file) as fh:
        verifier = json.load(fh)['verifier']

    params = urllib.parse.parse_qs(urllib.parse.urlparse(redirected_url).query)
    if 'error' in params:
        sys.exit(f"Spotify returned an error: {params['error'][0]}")
    if 'code' not in params:
        sys.exit("No 'code' in that URL. Paste the full address you were redirected to.")

    body = urllib.parse.urlencode({
        'grant_type': 'authorization_code',
        'code': params['code'][0],
        'redirect_uri': REDIRECT_URI,
        'client_id': CLIENT_ID,
        'code_verifier': verifier,
    }).encode()
    request = urllib.request.Request(
        'https://accounts.spotify.com/api/token',
        data=body,
        headers={'Content-Type': 'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)['access_token']


def _mint_credentials(token, cache_dir):
    """Let librespot swap the OAuth token for stored credentials it can reuse.

    Handing it the token with an emptied cache is the only way in: the credentials are
    written by librespot itself, tied to the client-id above.
    """
    import gi
    gi.require_version('Gst', '1.0')
    from gi.repository import Gst, GLib

    for name in os.listdir(cache_dir):
        if not name.endswith('.old'):
            os.rename(os.path.join(cache_dir, name),
                      os.path.join(cache_dir, name + '.old'))
            print(f'  moved aside: {name} -> {name}.old')

    Gst.init(None)
    pipeline = Gst.Pipeline.new('relogin')
    src = Gst.ElementFactory.make('spotifyaudiosrc', 'src')
    if src is None:
        sys.exit('spotifyaudiosrc is missing. Is gst-plugin-spotify installed?')
    sink = Gst.ElementFactory.make('fakesink', 'sink')
    src.set_property('track', PROBE_TRACK)
    src.set_property('access-token', token)
    src.set_property('cache-credentials', cache_dir)
    src.set_property('bitrate', '160')
    pipeline.add(src)
    pipeline.add(sink)
    src.link(sink)

    loop = GLib.MainLoop()
    outcome = {'status': 'timed out'}

    def on_message(_bus, message):
        if message.type == Gst.MessageType.ERROR:
            error, _debug = message.parse_error()
            outcome['status'] = f'failed: {error.message}'
            loop.quit()
        elif message.type == Gst.MessageType.EOS:
            outcome['status'] = 'ok'
            loop.quit()
        elif (message.type == Gst.MessageType.STATE_CHANGED
                and message.src == pipeline):
            _old, new, _pending = message.parse_state_changed()
            if new == Gst.State.PLAYING:
                outcome['status'] = 'ok'
                GLib.timeout_add_seconds(3, loop.quit)

    bus = pipeline.get_bus()
    bus.add_signal_watch()
    bus.connect('message', on_message)
    pipeline.set_state(Gst.State.PLAYING)
    GLib.timeout_add_seconds(40, loop.quit)
    loop.run()
    pipeline.set_state(Gst.State.NULL)
    return outcome['status']


def step_finish(redirected_url, cache_dir, state_file):
    token = _exchange_code(redirected_url, state_file)
    print(f'Access token acquired ({len(token)} chars).')

    os.makedirs(cache_dir, exist_ok=True)
    status = _mint_credentials(token, cache_dir)
    written = [n for n in os.listdir(cache_dir) if not n.endswith('.old')]

    print(f'Playback test: {status}')
    print(f"Credentials written: {written or 'NONE'}")
    if status != 'ok' or not written:
        print('\nThe old credentials are still there as *.old if you want them back.')
        sys.exit(1)
    print('\nDone. Restart Mopidy:  systemctl --user restart mopidy')


def main():
    parser = argparse.ArgumentParser(
        description='Re-mint librespot credentials for Mopidy-Spotify.')
    parser.add_argument('--cache-dir', default=DEFAULT_CACHE_DIR,
                        help='Mopidy-Spotify credentials cache (default: %(default)s)')
    parser.add_argument('--state-file', default=DEFAULT_STATE_FILE,
                        help='where the PKCE verifier is kept between the two steps')
    subparsers = parser.add_subparsers(dest='step', required=True)
    subparsers.add_parser('url', help='print the Spotify authorization URL')
    finish = subparsers.add_parser('finish', help='exchange the redirected URL')
    finish.add_argument('redirected_url')

    args = parser.parse_args()
    if args.step == 'url':
        step_url(args.state_file)
    else:
        step_finish(args.redirected_url, args.cache_dir, args.state_file)


if __name__ == '__main__':
    main()
