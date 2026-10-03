"""Plain text of an uploaded specification (cahier des charges): .txt, .md, .pdf, .docx.

The structure useful to the analyzer is kept in a Markdown-like form: Word headings become
"# …" lines, list items "- …" (indented by level) and table rows "cell | cell".
"""

import io
import logging
import re
from pathlib import Path

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from pypdf import PdfReader

from ..errors import ApiError

logger = logging.getLogger("ai-service")

SUPPORTED_EXTENSIONS = (".txt", ".md", ".pdf", ".docx")
MAX_PDF_PAGES = 300
MIN_TEXT_CHARS = 20

_HEADING_STYLE = re.compile(r"^(heading|titre)\s*(\d)$", re.IGNORECASE)


def extension_of(filename: str) -> str:
    return Path(filename).suffix.lower()


def extract_text(filename: str, content: bytes, max_chars: int) -> tuple[str, bool]:
    """(text, truncated). Raises ApiError 415 (unsupported type) or 422 (unreadable / no text)."""
    extension = extension_of(filename)
    if extension not in SUPPORTED_EXTENSIONS:
        raise ApiError(415, f"Unsupported file type: use {', '.join(SUPPORTED_EXTENSIONS)}")
    if not content:
        raise ApiError(422, "The file is empty")

    try:
        if extension == ".pdf":
            text = _pdf_text(content)
        elif extension == ".docx":
            text = _docx_text(content)
        else:
            text = _decode(content)
    except ApiError:
        raise
    except Exception as exc:  # corrupted file: the parsers raise many different exceptions
        logger.warning("Could not read %s (%s): %s", extension, type(exc).__name__, exc)
        raise ApiError(422, "The file could not be read (corrupted or not a real " + extension + " file)")

    text = _clean(text)
    if len(text) < MIN_TEXT_CHARS:
        raise ApiError(422, "No text found in the document (a scanned PDF contains only images)")
    if len(text) > max_chars:
        return text[:max_chars], True
    return text, False


def _decode(content: bytes) -> str:
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return content.decode("cp1252", errors="replace")  # Windows editors (Notepad, Word "text")


def _pdf_text(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    if reader.is_encrypted and not reader.decrypt(""):
        raise ApiError(422, "The PDF is password-protected")
    pages = reader.pages[:MAX_PDF_PAGES]
    return "\n\n".join(page.extract_text() or "" for page in pages)


def _docx_text(content: bytes) -> str:
    document = Document(io.BytesIO(content))
    lines: list[str] = []
    for block in document.iter_inner_content():
        if isinstance(block, Paragraph):
            lines.append(_paragraph_line(block))
        elif isinstance(block, Table):
            lines.append("")
            lines.extend(_table_lines(block))
            lines.append("")
    return "\n".join(lines)


def _paragraph_line(paragraph: Paragraph) -> str:
    text = paragraph.text.strip()
    if not text:
        return ""
    style = (paragraph.style.name if paragraph.style is not None else "") or ""
    heading = _HEADING_STYLE.match(style.strip())
    if heading:
        return "\n" + "#" * int(heading.group(2)) + " " + text
    if style.lower() == "title":
        return "# " + text
    properties = paragraph._p.pPr
    numbering = properties.numPr if properties is not None else None
    if numbering is not None or "list" in style.lower() or "liste" in style.lower():
        level = numbering.ilvl.val if numbering is not None and numbering.ilvl is not None else 0
        return "  " * int(level) + "- " + text
    return text


def _table_lines(table: Table) -> list[str]:
    lines = []
    for row in table.rows:
        cells: list[str] = []
        previous = None
        for cell in row.cells:
            # A merged cell is returned once per grid column: keep one copy.
            if cell._tc is not previous:
                cells.append(" ".join(cell.text.split()))
            previous = cell._tc
        if any(cells):
            lines.append(" | ".join(cells))
    return lines


def _clean(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    text = "\n".join(line.rstrip() for line in text.split("\n"))
    return re.sub(r"\n{3,}", "\n\n", text).strip()
