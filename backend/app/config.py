import os
from dotenv import load_dotenv

load_dotenv()

# ── Validate required environment variables ───────────────────────────────────

REQUIRED_KEYS = ["GROQ_API_KEY", "VOYAGE_API_KEY", "PINECONE_API_KEY", "PINECONE_INDEX_NAME", "TAVILY_API_KEY"]
for key in REQUIRED_KEYS:
    if not os.getenv(key):
        raise ValueError(f"CRITICAL: {key} is missing from your .env file!")

# ── Exported config values ────────────────────────────────────────────────────

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
VOYAGE_API_KEY = os.getenv("VOYAGE_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

# ── Shared LLM, Embeddings, Pinecone Client, Tavily Tool ─────────────────────

from langchain_groq import ChatGroq
from langchain_voyageai import VoyageAIEmbeddings
from langchain_tavily import TavilySearch
from pinecone import Pinecone

fast_llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0)
reasoning_llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)

embeddings = VoyageAIEmbeddings(model="voyage-3")

pc = Pinecone(api_key=PINECONE_API_KEY)

tavily_tool = TavilySearch(max_results=3)
