"""FastAPI route for the /chat endpoint."""

from fastapi import APIRouter, HTTPException

from app.models import ChatRequest, ChatResponse
from app.graph.state import GraphState
from app.graph.builder import rag_graph
from app.services.video import get_video_metadata

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat_with_video(request: ChatRequest):
    """Run the Hybrid CRAG + Self-RAG pipeline and return the generated answer."""
    try:
        initial_state: GraphState = {
            "question": request.question,
            "video_url": request.url,
            "metadata": get_video_metadata(request.url),
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
        print(f"  New Request: '{request.question}'")
        print(f"  Video URL:   {request.url}")
        print(f"{'=' * 60}")

        result = rag_graph.invoke(initial_state)

        return ChatResponse(answer=result["generation"])

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
