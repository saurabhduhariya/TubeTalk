from typing import List

from langchain_core.documents import Document
from typing_extensions import TypedDict


class GraphState(TypedDict):
    """State flowing through the LangGraph RAG pipeline."""
    question: str              # Current question (rewriter may mutate this)
    generation: str            # Final answer produced by the generator
    documents: List[Document]  # Retrieved / filtered documents
    loop_count: int            # Rewrite attempts (hard cap = 2)
    video_url: str             # YouTube URL → Pinecone namespace key
    route: str                 # "video_rag" | "web_search" | "casual"
