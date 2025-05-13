import os
import tempfile

from pontoon.base.tests import TestCase, assert_attributes_equal
from pontoon.sync.formats import ini_kv
from pontoon.sync.tests.formats import FormatTestsMixin


# Sample INI content for testing
BASE_INI_FILE = """
; This is a sample INI file
[Section1]
key1=value1
key2=value2

[Section2]
key3=value3
key4=value4
"""

# Sample INI content without sections
BASE_INI_NO_SECTIONS = """
; This is a sample INI file without sections
key1=value1
key2=value2
key3=value3
key4=value4
"""

# Sample INI file with UTF-8 BOM
BASE_INI_WITH_BOM = (
    b"\xef\xbb\xbf"
    + """
; This is a sample INI file with UTF-8 BOM
[Section1]
key1=value1
key2=value2
""".encode("utf-8")
)


class INIKVTests(FormatTestsMixin, TestCase):
    parse = staticmethod(ini_kv.parse)
    supports_keys = True
    supports_source = False
    supports_source_string = True

    def setUp(self):
        super().setUp()
        # Create a temporary file for testing
        fd, path = tempfile.mkstemp()
        self.tempfile = os.fdopen(fd, "w+b")
        self.tempfile_path = path

    def tearDown(self):
        self.tempfile.close()
        os.unlink(self.tempfile_path)
        super().tearDown()

    def test_parse_basic(self):
        self.tempfile.write(BASE_INI_FILE.encode("utf-8"))
        self.tempfile.flush()

        translations = ini_kv.parse(self.tempfile_path)

        assert len(translations) == 4
        assert_attributes_equal(
            translations[0],
            key="key1",
            context="key1",
            strings={None: "value1"},
            source_string="value1",
            comments=[],
            order=0,
        )

    def test_parse_no_sections(self):
        self.tempfile.write(BASE_INI_NO_SECTIONS.encode("utf-8"))
        self.tempfile.flush()

        translations = ini_kv.parse(self.tempfile_path)

        assert len(translations) == 4
        assert_attributes_equal(
            translations[0],
            key="key1",
            context="key1",
            strings={None: "value1"},
            source_string="value1",
            comments=[],
            order=0,
        )

    def test_parse_with_bom(self):
        # Write BOM test content directly to our temp file
        self.tempfile.seek(0)
        self.tempfile.write(BASE_INI_WITH_BOM)
        self.tempfile.flush()

        translations = ini_kv.parse(self.tempfile_path)

        assert len(translations) == 2
        assert_attributes_equal(
            translations[0],
            key="key1",
            context="key1",
            strings={None: "value1"},
            source_string="value1",
            comments=[],
            order=0,
        )
