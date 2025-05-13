class ParseError(RuntimeError):
    """Exception to raise when parsing fails."""


def open_utf8_bom_aware(path, mode="r", **kwargs):
    """
    Opens a file in UTF-8 mode and handles the BOM if present.

    The UTF-8 BOM is a sequence of bytes (EF BB BF) that can appear at the
    beginning of a UTF-8 file to indicate its encoding.

    This function handles invalid UTF-8 sequences by replacing them with the
    Unicode replacement character (U+FFFD) to prevent decoding errors.

    Args:
        path: Path to the file to open
        mode: Mode to open the file in (same as built-in open())
        **kwargs: Additional arguments to pass to open()

    Returns:
        A file object with the BOM handled transparently
    """
    # Return binary mode as is
    if 'b' in mode:
        return open(path, mode, **kwargs)

    # For text mode, try multiple encoding approaches in sequence
    # First: utf-8-sig with replacement of invalid chars
    try:
        kwargs.setdefault('encoding', 'utf-8-sig')
        kwargs.setdefault('errors', 'replace')
        return open(path, mode, **kwargs)
    except UnicodeDecodeError:
        # Second attempt: try Latin-1 (which never fails as it maps all byte values)
        try:
            kwargs['encoding'] = 'latin-1'
            kwargs['errors'] = 'replace'
            return open(path, mode, **kwargs)
        except Exception:
            # Last resort: ignore all problematic characters
            try:
                kwargs['encoding'] = 'utf-8-sig'
                kwargs['errors'] = 'ignore'
                return open(path, mode, **kwargs)
            except Exception as e:
                # If all else fails, try binary read + manual decode
                with open(path, 'rb') as f:
                    content = f.read()
                    # Skip BOM if present
                    if content.startswith(b'\xef\xbb\xbf'):
                        content = content[3:]

                    # We'll wrap the decoded content in a StringIO for file-like access
                    from io import StringIO
                    try:
                        # Try to decode with several methods
                        for encoding in ['utf-8', 'latin-1', 'cp1252']:
                            try:
                                decoded = content.decode(encoding, errors='replace')
                                return StringIO(decoded)
                            except:
                                continue
                    except:
                        # Final fallback - return as much as we can
                        return StringIO(str(content)[2:-1])  # strip b'...'


class VCSTranslation:
    """
    A single translation of a source string into another language.

    Since a string can have different translations based on plural
    forms, all of the different forms are stored under self.strings, a
    dict where the keys equal possible values for
    pontoon.base.models.Translation.plural_form and the values equal the
    translation for that plural form.
    """

    def __init__(
        self,
        *,
        key: str,
        context: str,
        order: int,
        strings: dict[str | None, str],
        source_string: str = "",
        source_string_plural: str = "",
        comments: list[str] | None = None,
        group_comments: list[str] | None = None,
        resource_comments: list[str] | None = None,
        fuzzy: bool = False,
        source=None,
    ):
        self.key = key
        self.context = context
        self.order = order
        self.strings = strings
        self.source_string = source_string
        self.source_string_plural = source_string_plural
        self.comments = comments or []
        self.group_comments = group_comments
        self.resource_comments = resource_comments
        self.fuzzy = fuzzy
        self.source = source or []

    def __repr__(self):
        return f"<VCSTranslation {self.key}>"
