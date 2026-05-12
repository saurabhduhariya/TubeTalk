"""FastAPI route for the /chat endpoint."""

import os
from contextlib import contextmanager

from fastapi import APIRouter, HTTPException, Request

from app.models import ChatRequest, ChatResponse
from app.graph.state import GraphState
from app.graph.builder import rag_graph
from app.services.video import get_video_metadata, get_video_comments

router = APIRouter()

# Keys the frontend may override via X-Api-Key-* headers
_OVERRIDABLE_KEYS = [
    "GROQ_API_KEY",
    "OPENROUTER_API_KEY",
    "VOYAGE_API_KEY",
    "PINECONE_API_KEY",
    "PINECONE_INDEX_NAME",
    "TAVILY_API_KEY",
]


@contextmanager
def _override_env_keys(request: Request):
    """Temporarily override env vars with user-supplied API keys from headers."""
    originals: dict[str, str | None] = {}

    for key in _OVERRIDABLE_KEYS:
        header_name = f"x-api-key-{key}"
        header_value = request.headers.get(header_name)
        if header_value:
            originals[key] = os.environ.get(key)
            os.environ[key] = header_value

    try:
        yield
    finally:
        # Restore original values
        for key, original_value in originals.items():
            if original_value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = original_value


@router.post("/chat", response_model=ChatResponse)
async def chat_with_video(request: Request):
    """Run the Hybrid CRAG + Self-RAG pipeline and return the generated answer."""
    try:
        # Parse body manually since we need the raw Request for headers
        body = await request.json()
        chat_request = ChatRequest(**body)

        with _override_env_keys(request):
            initial_state: GraphState = {
                "question": chat_request.question,
                "video_url": chat_request.url,
                "metadata": get_video_metadata(chat_request.url),
                "comments": get_video_comments(chat_request.url),
                "route": "",
                "documents": [],
                "retrieval_grade": "",
                "refined_knowledge": "",
                "web_knowledge": "",
                "generation": "",
                "generation_retries": 0,
                "hallucination_result": "",
                "loop_count": 0,
            }

            print(f"\n{'=' * 60}")
            print(f"  New Request: '{chat_request.question}'")
            print(f"  Video URL:   {chat_request.url}")
            user_keys = [k for k in _OVERRIDABLE_KEYS if request.headers.get(f"x-api-key-{k}")]
            if user_keys:
                print(f"  User API Keys: {', '.join(user_keys)}")
            print(f"{'=' * 60}")

            result = rag_graph.invoke(initial_state)

        return ChatResponse(answer=result["generation"])

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
