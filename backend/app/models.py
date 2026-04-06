from pydantic import BaseModel


class ChatRequest(BaseModel):
    """Incoming chat request with a YouTube URL and a question."""
    url: str
    question: str


class ChatResponse(BaseModel):
    """Outgoing chat response with the generated answer."""
    answer: str
