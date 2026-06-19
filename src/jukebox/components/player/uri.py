import re


def normalize_uri(uri: str) -> str:
    """Normalize a playback URI before passing it to the player backend.

    Converts Spotify web URLs to Spotify URIs so both formats work on RFID cards.
    All other URIs are returned unchanged.

    Examples:
        https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy  ->  spotify:album:4aawyAB9vmqN3uQ7FjRGTy
        spotify:album:4aawyAB9vmqN3uQ7FjRGTy                  ->  spotify:album:4aawyAB9vmqN3uQ7FjRGTy
        TraumfaengerStarkeLieder/                              ->  TraumfaengerStarkeLieder/
    """
    match = re.match(
        r'https?://open\.spotify\.com/(track|album|playlist|artist)/([A-Za-z0-9]+)',
        uri)
    if match:
        return f"spotify:{match.group(1)}:{match.group(2)}"
    return uri
