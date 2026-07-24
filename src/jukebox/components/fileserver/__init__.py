# RPi-Jukebox-RFID Version 3
# Copyright (c) See file LICENSE in project root folder

"""
HTTP file upload server for adding audio files to the jukebox via the web UI.

Listens on a configurable port (default 8080). Accepts multipart POST uploads
and saves them under the audiofolders directory.  Path traversal is prevented
by resolving the destination path and checking it stays inside audiofolders.

Multipart parsing is done by a small in-house parser (:func:`parse_multipart`)
because the stdlib ``cgi`` module was removed in Python 3.13 (PEP 594) and this
project targets Debian Trixie, which ships Python 3.13+.

Configuration (``shared/settings/jukebox.yaml``)::

    fileserver:
      enable: true            # set false to disable the server entirely
      host: '0.0.0.0'         # bind address; use '127.0.0.1' to restrict to localhost
      port: 8080
      token: ''               # if set, uploads must send a matching X-Upload-Token header
      max_upload_size_mb: 500 # reject uploads whose body exceeds this size

Published topics:
  ``fileserver.upload_url`` – the full URL of the upload endpoint, e.g.
  ``http://192.168.1.42:8080/upload``.  The webapp reads this at start-up.
"""

import io
import logging
import os
import re
import shutil
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import components.player
import jukebox.cfghandler
import jukebox.plugs as plugin
import jukebox.publishing as publishing

logger = logging.getLogger('jb.fileserver')
cfg = jukebox.cfghandler.get_handler('jukebox')

_server: 'ThreadingHTTPServer | None' = None
_server_thread: 'threading.Thread | None' = None

# Populated in initialize() from config so the request handler need not touch cfg
_token: str = ''
_max_upload_bytes: int = 0


# ---------------------------------------------------------------------------
# Pure helpers (no I/O, unit-tested in test/fileserver/)
# ---------------------------------------------------------------------------

def is_within_directory(base: str, target: str) -> bool:
    """Return True if *target* resolves to *base* itself or a path inside it.

    Both paths are resolved with ``realpath`` so symlinks and ``..`` segments
    cannot escape.  The check uses a separator boundary so that a sibling
    directory sharing a name prefix (e.g. ``audiofolders_evil`` next to
    ``audiofolders``) is correctly rejected.
    """
    base = os.path.realpath(base)
    target = os.path.realpath(target)
    return target == base or target.startswith(base + os.sep)


def _parse_content_disposition(header_value: str) -> dict:
    """Parse a Content-Disposition header value into a dict of its parameters."""
    params = {}
    for part in header_value.split(';'):
        part = part.strip()
        if '=' in part:
            key, value = part.split('=', 1)
            params[key.strip().lower()] = value.strip().strip('"')
    return params


def parse_multipart(body: bytes, content_type: str):
    """Parse a ``multipart/form-data`` body into form fields and files.

    Replacement for ``cgi.FieldStorage`` (removed in Python 3.13).

    :param body: the raw request body bytes
    :param content_type: the request ``Content-Type`` header (must contain the
        boundary parameter)
    :return: a tuple ``(fields, files)`` where ``fields`` is a
        ``dict[str, str]`` of simple form values and ``files`` is a list of
        ``(filename, data_bytes)`` tuples
    :raises ValueError: if no boundary is present in *content_type*
    """
    match = re.search(r'boundary=(?:"([^"]+)"|([^;]+))', content_type)
    if not match:
        raise ValueError('No boundary found in Content-Type header')
    boundary = (match.group(1) or match.group(2)).strip()
    delimiter = b'--' + boundary.encode('latin-1')

    fields: dict = {}
    files: list = []

    for chunk in body.split(delimiter):
        # Skip the preamble, the closing delimiter ("--\r\n") and empty parts
        if not chunk or chunk.startswith(b'--'):
            continue
        # A real part is "\r\n<headers>\r\n\r\n<data>\r\n"
        if chunk.startswith(b'\r\n'):
            chunk = chunk[2:]
        if chunk.endswith(b'\r\n'):
            chunk = chunk[:-2]

        header_blob, _, data = chunk.partition(b'\r\n\r\n')
        headers = {}
        for line in header_blob.split(b'\r\n'):
            if b':' in line:
                key, value = line.split(b':', 1)
                headers[key.decode('latin-1').strip().lower()] = value.decode('latin-1').strip()

        params = _parse_content_disposition(headers.get('content-disposition', ''))
        name = params.get('name')
        if name is None:
            continue

        filename = params.get('filename')
        if filename:
            files.append((filename, data))
        else:
            fields[name] = data.decode('utf-8', errors='replace')

    return fields, files


# ---------------------------------------------------------------------------
# HTTP request handler
# ---------------------------------------------------------------------------

class _UploadHandler(BaseHTTPRequestHandler):
    """Minimal HTTP handler: GET / returns 200 OK, POST /upload saves files."""

    # Silence per-request access log; errors still go to logger
    def log_message(self, fmt, *args):
        pass

    def log_error(self, fmt, *args):
        logger.error(fmt % args)

    def _authorized(self) -> bool:
        if not _token:
            return True
        return self.headers.get('X-Upload-Token', '') == _token

    def do_GET(self):
        if self.path in ('/', '/health'):
            self._send_text(200, 'Jukebox fileserver OK')
        else:
            self._send_text(404, 'Not found')

    def do_POST(self):
        if self.path != '/upload':
            self._send_text(404, 'Not found')
            return

        if not self._authorized():
            self._send_text(401, 'Unauthorized')
            return

        audiofolders = components.player.get_music_library_path()
        if audiofolders is None:
            self._send_text(503, 'Music library path not available')
            return
        audiofolders = os.path.realpath(os.path.expanduser(audiofolders))

        content_type = self.headers.get('Content-Type', '')
        if 'multipart/form-data' not in content_type:
            self._send_text(400, 'Expected multipart/form-data')
            return

        length = int(self.headers.get('Content-Length', 0))
        if _max_upload_bytes and length > _max_upload_bytes:
            self._send_text(413, f'Upload too large (max {_max_upload_bytes // (1024 * 1024)} MB)')
            return

        body = self.rfile.read(length)
        try:
            fields, files = parse_multipart(body, content_type)
        except ValueError as e:
            self._send_text(400, str(e))
            return

        # Optional subfolder field lets the client pick the destination
        subfolder = fields.get('folder', '').strip().strip('/')
        dest_dir = os.path.join(audiofolders, subfolder) if subfolder else audiofolders
        if not is_within_directory(audiofolders, dest_dir):
            self._send_text(400, 'Path traversal rejected')
            return

        os.makedirs(dest_dir, exist_ok=True)

        saved = []
        errors = []
        for filename, data in files:
            if not filename:
                continue
            # filename may carry a webkitRelativePath subfolder; keep it relative
            # and verify it resolves inside dest_dir before writing.
            rel = os.path.normpath(filename.replace('\\', '/').lstrip('/'))
            dest = os.path.join(dest_dir, rel)
            if not is_within_directory(dest_dir, dest):
                errors.append(filename)
                logger.error(f"Rejected path traversal in upload filename: {filename}")
                continue
            try:
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                with open(dest, 'wb') as fh:
                    shutil.copyfileobj(io.BytesIO(data), fh)
                saved.append(rel)
                logger.info(f"Uploaded file: {dest}")
            except OSError as e:
                errors.append(filename)
                logger.error(f"Failed to save {filename}: {e}")

        # Wait for the MPD scan so uploads are browsable when the client refreshes.
        if saved:
            plugin.call_ignore_errors('player', 'ctrl', 'update_wait')

        if errors:
            self._send_text(500, f"Saved {len(saved)}, failed: {', '.join(errors)}")
        else:
            self._send_text(200, f"Saved {len(saved)} file(s)")

    def _send_text(self, code: int, body: str):
        encoded = body.encode()
        self.send_response(code)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Length', str(len(encoded)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(encoded)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Upload-Token')
        self.end_headers()


# ---------------------------------------------------------------------------
# Plugin lifecycle
# ---------------------------------------------------------------------------

@plugin.initialize
def initialize():
    global _server, _server_thread, _token, _max_upload_bytes

    if not cfg.setndefault('fileserver', 'enable', value=True):
        logger.info("File upload server disabled in config")
        return

    host = cfg.setndefault('fileserver', 'host', value='0.0.0.0')
    port = int(cfg.setndefault('fileserver', 'port', value=8080))
    _token = str(cfg.setndefault('fileserver', 'token', value=''))
    _max_upload_bytes = int(cfg.setndefault('fileserver', 'max_upload_size_mb', value=500)) * 1024 * 1024

    try:
        _server = ThreadingHTTPServer((host, port), _UploadHandler)
    except OSError as e:
        logger.error(f"Could not start file upload server on {host}:{port}: {e}")
        return

    _server_thread = threading.Thread(target=_server.serve_forever, name='fileserver', daemon=True)
    _server_thread.start()
    logger.info(f"File upload server listening on {host}:{port}")
    if not _token:
        logger.warning("File upload server has no token set - any client on the network can upload files")

    # Publish the upload URL so the webapp can find it without hard-coding the address
    try:
        import subprocess
        result = subprocess.run(['hostname', '-I'], capture_output=True, timeout=2)
        ip = result.stdout.decode().split()[0] if result.returncode == 0 else '0.0.0.0'
    except Exception:
        ip = '0.0.0.0'
    upload_url = f"http://{ip}:{port}/upload"
    publishing.get_publisher().send('fileserver.upload_url', upload_url)
    logger.info(f"Upload URL: {upload_url}")


@plugin.atexit
def atexit(**ignored_kwargs):
    global _server
    if _server is not None:
        _server.shutdown()
        logger.info("File upload server stopped")
