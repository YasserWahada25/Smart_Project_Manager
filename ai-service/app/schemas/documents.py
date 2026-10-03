from pydantic import BaseModel


class ExtractResponse(BaseModel):
    filename: str
    # Plain text; Markdown-like structure is kept (headings "# …", bullets "- …") for the analyzer.
    text: str
    characters: int
    truncated: bool
