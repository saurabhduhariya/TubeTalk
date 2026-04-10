from typing import List

from langchain_core.documents import Document
from typing_extensions import TypedDict


class GraphState(TypedDict):
    """State flowing through the Hybrid CRAG + Self-RAG pipeline."""
    question: str              # User's question
    video_url: str             # YouTube URL → Pinecone namespace key
    metadata: str              # Extracted video metadata (Title, Description, Chapters)
    route: str                 # "video_rag" | "web_search" | "casual"
    documents: List[Document]  # Raw retrieved documents from Pinecone
    retrieval_grade: str       # "correct" | "ambiguous" | "incorrect" (CRAG)
    refined_knowledge: str     # Filtered & recomposed internal knowledge (CRAG)
    web_knowledge: str         # External knowledge from Tavily (CRAG)
    generation: str            # LLM-generated answer
    generation_retries: int    # Hallucination check retry count (Self-RAG)
    hallucination_result: str  # "grounded" | "not_grounded" (set by hallucination_check)
    loop_count: int            # Kept for compatibility / future use
