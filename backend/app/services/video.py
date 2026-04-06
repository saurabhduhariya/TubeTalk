from typing import List

from fastapi import HTTPException
from langchain_community.document_loaders import YoutubeLoader
from langchain_pinecone import PineconeVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from app.config import pc, embeddings, PINECONE_INDEX_NAME

# Track videos already indexed in this session to avoid Pinecone's delayed stats
_indexed_videos: set = set()


def get_vector_store(video_url: str) -> PineconeVectorStore:
    """Return a PineconeVectorStore for the given video, indexing it if needed."""
    video_id = video_url.split("v=")[-1].split("&")[0]

    vectorstore = PineconeVectorStore(
        index_name=PINECONE_INDEX_NAME,
        embedding=embeddings,
        namespace=video_id,
    )

    if video_id in _indexed_videos:
        print(f"--- Video {video_id} already indexed (Local Cache Hit) ---")
        return vectorstore

    index = pc.Index(PINECONE_INDEX_NAME)
    stats = index.describe_index_stats()

    if video_id not in stats.get("namespaces", {}):
        print(f"--- Indexing New Video: {video_id} ---")
        try:
            loader = YoutubeLoader.from_youtube_url(video_url, add_video_info=False)
            data = loader.load()

            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000, chunk_overlap=100
            )
            docs = text_splitter.split_documents(data)

            vectorstore.add_documents(docs)
            _indexed_videos.add(video_id)
            print("--- Successfully Uploaded to Pinecone ---")
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Transcription failed: {str(e)}"
            )
    else:
        _indexed_videos.add(video_id)

    return vectorstore


def format_docs(docs: List[Document]) -> str:
    """Stringify a list of Documents for the LLM prompt."""
    if not docs:
        return "No relevant context found."
    return "\n\n".join(doc.page_content for doc in docs)
