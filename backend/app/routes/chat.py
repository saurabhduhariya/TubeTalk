"""FastAPI route for the /chat endpoint."""

from fastapi import APIRouter, HTTPException

from app.models import ChatRequest, ChatResponse
from app.graph.state import GraphState
from app.graph.builder import rag_graph

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat_with_video(request: ChatRequest):
    """Run the LangGraph Self-RAG pipeline and return the generated answer."""
    try:
        initial_state: GraphState = {
            "question": request.question,
            "generation": "",
            "documents": [],
            "loop_count": 0,
            "video_url": request.url,
            "route": "",
        }

        print(f"\n{'=' * 60}")
        print(f"  New Request: '{request.question}'")
        print(f"  Video URL:   {request.url}")
        print(f"{'=' * 60}")

        result = rag_graph.invoke(initial_state)

        return ChatResponse(answer=result["generation"])

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
