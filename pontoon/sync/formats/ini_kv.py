"""
Parser for INI files with key/value pairs that can skip sections and handle UTF-8 BOM encoding.
"""

from __future__ import annotations

import configparser
import re

from io import StringIO

from .common import ParseError, VCSTranslation, open_utf8_bom_aware


def parse(path: str):
    """
    Parse an INI file, extracting key/value pairs while skipping sections.

    This parser handles UTF-8 BOM encoded files and treats each key/value pair
    as a separate translatable entity, ignoring section headers.

    Args:
        path: Path to the INI file

    Returns:
        A list of VCSTranslation objects representing the file's content

    Raises:
        ParseError: If there's an error reading or parsing the file
    """
    try:
        # Use the improved open_utf8_bom_aware function with error handling
        with open_utf8_bom_aware(path, "r") as resource:
            content = resource.read()
    except (OSError, UnicodeDecodeError) as err:
        # Last resort fallback to binary mode and manual decoding
        try:
            with open(path, "rb") as binary_file:
                # Read as binary first
                raw_content = binary_file.read()
                # Skip BOM if present
                if raw_content.startswith(b"\xef\xbb\xbf"):
                    raw_content = raw_content[3:]
                # Try to decode with replacement for invalid chars
                content = raw_content.decode("utf-8", errors="replace")
        except Exception as fallback_err:
            raise ParseError(
                f"Failed to parse {path}: {err} (fallback error: {fallback_err})"
            )

    # Extract all key/value pairs, ignoring section headers
    translations: list[VCSTranslation] = []
    order = 0

    # First, try standard INI parsing (for well-formed INI files)
    try:
        # Create a string buffer to handle the content
        string_buffer = StringIO(content)

        # Create a config parser with options to preserve case
        config = configparser.ConfigParser()
        config.optionxform = str  # Preserve key case

        # Read the file content from the string buffer
        config.read_file(string_buffer)

        # Extract all key/value pairs from all sections
        for section in config.sections():
            for key, value in config.items(section):
                if value.strip():  # Only include non-empty values
                    translations.append(
                        VCSTranslation(
                            key=key,
                            context=key,
                            order=order,
                            strings={None: value},
                            source_string=value,
                            comments=[],
                        )
                    )
                    order += 1

    # If standard parsing fails, fall back to regex-based extraction
    except (configparser.Error, ValueError):
        # Use regex to find all key=value pairs outside of section headers
        # The pattern now also handles potential malformed content better
        kv_pattern = re.compile(r"^([^[\]#][^=\n]*?)=(.*)$", re.MULTILINE)

        for match in kv_pattern.finditer(content):
            try:
                key = match.group(1).strip()
                value = match.group(2).strip()

                if key and value:  # Only include valid key/value pairs
                    translations.append(
                        VCSTranslation(
                            key=key,
                            context=key,
                            order=order,
                            strings={None: value},
                            source_string=value,
                            comments=[],
                        )
                    )
                    order += 1
            except (IndexError, AttributeError):
                # Skip problematic matches
                continue

    return translations
